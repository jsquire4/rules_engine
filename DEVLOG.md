# Rules Engine — Dev Log

## 2026-04-09 — Project kickoff and architecture decisions

### What we're building

A rules engine prototype that explores how Cedar + OPA-based policy evaluation works end-to-end: authoring rules, assigning them to agents via group hierarchy, testing them against real policy evaluation, and understanding how the system would operate at enterprise scale.

The goal is **depth of understanding**, not a fully wired production system. The UI should be deep enough to reveal what actually needs to be built. The rules engine itself must actually work — real Cedar evaluation, real policy decisions. Assignment and hierarchy can be stubbed, except where the test harness needs to evaluate a rule against a simulated agent identity.

### Architecture decisions

#### Decision 1: Three-language backend

**Gate / PDP sidecar → Rust**
- Cedar is written in Rust. Native integration, no WASM overhead, no FFI boundary.
- Sub-microsecond policy evaluation is realistic with native Cedar.
- Memory safety without GC pauses matters for a security-critical enforcement layer.
- The gate is infrastructure code: written once, changes rarely, must be fast and correct.
- This is the hot path — every agent action is evaluated here.

**Management plane → Java (Kotlin)**
- JNDI for LDAP/AD is built into the Java standard library. Spring Security, Spring LDAP, Kerberos — all battle-tested at Fortune 500 scale.
- Cedar has official Java bindings (`CedarJava` via JNI to the Rust core).
- Enterprise IT shops have JVM expertise. Customer teams can extend and integrate.
- Kotlin specifically: sealed classes for action types, data classes for schemas, coroutines for async. Better domain modeling than plain Java.
- This is the warm path — admin operations, hierarchy sync, rule authoring backend.

**Frontend → TypeScript / React**
- Standard frontend stack. Next.js + Tailwind + shadcn/ui.
- Same language as the agent SDKs (TypeScript SDK is a primary target).

**Why three languages:** The gate/PDP and management plane have fundamentally different runtime profiles. The gate evaluates policy on every agent action (sub-ms latency requirement). The management plane serves admin UIs and syncs with enterprise infrastructure (AD/LDAP integration requirement). These are different problems best solved by different tools. The Check API is the clean boundary between them — different languages on different sides of a well-defined API is natural architecture, not forced polyglot.

**Prototyping note:** Even in the prototype phase, we practice in the environment we'll perform in. The Rust gate, Kotlin backend, and React frontend are all present from the start. Integration complexity is part of what we're learning.

#### Decision 2: Three authoring surfaces (not four)

We are building **three** rule authoring surfaces:

**1. Structured builder (primary)**
An envelope-oriented interface. You see the full constraint space for an agent/group: every dimension, what's inherited vs locally set, what's petitionable vs hard wall. More like editing a configuration object than "creating a rule." Shows the full picture, not one rule at a time.

Chosen over visual builder (questionnaire/slider approach) because the path from structured builder to a simplified visual builder is clearer than the reverse. The structured builder reveals the actual shape of the data. Simplification comes later once we understand what can be simplified.

**2. Code editor**
Raw Cedar/Rego with syntax highlighting, validation, and live preview. For power users, platform engineers, and edge cases the structured builder can't handle. Also serves as the "show your work" view — toggle it on from either of the other surfaces to see what got generated. Gated by review/CI in production.

**3. Agent-assisted builder**
Works within both the structured builder and code editor contexts. Three modes:

- **Natural language → policy generation.** User describes what they want in English. Agent generates Cedar/OPA, presents it in the structured view, user confirms or adjusts. Onboarding accelerator.
- **Policy analysis and explanation.** User points at existing rules and asks "what can agent X actually do?" or "why was this denied?" Agent reads the Cedar policies, resolves inheritance, explains in plain language. Debugging companion.
- **Dashboard and monitoring generation.** User describes what they want to watch. Agent derives monitoring dashboards from the policy — the queries, visualizations, alert thresholds — scoped to the specific policy dimensions the user cares about. The key insight: every rule set implies things worth monitoring. Dashboards emerge from rules rather than being pre-built.

Agent-generated Cedar/OPA goes through the same validation and testing pipeline as hand-authored policies. The agent is a drafter, not an authorizer.

#### Decision 3: Rule versioning with cryptographic checksums

Every rule edit creates a new immutable version. The policy bundle (the complete set of rules that applied to an agent at a given moment) gets a cryptographic checksum (hash).

**Why this matters beyond basic versioning:** When an agent submits a transaction, the checksum of the active policy bundle is included in the transaction record. This creates a verifiable chain:

