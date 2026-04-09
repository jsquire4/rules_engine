-- =============================================================================
-- Rules Engine Schema — PostgreSQL
-- =============================================================================

-- ---------------------------------------------------------------------------
-- EXTENSIONS
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS "ltree";     -- hierarchical group path queries

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------
CREATE TYPE domain_enum AS ENUM ('finance', 'communication', 'agent_delegation');

CREATE TYPE dimension_kind AS ENUM (
    'numeric',      -- amount <= N
    'rate',         -- N per time_window
    'set',          -- value IN (...)
    'boolean',      -- flag = true/false
    'temporal'      -- time-of-day window OR expiry date
);

CREATE TYPE policy_effect AS ENUM ('allow', 'deny');

CREATE TYPE decision_outcome AS ENUM ('allow', 'deny', 'not_applicable', 'error');

-- ---------------------------------------------------------------------------
-- ORGANIZATIONS
-- ---------------------------------------------------------------------------
CREATE TABLE organizations (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- GROUPS (hierarchical via ltree)
-- ---------------------------------------------------------------------------
-- path example: "acme.engineering.platform_team"
-- node_type: org | department | team
CREATE TABLE groups (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    node_type   TEXT NOT NULL CHECK (node_type IN ('org', 'department', 'team')),
    path        LTREE NOT NULL,          -- full materialized path
    parent_id   UUID REFERENCES groups(id),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, path)
);
CREATE INDEX idx_groups_path ON groups USING GIST (path);
CREATE INDEX idx_groups_org   ON groups (org_id);

-- ---------------------------------------------------------------------------
-- AGENTS
-- ---------------------------------------------------------------------------
CREATE TABLE agents (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    email       TEXT,
    domain      domain_enum NOT NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE agent_group_memberships (
    agent_id    UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    group_id    UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (agent_id, group_id)
);

-- ---------------------------------------------------------------------------
-- ACTION TYPES & DIMENSION DEFINITIONS
-- ---------------------------------------------------------------------------
CREATE TABLE action_types (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    domain      domain_enum NOT NULL,
    name        TEXT NOT NULL,              -- e.g. "purchase.initiate"
    description TEXT,
    UNIQUE (domain, name)
);

-- Canonical dimension catalog: what dimensions are valid for each action type
CREATE TABLE dimension_definitions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_type_id  UUID NOT NULL REFERENCES action_types(id) ON DELETE CASCADE,
    dimension_name  TEXT NOT NULL,          -- e.g. "amount", "vendor", "allowed_window"
    kind            dimension_kind NOT NULL,
    -- kind-specific metadata (nullable depending on kind)
    numeric_max     NUMERIC,               -- numeric / rate cap
    rate_window     TEXT,                  -- e.g. "1 day", "1 hour"
    set_members     TEXT[],                -- valid set values
    bool_default    BOOLEAN,               -- default flag value
    temporal_start  TIME,                  -- time-of-day window start (EST)
    temporal_end    TIME,                  -- time-of-day window end (EST)
    temporal_expiry DATE,                  -- hard expiry date
    UNIQUE (action_type_id, dimension_name)
);

-- ---------------------------------------------------------------------------
-- POLICIES & VERSIONS
-- ---------------------------------------------------------------------------
CREATE TABLE policies (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    domain      domain_enum NOT NULL,
    effect      policy_effect NOT NULL DEFAULT 'allow',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (org_id, name)
);

-- Every edit produces a new immutable version row; active_version_id points to current
CREATE TABLE policy_versions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id       UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    version_number  INT NOT NULL,
    -- Structured constraint data (mirrors Cedar conditions as JSON for querying)
    constraints     JSONB NOT NULL DEFAULT '[]',
    -- Cedar source (raw .cedar file contents)
    cedar_source    TEXT NOT NULL,
    -- SHA-256 of the cedar_source for this version
    cedar_hash      TEXT NOT NULL GENERATED ALWAYS AS (
                        encode(digest(cedar_source, 'sha256'), 'hex')
                    ) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES agents(id),
    UNIQUE (policy_id, version_number)
);

-- Points the policy to its currently active version
ALTER TABLE policies ADD COLUMN active_version_id UUID REFERENCES policy_versions(id);

-- Bundle hash: SHA-256 over all cedar_source in a named policy bundle
-- Computed at evaluation time and stored in decision_log; no separate table needed.

-- ---------------------------------------------------------------------------
-- POLICY ASSIGNMENTS (policy → group or agent)
-- ---------------------------------------------------------------------------
CREATE TABLE policy_assignments (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id           UUID NOT NULL REFERENCES policies(id) ON DELETE CASCADE,
    policy_version_id   UUID NOT NULL REFERENCES policy_versions(id),
    -- exactly one of these is set
    group_id            UUID REFERENCES groups(id) ON DELETE CASCADE,
    agent_id            UUID REFERENCES agents(id) ON DELETE CASCADE,
    assigned_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (group_id IS NOT NULL AND agent_id IS NULL) OR
        (group_id IS NULL AND agent_id IS NOT NULL)
    )
);

-- ---------------------------------------------------------------------------
-- DECISION LOG
-- ---------------------------------------------------------------------------
CREATE TABLE decision_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    agent_id        UUID NOT NULL REFERENCES agents(id),
    action_type_id  UUID NOT NULL REFERENCES action_types(id),
    -- snapshot of request context evaluated
    request_context JSONB NOT NULL DEFAULT '{}',
    -- SHA-256 over all cedar_source texts of the policy bundle used
    bundle_hash     TEXT NOT NULL,
    outcome         decision_outcome NOT NULL,
    -- human-readable reason / matched policy name
    reason          TEXT,
    -- which policy_version triggered the decision (nullable if not_applicable)
    matched_version_id UUID REFERENCES policy_versions(id)
);
CREATE INDEX idx_decision_log_agent    ON decision_log (agent_id, evaluated_at DESC);
CREATE INDEX idx_decision_log_bundle   ON decision_log (bundle_hash);
CREATE INDEX idx_decision_log_outcome  ON decision_log (outcome, evaluated_at DESC);
