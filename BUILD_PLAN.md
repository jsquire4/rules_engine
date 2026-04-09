# Rules Engine — Build Plan

**Approach: Option C — WASM for REPL, Kotlin for persistence, Rust for gate**

Cedar runs three ways: WASM in the browser (instant REPL feedback), JNI in Kotlin (server-side validation and persistence), native Rust (production gate with Check API). This validates the full production architecture while keeping the dev experience fast.

---

## Wave 1 — Foundation (get all three services running)

### Monorepo + Docker Compose
- Directory structure: `engine/` (Rust), `management/` (Kotlin), `frontend/` (React), `contracts/` (OpenAPI)
- `docker-compose.yml` with: PostgreSQL 16, Rust axum server, Kotlin Ktor server, Next.js dev server
- Hot-reload: `cargo-watch` (Rust), Ktor dev mode (Kotlin), `next dev` (React)
- Inter-service: REST everywhere, Kotlin → Rust via HTTP

### Rust Cedar Engine
- Cargo workspace: `crates/engine/` (pure Cedar logic), `crates/api-server/` (axum HTTP)
- Single `POST /check` endpoint: `(agent_id, action, resource, context) → permit/deny + reasons`
- `cedar-policy` 4.9.x, policies loaded from PostgreSQL or filesystem
- `Arc<RwLock<PolicySet>>` for hot-reload without restart

### Kotlin Management Plane
- Ktor + Kotlin serialization + Exposed ORM + Flyway migrations
- `cedar-java` 4.8.0 for in-process policy validation
- CRUD endpoints: policies, policy_versions, agents, groups, assignments, decision_log
- OpenAPI spec auto-generated from Ktor routes → TypeScript client generated for frontend

### React Frontend Shell
- Next.js 14+ (App Router) + Tailwind + shadcn/ui
- Cedar WASM loaded in Web Worker via `comlink`
- Shell layout: sidebar nav (domains), main content area, collapsible panels

### Database
- PostgreSQL schema via Flyway migrations (from `schema.sql`)
- Seed data loaded (from `seed.sql` — Acme Corp org with ~15 agents, 7+ policies)

**Wave 1 done when:** All three services run via `docker-compose up`, seed data loads, React app renders, WASM evaluates a policy client-side, Rust `/check` endpoint returns permit/deny.

---

## Wave 2 — Structured Builder + REPL

### Structured Builder (primary authoring surface)
- Two-panel envelope editor:
  - Left panel (read-only): parent envelope with all dimensions, color-coded inheritance source
  - Right panel (editable): child envelope, each dimension with appropriate control
- Dimension controls:
  - Numeric: slider + number input (shadcn slider + input), parent max as ceiling
  - Set: multi-select from parent's universe (react-select), disabled items outside parent set
  - Boolean: toggle switch (shadcn switch)
  - Rate: number input + window selector
  - Temporal: time range picker + date picker (mantine dates or react-day-picker)
- Real-time validation: zod schema derived from parent bounds, react-hook-form, red borders on violation
- Save generates Cedar source + structured JSON constraints, creates new immutable policy_version

### Code Editor
- Monaco Editor (@monaco-editor/react) with custom Cedar Monarch tokenizer
- OPA/Rego syntax support (community grammar)
- Live validation: Cedar WASM validates on debounced change (300ms), push diagnostics via `setModelMarkers()`
- Toggle between structured ↔ code view (bidirectional: edits in one reflect in the other)

### REPL Test Harness
- Two-panel: input form (agent selector, action type, context params) + result display (permit/deny badge, reasons, matched policies)
- Cedar WASM evaluation — client-side, instant (<1ms)
- Batch mode: define N test cases as JSON array, run all, show pass/fail grid
- Test cases saveable for regression

### Policy Versioning
- Immutable versions with auto-incrementing version_number
- SHA-256 checksum auto-computed by PostgreSQL (`GENERATED ALWAYS AS digest()`)
- Version history panel: list all versions, diff view between any two, one-click rollback (promotes old version)
- Bundle hash: SHA-256 of concatenated cedar_source for all active policies in scope, stamped on decision log entries

