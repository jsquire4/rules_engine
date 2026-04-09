-- =============================================================================
-- Seed Data — Acme Corp
-- =============================================================================
-- Org → Department (Finance, Engineering, Ops) → Team → ~15 agents
-- Demonstrates: inheritance, envelope narrowing, Cedar source storage

BEGIN;

-- ---------------------------------------------------------------------------
-- ORGANIZATION
-- ---------------------------------------------------------------------------
INSERT INTO organizations (id, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Acme Corp', 'acme');

-- ---------------------------------------------------------------------------
-- GROUP HIERARCHY
-- org: acme
-- departments: acme.finance, acme.engineering, acme.ops
-- teams:       acme.finance.ap, acme.finance.treasury
--              acme.engineering.platform, acme.engineering.data
--              acme.ops.it
-- ---------------------------------------------------------------------------
INSERT INTO groups (id, org_id, name, node_type, path, parent_id) VALUES
  -- Org root
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'Acme Corp', 'org', 'acme', NULL),

  -- Departments
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'Finance', 'department', 'acme.finance', '10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'Engineering', 'department', 'acme.engineering', '10000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
   'Operations', 'department', 'acme.ops', '10000000-0000-0000-0000-000000000001'),

  -- Finance teams
  ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001',
   'Accounts Payable', 'team', 'acme.finance.ap', '10000000-0000-0000-0000-000000000002'),
  ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001',
   'Treasury', 'team', 'acme.finance.treasury', '10000000-0000-0000-0000-000000000002'),

  -- Engineering teams
  ('10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001',
   'Platform', 'team', 'acme.engineering.platform', '10000000-0000-0000-0000-000000000003'),
  ('10000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001',
   'Data', 'team', 'acme.engineering.data', '10000000-0000-0000-0000-000000000003'),

  -- Ops teams
  ('10000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001',
   'IT', 'team', 'acme.ops.it', '10000000-0000-0000-0000-000000000004');

-- ---------------------------------------------------------------------------
-- AGENTS (~15)
-- ---------------------------------------------------------------------------
INSERT INTO agents (id, org_id, name, email, domain) VALUES
  -- Finance agents (AP team)
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'ap-agent-1', 'ap1@acme.corp', 'finance'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'ap-agent-2', 'ap2@acme.corp', 'finance'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'ap-agent-3', 'ap3@acme.corp', 'finance'),

  -- Finance agents (Treasury team)
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
   'treasury-agent-1', 'tr1@acme.corp', 'finance'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
   'treasury-agent-2', 'tr2@acme.corp', 'finance'),

  -- Comms agents (Platform team)
  ('20000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001',
   'comms-agent-1', 'cm1@acme.corp', 'communication'),
  ('20000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001',
   'comms-agent-2', 'cm2@acme.corp', 'communication'),
  ('20000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001',
   'comms-agent-3', 'cm3@acme.corp', 'communication'),

  -- Data agents
  ('20000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001',
   'data-agent-1', 'da1@acme.corp', 'communication'),
  ('20000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001',
   'data-agent-2', 'da2@acme.corp', 'communication'),

  -- Delegation agents (IT team)
  ('20000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001',
   'deleg-agent-1', 'dg1@acme.corp', 'agent_delegation'),
  ('20000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001',
   'deleg-agent-2', 'dg2@acme.corp', 'agent_delegation'),
  ('20000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001',
   'deleg-agent-3', 'dg3@acme.corp', 'agent_delegation'),

  -- Cross-domain agents (Engineering / Platform)
  ('20000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000001',
   'platform-agent-1', 'pl1@acme.corp', 'agent_delegation'),
  ('20000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000001',
   'platform-agent-2', 'pl2@acme.corp', 'finance');

-- ---------------------------------------------------------------------------
-- AGENT GROUP MEMBERSHIPS
-- ---------------------------------------------------------------------------
INSERT INTO agent_group_memberships (agent_id, group_id) VALUES
  -- AP agents → finance dept + AP team
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000011'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000011'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000011'),

  -- Treasury agents → finance dept + treasury team
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000012'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000012'),

  -- Comms agents → engineering dept + platform team
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000013'),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000013'),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000008', '10000000-0000-0000-0000-000000000013'),

  -- Data agents → engineering dept + data team
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000009', '10000000-0000-0000-0000-000000000014'),
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000010', '10000000-0000-0000-0000-000000000014'),

  -- Delegation agents → ops dept + IT team
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000011', '10000000-0000-0000-0000-000000000015'),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000012', '10000000-0000-0000-0000-000000000015'),
  ('20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000004'),
  ('20000000-0000-0000-0000-000000000013', '10000000-0000-0000-0000-000000000015'),

  -- Platform cross-domain → engineering + platform
  ('20000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000003'),
  ('20000000-0000-0000-0000-000000000014', '10000000-0000-0000-0000-000000000013'),
  ('20000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000002'),
  ('20000000-0000-0000-0000-000000000015', '10000000-0000-0000-0000-000000000013');

