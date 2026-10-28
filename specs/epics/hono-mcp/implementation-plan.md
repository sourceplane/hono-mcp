# hono-mcp — implementation plan

Three milestones, one task each, each landed as one pull request.

## HM0 — the spec (HM-1)

The repository is born with hono-api's frame — `intent.yaml` (dev
verify-only, stage, prod after stage; the placeholder workspace
`ws_CHANGE_ME`, so CI plans nothing until it is linked), `ci.yml` byte for
byte turso-starter's (as hono-api carries it), the shared TypeScript and
ESLint configuration, the wrangler renderer, the pnpm workspace and turbo
pipeline, and the spec index — and this doc set and the three task
contracts land on it.

## HM1 — the MCP server on Workers (HM-2)

- `apps/api/src/index.ts` is upstream's, with the handler built on the first
  request (design §2), `serverInfo` named by `API_NAME`, and hono-api's
  `/health`; `apps/api/src/identity.ts` holds `API_NAME`;
  `apps/api/LICENSE.md` is the example's MIT licence.
- `apps/api/wrangler.jsonc` (per-environment `env` sections, `nodejs_compat`)
  and `component.yaml` (`cloudflare-worker-turbo`) with a smoke over
  `/health`, an MCP `initialize` and a `tools/call` of `add`.
- `tests/api`: vitest driving `/`, `/health`, a 404, `initialize`,
  `tools/list` with no session, every `tools/call`, division by zero, bad
  arguments and `GET /mcp`, in-process with `app.request()`.
- The README: run, test, connect a client, deploy; how each Vercel piece maps.

Done when typecheck, lint, test and build are green, and `wrangler dev`
answers the MCP SDK's own client.

## HM2 — a baseline (HM-3)

hono-api's machinery on this tree: the card, the build document (one
landing, `01-product`, then the record, `02-docs`), `.baseline/` (identity,
the product's README, task contracts), the rename engine, the bootstrap
helpers, the deployment-record renderer (which also lists the tools `/mcp`
answers with), the phase pages, the context pack, and the baseline's tests —
with the end-to-end tier making a real MCP exchange against the staged
Worker (`testing/lib/mcp-client.mjs`). Done when every Baseline CI tier is
green; tagged `baseline-v1`.
