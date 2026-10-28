# hono-mcp — implementation status

| Milestone | State | Landed |
|---|---|---|
| HM0 — the spec | ✅ | HM-1 |
| HM1 — the MCP server on Workers | ✅ | HM-2 |
| HM2 — a baseline | planned | HM-3 |

## Departures from the upstream example

Everything not listed here is the example as it is upstream at `de86723`.

| # | What | Why |
|---|---|---|
| 1 | The app lives in `apps/api` of a pnpm workspace (`@app/api`); upstream's `package.json`, `tsconfig.json` and README are replaced by the workspace's | The workspace's shape (hono-api's) |
| 2 | `createMcpHandler(...)` is wrapped in `makeHandler()` and called on the first request (`handler ??= makeHandler()`), not at module load | Creating it starts `mcp-handler`'s cleanup timer, and Workers refuse a timer in global scope |
| 3 | `serverInfo: { name: API_NAME, version: '0.1.0' }` is passed (upstream passes `{}`, so `mcp-handler`'s default name) | A client sees which server it connected to; one rename seam |
| 4 | `GET /`'s `message` is `` `${API_NAME} - Math Operations` `` (upstream: `'Hono MCP Server - Math Operations'`, which is `API_NAME`'s value) | The name comes from the one seam |
| 5 | `GET /health` added: `{"status":"ok","name":API_NAME,"environment":ENVIRONMENT}` | The deploy's smoke and the bootstrap's probes read it (hono-api's contract) |
| 6 | `mcp-handler` `1.1.0` and `@modelcontextprotocol/sdk` `1.26.0` (upstream `^1.0.1`, `^1.17.3`, locked at 1.0.1 and 1.17.3); `hono` `^4.13.0`; `zod` `^3.25.76` | The newest of the example's majors, with the SDK `mcp-handler` 1.1.0 pins |
| 7 | `apps/api/LICENSE.md` is vercel/examples' MIT licence | The example ships under it; the product carries it |
| 8 | `wrangler.jsonc` (`<repo>-api`, `nodejs_compat`, `env.{dev,stage,prod}`) and `component.yaml` (`cloudflare-worker-turbo`, a smoke over `/health`, an MCP `initialize` and a `tools/call`) | The Worker's config and the deploy contract replace Vercel's |
| 9 | Tests: `tests/api/src/app.test.ts` (vitest, in-process): the routes, `initialize`, `tools/list` with no session, every `tools/call`, division by zero, bad arguments, `GET /mcp` 405 | The example ships none |
| 10 | `@types/node` dropped from the app; `@cloudflare/workers-types`, `wrangler` and the workspace's tsconfig and ESLint added | A Worker, not a Node function |