-- ---------------------------------------------------------------------------
-- ACTION TYPES
-- ---------------------------------------------------------------------------
INSERT INTO action_types (id, domain, name, description) VALUES
  -- Finance
  ('30000000-0000-0000-0000-000000000001', 'finance', 'purchase.initiate',   'Start a new purchase'),
  ('30000000-0000-0000-0000-000000000002', 'finance', 'purchase.recurring',  'Schedule a recurring purchase'),
  ('30000000-0000-0000-0000-000000000003', 'finance', 'budget.allocate',     'Allocate budget to a cost center'),
  ('30000000-0000-0000-0000-000000000004', 'finance', 'refund.request',      'Request a refund'),
  ('30000000-0000-0000-0000-000000000005', 'finance', 'expense.submit',      'Submit an expense report'),
  -- Communication
  ('30000000-0000-0000-0000-000000000006', 'communication', 'email.send',         'Send an email'),
  ('30000000-0000-0000-0000-000000000007', 'communication', 'email.read',         'Read emails'),
  ('30000000-0000-0000-0000-000000000008', 'communication', 'slack.send',         'Post a Slack message'),
  ('30000000-0000-0000-0000-000000000009', 'communication', 'meeting.schedule',   'Schedule a calendar meeting'),
  ('30000000-0000-0000-0000-000000000010', 'communication', 'document.share',     'Share a document'),
  -- Agent Delegation
  ('30000000-0000-0000-0000-000000000011', 'agent_delegation', 'agent.provision', 'Provision a new agent'),
  ('30000000-0000-0000-0000-000000000012', 'agent_delegation', 'agent.delegate',  'Delegate a task to an agent'),
  ('30000000-0000-0000-0000-000000000013', 'agent_delegation', 'agent.revoke',    'Revoke agent access'),
  ('30000000-0000-0000-0000-000000000014', 'agent_delegation', 'agent.monitor',   'Monitor agent activity');

