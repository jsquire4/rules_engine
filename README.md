# Rules Engine

Compliance-first rules engine and policy management UI for governing autonomous AI agents at scale.

## Concept

An Active Directory-style group policy system for AI agents. Organizations define hierarchical policies — org-level hard walls, team-level operational boundaries, individual agent constraints — and the engine enforces them deterministically at governed boundaries.

### Core primitives

- **Envelope model** — every agent has an accumulated constraint space (the intersection of all inherited policies). Constraints can only narrow down the hierarchy, never expand.
- **Gate (PEP)** — intercepts structured agent actions, evaluates policy, permits or blocks. Agents call `execute(action, params)` — never tools directly.
- **Check API** — `(agent_id, action, context) → permit | deny + reason_code`. Stateless per request, backed by versioned policy bundles.
- **Group policy** — policies attach to groups/org nodes; membership drives applicability. Deny-overrides for safety, most-specific-wins for configuration.
- **Petitioning** — agents can request one-time exceptions that escalate up the authority chain.

### Policy engines

- **Cedar** (primary) — structural authorization, hierarchical groups, forbid-overrides-permit
- **OPA/Rego** (quantitative) — budgets, rate limits, rolling windows, complex conditions

## Tech stack

- TypeScript (Bun runtime)
- Hono (backend API)
- PostgreSQL + Drizzle ORM
- Next.js + Tailwind + shadcn/ui (admin dashboard)
- Cedar + OPA (policy evaluation)
- Vitest (testing)

## Getting started

```bash
bun install
cp .env .env.local  # configure your database
bun run dev
```

## Related docs

See the parent `marketplace/` directory for full architecture docs:
- `agent_transaction_platform_v4.md` — transaction platform architecture
- `platform_design.md` — platform & governance design (source of truth)
- `rules_engines_for_group_policies.md` — engine evaluation research