- After the fact, you can prove exactly which rules were in effect when an agent acted.
- In a dispute, both parties (agent owner and vendor) can reference the rule set hash to verify whether the purchase was authorized under the policies that were active at that time.
- If someone changes the rules after the fact, the checksum won't match — you can't backdate policy changes to retroactively authorize or deny a transaction.
- Rollback is one click: revert to any previous version, and the checksum trail shows exactly when the revert happened.

This is the "receipt of the whole process" applied to the governance layer itself. Not just "what happened in the transaction" but "what rules governed the transaction, provably."

#### Decision 4: Three domains for the prototype

**Finance** — actions that move or commit money.
| Action | Key dimensions |
|--------|---------------|
| `purchase.initiate` | amount (numeric), vendor (set), category (set), payment_method (set), requires_approval (boolean/threshold) |
| `purchase.recurring` | amount_per_period (numeric), period (temporal), vendor (set), auto_renew (boolean) |
| `budget.allocate` | amount (numeric), recipient_group (set), category (set), duration (temporal) |
| `refund.request` | amount (numeric), original_transaction_id (ref), reason (set) |
| `expense.submit` | amount (numeric), category (set), receipt_required (boolean/threshold) |

**Communication** — actions that send information to humans or external systems.
| Action | Key dimensions |
|--------|---------------|
| `email.send` | recipients (set + count), domain (set: internal/external), attachments (boolean), contains_pii (boolean) |
| `email.read` | mailboxes (set), date_range (temporal) |
| `slack.send` | channels (set), mentions (boolean), external_channels (boolean) |
| `meeting.schedule` | participants (set + count), duration (temporal), external_participants (boolean) |
| `document.share` | classification (set: public/internal/confidential), recipients (set), external (boolean) |

**Agent Delegation** — actions where one agent controls or provisions other agents.
| Action | Key dimensions |
|--------|---------------|
| `agent.provision` | max_child_count (numeric), envelope_scope (subset of parent), ttl (temporal), action_types (set) |
| `agent.delegate` | task_type (set), resource_scope (set), duration (temporal), can_sub_delegate (boolean) |
| `agent.revoke` | target_agent (ref), cascade (boolean) |
| `agent.monitor` | target_agents (set), metrics (set), alert_thresholds (numeric) |

The delegation domain is notable because the rules engine governs itself — the policy about how agents create sub-agents is evaluated by the same engine that evaluates those sub-agents' actions.

#### Decision 5: Conflict visualization

When rules from different hierarchy levels interact, the UI shows where conflicts exist and how they resolve. Not just "deny-overrides" as a principle — actually render it: "this permit from Team:Finance is overridden by this forbid from Org:Global because forbid wins." This is the RSoP (Resultant Set of Policy) view.

#### Decision 6: Test harness as REPL + dry-run mode

**REPL mode:** Select (or type) an agent identity, type an action with params, see the result instantly. Tweak params, run again. Rapid iteration. Batch mode: define N test cases, run all, show pass/fail. Batch becomes the regression suite when rules change.

**Dry-run mode:** Before deploying a rule change, run it against historical actions (from audit logs) and show what would have changed. "This new rule would have denied 3 of the last 100 purchases by the marketing team. Here they are." Safety net for confident rule changes.

### What's stubbed vs real

| Component | Status |
|-----------|--------|
| Cedar policy evaluation | **Real** — Rust-native Cedar engine |
| OPA policy evaluation | **Real** — for quantitative rules |
| Rule authoring (structured builder) | **Real UI** — generates actual Cedar/OPA |
| Rule authoring (code editor) | **Real UI** — edits actual Cedar/OPA with validation |
| Agent-assisted builder | **Real UI** — agent generates actual policies |
| Test harness / REPL | **Real** — evaluates against actual Cedar/OPA engine |
| Policy versioning + checksums | **Real** — immutable versions with hashes |
| Conflict visualization | **Real UI** — resolves actual policy inheritance |
| Dry-run mode | **Real** — replays against actual engine |
| Group hierarchy / org tree | **Stubbed** — sample org structure, not full management |
| Agent assignment | **Stubbed** — mock agent identities for testing |
| AD/LDAP integration | **Stubbed** — Kotlin backend structure in place, connectors not wired |
| Gate / PDP sidecar | **Stubbed** — Rust project structure, Check API defined, not deployed as sidecar |
| Payment / transaction integration | **Out of scope** |
| Storefront SDK | **Out of scope** |

### Open questions for next sessions

- How does the agent-assisted builder validate its own output against the subset invariant? Does it run the test harness automatically before presenting results to the user?
- What's the exact checksum algorithm and what's included in the hash (just Cedar source? Cedar + entity data? Cedar + OPA + entity data + schema version)?
- How does dry-run mode handle stateful OPA rules (e.g., budget counters) — does it simulate state progression across the replayed actions?
- What does the structured builder look like for the delegation domain where the constraint is "envelope_scope must be subset of parent"? How do you render subset relationships in a form?