-- ---------------------------------------------------------------------------
-- DIMENSION DEFINITIONS (sample subset — key ones per domain)
-- ---------------------------------------------------------------------------
INSERT INTO dimension_definitions
  (id, action_type_id, dimension_name, kind,
   numeric_max, rate_window, set_members, bool_default,
   temporal_start, temporal_end, temporal_expiry) VALUES

  -- purchase.initiate: amount (numeric), vendor (set), requires_human_approval (bool), allowed_window (temporal)
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   'amount', 'numeric', 5000, NULL, NULL, NULL, NULL, NULL, NULL),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001',
   'vendor', 'set', NULL, NULL, ARRAY['AWS','Azure','GCP'], NULL, NULL, NULL, NULL),
  ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000001',
   'requires_human_approval', 'boolean', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
  ('40000000-0000-0000-0000-000000000004', '30000000-0000-0000-0000-000000000001',
   'allowed_window', 'temporal', NULL, NULL, NULL, NULL, '09:00', '17:00', '2026-06-01'),

  -- purchase.recurring: rate (rate), amount (numeric)
  ('40000000-0000-0000-0000-000000000005', '30000000-0000-0000-0000-000000000002',
   'rate', 'rate', 100, '1 day', NULL, NULL, NULL, NULL, NULL),
  ('40000000-0000-0000-0000-000000000006', '30000000-0000-0000-0000-000000000002',
   'amount', 'numeric', 5000, NULL, NULL, NULL, NULL, NULL, NULL),

  -- budget.allocate: amount (numeric), requires_human_approval (bool)
  ('40000000-0000-0000-0000-000000000007', '30000000-0000-0000-0000-000000000003',
   'amount', 'numeric', 5000, NULL, NULL, NULL, NULL, NULL, NULL),
  ('40000000-0000-0000-0000-000000000008', '30000000-0000-0000-0000-000000000003',
   'requires_human_approval', 'boolean', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),

  -- email.send: rate (rate), allowed_window (temporal)
  ('40000000-0000-0000-0000-000000000009', '30000000-0000-0000-0000-000000000006',
   'rate', 'rate', 100, '1 day', NULL, NULL, NULL, NULL, NULL),
  ('40000000-0000-0000-0000-000000000010', '30000000-0000-0000-0000-000000000006',
   'allowed_window', 'temporal', NULL, NULL, NULL, NULL, '09:00', '17:00', NULL),

  -- document.share: set (recipients domain), boolean (external_allowed)
  ('40000000-0000-0000-0000-000000000011', '30000000-0000-0000-0000-000000000010',
   'recipient_domain', 'set', NULL, NULL, ARRAY['acme.corp','partner.com'], NULL, NULL, NULL, NULL),
  ('40000000-0000-0000-0000-000000000012', '30000000-0000-0000-0000-000000000010',
   'external_allowed', 'boolean', NULL, NULL, NULL, FALSE, NULL, NULL, NULL),

  -- agent.provision: requires_human_approval (bool), allowed_window (temporal)
  ('40000000-0000-0000-0000-000000000013', '30000000-0000-0000-0000-000000000011',
   'requires_human_approval', 'boolean', NULL, NULL, NULL, TRUE, NULL, NULL, NULL),
  ('40000000-0000-0000-0000-000000000014', '30000000-0000-0000-0000-000000000011',
   'allowed_window', 'temporal', NULL, NULL, NULL, NULL, '09:00', '17:00', '2026-06-01'),

  -- agent.delegate: rate (rate), requires_human_approval (bool)
  ('40000000-0000-0000-0000-000000000015', '30000000-0000-0000-0000-000000000012',
   'rate', 'rate', 10, '1 day', NULL, NULL, NULL, NULL, NULL),
  ('40000000-0000-0000-0000-000000000016', '30000000-0000-0000-0000-000000000012',
   'requires_human_approval', 'boolean', NULL, NULL, NULL, TRUE, NULL, NULL, NULL);

-- ---------------------------------------------------------------------------
-- POLICIES & VERSIONS
-- Policies: org-wide baseline → department narrowing → team tightening
--
-- Envelope model: AP team agent effective limit = min(5000 org, 2000 dept, 1000 team) = 1000
-- Deny from org-level always wins (explicit deny beats inherited allow)
-- ---------------------------------------------------------------------------

-- POLICY 1: Org-wide finance baseline — allow purchase.initiate up to $5000
INSERT INTO policies (id, org_id, name, domain, effect) VALUES
  ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001',
   'acme-finance-baseline', 'finance', 'allow');

INSERT INTO policy_versions (id, policy_id, version_number, constraints, cedar_source, created_by) VALUES
  ('60000000-0000-0000-0000-000000000001',
   '50000000-0000-0000-0000-000000000001', 1,
   '[{"action":"purchase.initiate","dimension":"amount","kind":"numeric","max":5000},
     {"action":"purchase.initiate","dimension":"vendor","kind":"set","members":["AWS","Azure","GCP"]},
     {"action":"purchase.initiate","dimension":"allowed_window","kind":"temporal","start":"09:00","end":"17:00","expiry":"2026-06-01"}]',
   'permit (
  principal in Group::"acme",
  action == Action::"purchase.initiate",
  resource
)
when {
  context.amount <= 5000 &&
  context.vendor in ["AWS", "Azure", "GCP"] &&
  context.hour >= 9 && context.hour < 17 &&
  context.request_date < "2026-06-01"
};',
   NULL);

UPDATE policies SET active_version_id = '60000000-0000-0000-0000-000000000001'
  WHERE id = '50000000-0000-0000-0000-000000000001';

-- POLICY 2: Finance dept — narrows amount to $2000, adds human approval flag
INSERT INTO policies (id, org_id, name, domain, effect) VALUES
  ('50000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001',
   'finance-dept-purchase-limit', 'finance', 'allow');

INSERT INTO policy_versions (id, policy_id, version_number, constraints, cedar_source, created_by) VALUES
  ('60000000-0000-0000-0000-000000000002',
   '50000000-0000-0000-0000-000000000002', 1,
   '[{"action":"purchase.initiate","dimension":"amount","kind":"numeric","max":2000},
     {"action":"purchase.initiate","dimension":"requires_human_approval","kind":"boolean","value":true}]',
   'permit (
  principal in Group::"acme.finance",
  action == Action::"purchase.initiate",
  resource
)
when {
  context.amount <= 2000 &&
  context.requires_human_approval == true
};',
   '20000000-0000-0000-0000-000000000004');

