# hono-mcp — Vercel's Hono MCP remote server on Cloudflare Workers

**The example is a remote MCP server in one Hono file — four math tools served
over Streamable HTTP at `/mcp` by `mcp-handler` — and Hono was written for the
Workers runtime first, so the port is where it runs: one plain Cloudflare
Worker, stateless, deployed by Orun to stage and prod on every merge — and the
baseline that makes a copy of it somebody else's server in one landing.**

| | |
|---|---|
| Status | ✅ Shipped (`baseline-v1`) — proven offline in Baseline CI; not yet live (risk HM-A) |
| Upstream | [vercel/examples `starter/hono-mcp`](https://github.com/vercel/examples/tree/main/starter/hono-mcp) (MIT), at `de86723` (2026-10-16) |
| Reference | [hono-api](https://github.com/sourceplane/hono-api) — the same plain Worker, scaffolding, tests and bootstrap |
| Key | `HM` |

## Read in this order

1. [design.md](design.md) — the example, how each Vercel piece maps to
   Cloudflare, the repository and the build, and the alternatives rejected.
2. [implementation-plan.md](implementation-plan.md) — the milestones and
   what each one lands.
3. [risks-and-open-questions.md](risks-and-open-questions.md) — what is not
   proven, and what was accepted.
4. [IMPLEMENTATION-STATUS.md](IMPLEMENTATION-STATUS.md) — what shipped, and
   every departure from the upstream example.

## Milestones

| Milestone | What it lands | Task |
|---|---|---|
| HM0 — the spec | the repository, its intent, CI, tooling and spec index; this doc set | HM-1 |
| HM1 — the MCP server on Workers | the example in `apps/api` as one plain Worker, its tests, the README | HM-2 |
| HM2 — a baseline | the console card, the build document, the context pack and the baseline's tests | HM-3 |
