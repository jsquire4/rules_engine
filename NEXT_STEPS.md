# Rules Engine Prototype — Next Steps

## Current State

Skeleton UI prototype with neumorphic styling, 6 tabbed surfaces, and agent-assisted chat sidebar. All data stripped — components render empty states with API contract comments pointing to schema tables and endpoint shapes. CSS/layout/interactions are production-ready reference for the building agent.

Files committed:
- `schema.sql` — PostgreSQL schema (ltree, policy versioning, decision log)
- `seed.sql` — Acme Corp mock org (~15 agents, 7 policies, 6 decisions)
- `BUILD_PLAN.md` — 4-wave architecture plan (Rust/Kotlin/React)
- `frontend/prototype.html` — Neumorphic admin console skeleton

---

## Phase 1: Monorepo + Services Scaffold

**Goal:** `docker-compose up` boots all three services + Postgres with seed data.

- [ ] Create monorepo directory structure: `engine/` (Rust), `management/` (Kotlin), `frontend/` (Next.js), `contracts/` (OpenAPI)
- [ ] `docker-compose.yml` with PostgreSQL 16 + pgcrypto + ltree, Rust axum server, Kotlin Ktor server, Next.js dev server
- [ ] Flyway migrations from `schema.sql`, seed data from `seed.sql`
- [ ] Rust: `POST /check` endpoint — Cedar policy evaluation via `cedar-policy` 4.9.x
- [ ] Kotlin: CRUD endpoints — policies, policy_versions, agents, groups, assignments, decision_log
- [ ] OpenAPI spec auto-generated from Ktor → TypeScript client for frontend

**Done when:** `docker-compose up` runs, seed data loads, Kotlin CRUD works, Rust `/check` returns permit/deny.

---

## Phase 2: Frontend — Real Next.js App

**Goal:** Port the prototype skeleton to a real Next.js app with live API data.

- [ ] Next.js 14 (App Router) + Tailwind + shadcn/ui scaffolding
- [ ] Port neumorphic design tokens and CSS from `prototype.html` to Tailwind config + global styles
- [ ] Port all 6 surface components to React/TypeScript (using prototype as reference, NOT copying verbatim)
- [ ] Wire each surface to its API endpoint (OpenAPI-generated TypeScript client)
- [ ] Replace prototype's Babel-compiled JSX with proper bundled components
- [ ] Cedar WASM loaded in Web Worker via `comlink` for client-side validation

**Done when:** All 6 tabs render with live data from Kotlin management plane.

---

## Phase 3: Structured Builder + Code Editor

**Goal:** Full authoring loop — create policy via builder, see Cedar, validate.

- [ ] Two-panel envelope editor with live parent ceiling resolution
- [ ] All dimension controls: numeric (slider+input), set (multi-select), boolean (toggle), rate (count+window), temporal (time range+expiry)
- [ ] Real-time zod validation against parent bounds
- [ ] Monaco Editor (`@monaco-editor/react`) with Cedar Monarch tokenizer
- [ ] Bidirectional sync: structured builder edits ↔ generated Cedar source
- [ ] Save creates immutable `policy_version` with SHA-256 checksum

**Done when:** Can create a policy via builder, see generated Cedar, save as versioned policy.

---

## Phase 4: REPL + Versioning + RSoP

**Goal:** Test policies, view history, understand conflicts.

- [ ] REPL: agent/action selectors populated from API, context params from dimension_definitions
- [ ] Cedar WASM evaluation client-side (<1ms) with execution trace
- [ ] Batch mode: JSON test suite editor, pass/fail grid, saveable regression suites
- [ ] Version timeline: immutable versions, diff between any two, one-click rollback
- [ ] RSoP: resolved policy set via ltree ancestry, color-coded conflict table, effective envelope summary

**Done when:** Full test → version → rollback → conflict resolution loop works end-to-end.

---

## Phase 5: Agent-Assisted Builder

**Goal:** Natural language policy authoring with validation.

- [ ] Vercel AI SDK (`useChat`) with provider selector (Anthropic/OpenAI/Google)
- [ ] NL → Policy: user describes rules → Cedar + constraints + test cases generated
- [ ] Three-tier validation: auto-generated tests via WASM → Cedar formal validation → plain-language summary
- [ ] Policy analysis: "what can agent X do?" / "why was this denied?"
- [ ] Chat panel alongside any surface (right sidebar, collapsible)

**Done when:** Can describe a rule in English, get valid Cedar with test cases, ask about agent capabilities.

---

## Phase 6: Polish + Dry-Run

**Goal:** Production-ready authoring loop.

- [ ] Dry-run replay: select rule change + time window → see which historical decisions would change
- [ ] Assignment UI: drag-and-drop policy → group/agent with cascade preview
- [ ] Dashboard generation via agent (stretch)
- [ ] Accessibility audit, keyboard navigation, screen reader support
- [ ] Performance: lazy-load surfaces, memoize WASM evaluations, virtualize long lists

---

## Key Decisions Still Open

1. **Cedar vs OPA toggle** — Do we support both engines or Cedar-only for prototype?
2. **Auth/RBAC for the console** — Who can edit policies vs. view-only?
3. **Deployment target** — Docker Compose only, or also Kubernetes manifests?
4. **Real-time sync** — WebSocket for multi-user editing, or optimistic locking?