UPDATE policies SET active_version_id = '60000000-0000-0000-0000-000000000002'
  WHERE id = '50000000-0000-0000-0000-000000000002';

-- POLICY 3: AP team — further narrows to $1000, only AWS vendor allowed
INSERT INTO policies (id, org_id, name, domain, effect) VALUES
  ('50000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001',
   'ap-team-purchase-limit', 'finance', 'allow');

INSERT INTO policy_versions (id, policy_id, version_number, constraints, cedar_source, created_by) VALUES
  ('60000000-0000-0000-0000-000000000003',
   '50000000-0000-0000-0000-000000000003', 1,
   '[{"action":"purchase.initiate","dimension":"amount","kind":"numeric","max":1000},
     {"action":"purchase.initiate","dimension":"vendor","kind":"set","members":["AWS"]}]',
   'permit (
  principal in Group::"acme.finance.ap",
  action == Action::"purchase.initiate",
  resource
)
when {
  context.amount <= 1000 &&
  context.vendor in ["AWS"]
};',
   '20000000-0000-0000-0000-000000000004');

UPDATE policies SET active_version_id = '60000000-0000-0000-0000-000000000003'
  WHERE id = '50000000-0000-0000-0000-000000000003';

-- POLICY 4: Agent-level override — ap-agent-1 gets $500 cap (tightest envelope)
INSERT INTO policies (id, org_id, name, domain, effect) VALUES
  ('50000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001',
   'ap-agent-1-purchase-cap', 'finance', 'allow');

INSERT INTO policy_versions (id, policy_id, version_number, constraints, cedar_source, created_by) VALUES
  ('60000000-0000-0000-0000-000000000004',
   '50000000-0000-0000-0000-000000000004', 1,
   '[{"action":"purchase.initiate","dimension":"amount","kind":"numeric","max":500}]',
   'permit (
  principal == Agent::"ap-agent-1",
  action == Action::"purchase.initiate",
  resource
)
when {
  context.amount <= 500
};',
   '20000000-0000-0000-0000-000000000004');

UPDATE policies SET active_version_id = '60000000-0000-0000-0000-000000000004'
  WHERE id = '50000000-0000-0000-0000-000000000004';

-- POLICY 5: Org-level DENY after-hours purchasing (explicit deny beats inherited allows)
INSERT INTO policies (id, org_id, name, domain, effect) VALUES
  ('50000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001',
   'acme-deny-after-hours-purchase', 'finance', 'deny');

INSERT INTO policy_versions (id, policy_id, version_number, constraints, cedar_source, created_by) VALUES
  ('60000000-0000-0000-0000-000000000005',
   '50000000-0000-0000-0000-000000000005', 1,
   '[{"action":"purchase.initiate","dimension":"allowed_window","kind":"temporal","start":"17:00","end":"09:00","deny":true}]',
   'forbid (
  principal in Group::"acme",
  action == Action::"purchase.initiate",
  resource
)
when {
  context.hour >= 17 || context.hour < 9
};',
   NULL);

UPDATE policies SET active_version_id = '60000000-0000-0000-0000-000000000005'
  WHERE id = '50000000-0000-0000-0000-000000000005';

-- POLICY 6: Engineering comms — email rate limit + business hours
INSERT INTO policies (id, org_id, name, domain, effect) VALUES
  ('50000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001',
   'engineering-comms-baseline', 'communication', 'allow');

INSERT INTO policy_versions (id, policy_id, version_number, constraints, cedar_source, created_by) VALUES
  ('60000000-0000-0000-0000-000000000006',
   '50000000-0000-0000-0000-000000000006', 1,
   '[{"action":"email.send","dimension":"rate","kind":"rate","max":100,"window":"1 day"},
     {"action":"email.send","dimension":"allowed_window","kind":"temporal","start":"09:00","end":"17:00"},
     {"action":"document.share","dimension":"recipient_domain","kind":"set","members":["acme.corp","partner.com"]},
     {"action":"document.share","dimension":"external_allowed","kind":"boolean","value":false}]',
   'permit (
  principal in Group::"acme.engineering",
  action in [Action::"email.send", Action::"document.share"],
  resource
)
when {
  (action == Action::"email.send" &&
     context.daily_send_count < 100 &&
     context.hour >= 9 && context.hour < 17) ||
  (action == Action::"document.share" &&
     context.recipient_domain in ["acme.corp", "partner.com"] &&
     context.external_allowed == false)
};',
   NULL);