### Conflict Visualization (RSoP)
- Select an agent → see all policies that apply (resolved via group ancestry + ltree)
- Color-coded table: each row is a matching policy, columns for hierarchy level, effect, contributing conditions
- Highlight conflicts: "this permit from Team:Finance is overridden by this forbid from Org:Global"
- Effective envelope summary: the intersection of all constraints, rendered as the structured builder in read-only mode

**Wave 2 done when:** Can create a policy via structured builder, see generated Cedar, test it in the REPL, view version history, see conflict resolution for any agent.

---

## Wave 3 — Agent-Assisted Builder

### Chat Interface
- Vercel AI SDK (`ai` package) with `useChat` hook
- LLM-agnostic: provider selector (OpenAI, Anthropic, Google) with API key configuration
- Chat panel embedded alongside structured builder and code editor
- Conversation history persisted per session

### NL → Policy Generation (Mode 1)
- User describes rules in natural language
- Agent generates Cedar/OPA source + structured constraint JSON
- Output presented in structured builder view for review
- Three-tier validation before showing to user:
  1. Auto-generated test cases (positive + negative) run via Cedar WASM
  2. Cedar formal validation (schema check, unreachable rule detection)
  3. Plain-language summary of what the policy does

### Policy Analysis / Explanation (Mode 2)
- User asks "what can agent X do?" or "why was this denied?"
- Agent reads applicable policies, resolves inheritance chain
- Returns plain-language explanation with references to specific rules

### Dashboard Generation (Mode 3 — stretch)
- User describes monitoring needs
- Agent derives dashboard from policy dimensions (queries, visualizations, alert thresholds)
- Renders using recharts or similar
- Dashboards scoped to user's specific policy configuration

**Wave 3 done when:** Can describe a rule in English, get valid Cedar generated with test cases, ask "what can ap-agent-1 do?" and get an accurate answer.

---

## Wave 4 — Polish

### Dry-Run Replay
- Interface: select a rule change, select a time window, see which historical decisions would change
- Stub: UI with mock replay data
- Stretch: actual replay via event sourcing (chronological replay through Cedar WASM with state tracking)

### Batch Test Mode
- JSON test suite editor
- Run all tests, show pass/fail matrix
- Saveable as regression suite, re-run on policy changes

### Rollback UI
- One-click rollback to any previous policy version
- Shows diff of what changes
- Dry-run preview before rollback ("this would affect N agents, changing M decisions")

### Code View Toggle
- From any structured builder view, toggle "Show Cedar" to see generated source
- Editable in code view, changes reflected back in structured view
- Bidirectional sync with validation

**Wave 4 done when:** Full authoring loop works end-to-end — create, test, deploy, monitor, rollback.

---

## Tech Stack Summary

| Component | Technology |
|-----------|-----------|
| Rust Cedar Engine | `cedar-policy` 4.9, axum, tokio |
| Kotlin Management | Ktor, cedar-java 4.8, Exposed ORM, Flyway, PostgreSQL |
| React Frontend | Next.js 14+, Tailwind, shadcn/ui, @monaco-editor/react |
| Cedar in Browser | `@cedar-policy/cedar-wasm`, comlink (Web Worker) |
| LLM Chat | Vercel AI SDK (`ai`), provider-agnostic |
| Forms | react-hook-form, zod, react-select |
| Visualization | @xyflow/react (trees), shadcn Table + Badge (conflict table) |
| Database | PostgreSQL 16 + pgcrypto + ltree |
| Infra | Docker Compose (local dev) |
| Contracts | OpenAPI (generated from Ktor) → TypeScript client |

---

## Key Files Already Created

- `schema.sql` — PostgreSQL schema with ltree hierarchy, policy versioning, decision log
- `seed.sql` — Acme Corp mock org (~15 agents, 7 policies, 6 sample decisions)
- `DEVLOG.md` — Architecture decisions and research synthesis
