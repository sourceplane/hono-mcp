# hono-mcp — where this repository stands

The entry page for anyone (or any agent) picking this repository up. It is
this repository's own state and does not ship to a server built from it; the
two pages that do are [operations.md](operations.md) and
[deployment.md](deployment.md).

## What it is

Vercel's Hono MCP remote server example — a Model Context Protocol server
with four math tools over Streamable HTTP at `/mcp` — as one stateless
Cloudflare Worker, packaged as an Orun baseline: `orun new --blueprint
repo-blueprint.yaml` builds a new MCP server in its own repository and takes
it to live on stage and prod in one landing (`01-product`), then records what
went live (`02-docs`).

## Release

| | |
|---|---|
| Latest tag | `baseline-v1` (HM2 — the baseline) |
| Proven live | No. Everything short of the platform is proven offline in Baseline CI — the Worker served by `wrangler dev` and called by the MCP SDK's own client; a live bootstrap from a tag is still to come (risk HM-A) |

## Where to read

| Question | Page |
|---|---|
| What shipped, and every departure from upstream | `specs/epics/hono-mcp/IMPLEMENTATION-STATUS.md` |
| Why it is built this way | [decisions.md](decisions.md), then `specs/epics/hono-mcp/design.md` |
| What could still go wrong | [open-risks.md](open-risks.md), then `specs/epics/hono-mcp/risks-and-open-questions.md` |
| How to instantiate it | `BOOTSTRAP.md`, `docs/phases/` |
| What each component is | `apps/api/docs/`, `tests/api/docs/` (generated; `python3 tooling/catalog/gen-component-docs.py`) |

## Next

1. Bootstrap one server from `baseline-v1` against a workspace, connect an
   MCP client to its `/mcp`, and record its timings (closes HM-A).