UPDATE policies SET active_version_id = '60000000-0000-0000-0000-000000000006'
  WHERE id = '50000000-0000-0000-0000-000000000006';

-- POLICY 7: IT team delegation — agent.provision requires human approval, business hours only
INSERT INTO policies (id, org_id, name, domain, effect) VALUES
  ('50000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001',
   'it-delegation-baseline', 'agent_delegation', 'allow');

INSERT INTO policy_versions (id, policy_id, version_number, constraints, cedar_source, created_by) VALUES
  ('60000000-0000-0000-0000-000000000007',
   '50000000-0000-0000-0000-000000000007', 1,
   '[{"action":"agent.provision","dimension":"requires_human_approval","kind":"boolean","value":true},
     {"action":"agent.provision","dimension":"allowed_window","kind":"temporal","start":"09:00","end":"17:00","expiry":"2026-06-01"},
     {"action":"agent.delegate","dimension":"rate","kind":"rate","max":10,"window":"1 day"},
     {"action":"agent.delegate","dimension":"requires_human_approval","kind":"boolean","value":true}]',
   'permit (
  principal in Group::"acme.ops.it",
  action in [Action::"agent.provision", Action::"agent.delegate", Action::"agent.monitor"],
  resource
)
when {
  (action == Action::"agent.provision" &&
     context.requires_human_approval == true &&
     context.hour >= 9 && context.hour < 17 &&
     context.request_date < "2026-06-01") ||
  (action == Action::"agent.delegate" &&
     context.daily_delegate_count < 10 &&
     context.requires_human_approval == true) ||
  (action == Action::"agent.monitor")
};',
   NULL);

UPDATE policies SET active_version_id = '60000000-0000-0000-0000-000000000007'
  WHERE id = '50000000-0000-0000-0000-000000000007';

-- POLICY 8: v2 of finance-dept-purchase-limit (policy versioning demo)
-- Raises dept cap from 2000 → 3000 after finance director approval
INSERT INTO policy_versions (id, policy_id, version_number, constraints, cedar_source, created_by) VALUES
  ('60000000-0000-0000-0000-000000000008',
   '50000000-0000-0000-0000-000000000002', 2,
   '[{"action":"purchase.initiate","dimension":"amount","kind":"numeric","max":3000},
     {"action":"purchase.initiate","dimension":"requires_human_approval","kind":"boolean","value":true}]',
   'permit (
  principal in Group::"acme.finance",
  action == Action::"purchase.initiate",
  resource
)
when {
  context.amount <= 3000 &&
  context.requires_human_approval == true
};',
   '20000000-0000-0000-0000-000000000004');
-- NOTE: active_version_id still points to v1 (60000000-...002); update to promote v2:
-- UPDATE policies SET active_version_id = '60000000-0000-0000-0000-000000000008' WHERE id = '50000000-0000-0000-0000-000000000002';

-- ---------------------------------------------------------------------------
-- POLICY ASSIGNMENTS (policy → group or agent)
-- ---------------------------------------------------------------------------
INSERT INTO policy_assignments (id, policy_id, policy_version_id, group_id, agent_id) VALUES
  -- Org-wide: finance baseline + deny after-hours
  ('70000000-0000-0000-0000-000000000001',
   '50000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001',
   '10000000-0000-0000-0000-000000000001', NULL),
  ('70000000-0000-0000-0000-000000000002',
   '50000000-0000-0000-0000-000000000005', '60000000-0000-0000-0000-000000000005',
   '10000000-0000-0000-0000-000000000001', NULL),

  -- Finance dept
  ('70000000-0000-0000-0000-000000000003',
   '50000000-0000-0000-0000-000000000002', '60000000-0000-0000-0000-000000000002',
   '10000000-0000-0000-0000-000000000002', NULL),

  -- AP team
  ('70000000-0000-0000-0000-000000000004',
   '50000000-0000-0000-0000-000000000003', '60000000-0000-0000-0000-000000000003',
   '10000000-0000-0000-0000-000000000011', NULL),

  -- ap-agent-1 individual cap
  ('70000000-0000-0000-0000-000000000005',
   '50000000-0000-0000-0000-000000000004', '60000000-0000-0000-0000-000000000004',
   NULL, '20000000-0000-0000-0000-000000000001'),

  -- Engineering comms
  ('70000000-0000-0000-0000-000000000006',
   '50000000-0000-0000-0000-000000000006', '60000000-0000-0000-0000-000000000006',
   '10000000-0000-0000-0000-000000000003', NULL),

  -- IT delegation
  ('70000000-0000-0000-0000-000000000007',
   '50000000-0000-0000-0000-000000000007', '60000000-0000-0000-0000-000000000007',
   '10000000-0000-0000-0000-000000000015', NULL);

-- ---------------------------------------------------------------------------
-- DECISION LOG (sample evaluations)
-- bundle_hash = sha256 of concatenated cedar_source for all active policies in scope
-- (In practice, computed by the engine at evaluation time; here we use placeholder hashes)
-- ---------------------------------------------------------------------------
INSERT INTO decision_log
  (id, evaluated_at, agent_id, action_type_id, request_context, bundle_hash, outcome, reason, matched_version_id)
VALUES
  -- ap-agent-1 requests $400 purchase from AWS at 10am → allow (within all envelopes)
  ('80000000-0000-0000-0000-000000000001',
   '2026-04-01 10:15:00+00',
   '20000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001',
   '{"amount":400,"vendor":"AWS","hour":10,"requires_human_approval":true,"request_date":"2026-04-01"}',
   'a3f2c1d9e4b07856...', 'allow', 'ap-agent-1-purchase-cap v1',
   '60000000-0000-0000-0000-000000000004'),

  -- ap-agent-1 requests $800 purchase → deny (exceeds agent cap of $500)
  ('80000000-0000-0000-0000-000000000002',
   '2026-04-01 11:00:00+00',
   '20000000-0000-0000-0000-000000000001',
   '30000000-0000-0000-0000-000000000001',
   '{"amount":800,"vendor":"AWS","hour":11,"requires_human_approval":true,"request_date":"2026-04-01"}',
   'a3f2c1d9e4b07856...', 'deny', 'amount 800 exceeds agent cap 500 (ap-agent-1-purchase-cap v1)',
   '60000000-0000-0000-0000-000000000004'),

  -- ap-agent-2 requests $900 from Azure at 10am → deny (AP team allows only AWS)
  ('80000000-0000-0000-0000-000000000003',
   '2026-04-01 10:30:00+00',
   '20000000-0000-0000-0000-000000000002',
   '30000000-0000-0000-0000-000000000001',
   '{"amount":900,"vendor":"Azure","hour":10,"requires_human_approval":true,"request_date":"2026-04-01"}',
   'a3f2c1d9e4b07856...', 'deny', 'vendor Azure not in AP team allowed set [AWS]',
   '60000000-0000-0000-0000-000000000003'),

  -- treasury-agent-1 requests $1800 from GCP at 2pm → allow (within dept $2000 cap)
  ('80000000-0000-0000-0000-000000000004',
   '2026-04-01 14:00:00+00',
   '20000000-0000-0000-0000-000000000004',
   '30000000-0000-0000-0000-000000000001',
   '{"amount":1800,"vendor":"GCP","hour":14,"requires_human_approval":true,"request_date":"2026-04-01"}',
   'a3f2c1d9e4b07856...', 'allow', 'finance-dept-purchase-limit v1',
   '60000000-0000-0000-0000-000000000002'),

  -- comms-agent-1 tries to send email at 8pm → deny (after-hours forbid)
  ('80000000-0000-0000-0000-000000000005',
   '2026-04-01 20:00:00+00',
   '20000000-0000-0000-0000-000000000006',
   '30000000-0000-0000-0000-000000000006',
   '{"daily_send_count":5,"hour":20}',
   'b7e3a2f1c0d94712...', 'deny', 'acme-deny-after-hours: hour 20 outside [9,17)',
   '60000000-0000-0000-0000-000000000005'),

  -- deleg-agent-1 provisions new agent with human approval at 11am → allow
  ('80000000-0000-0000-0000-000000000006',
   '2026-04-02 11:00:00+00',
   '20000000-0000-0000-0000-000000000011',
   '30000000-0000-0000-0000-000000000011',
   '{"requires_human_approval":true,"hour":11,"request_date":"2026-04-02"}',
   'c9d4b3e2f1a08523...', 'allow', 'it-delegation-baseline v1',
   '60000000-0000-0000-0000-000000000007');

COMMIT;
