# hono-mcp — design

## 1. What the example is

A remote Model Context Protocol server in one file. `src/index.ts` creates
`new Hono()`, builds an MCP handler with `mcp-handler`'s `createMcpHandler`
— registering four tools (`add`, `subtract`, `multiply`, `divide`, each with
a zod schema of two numbers; `divide` refuses a zero divisor with a text
result) — mounts it on `app.all('/mcp/*')`, answers `GET /` with a JSON
document naming the endpoint and the tools, and `export default app`. On
Vercel the default export runs as a serverless function. `mcp-handler`
serves Streamable HTTP at `/mcp` (with `basePath: '/'`) and, given a
`REDIS_URL`, the older SSE transport at `/sse` and `/message` — which the
example's one route never reaches. No auth, no data, no other route.

## 2. The mapping (Vercel → Cloudflare)

| Vercel | Here |
|---|---|
| The Hono builder (a serverless function) | A Cloudflare Worker: `export default app` is the module handler; wrangler bundles `src/index.ts` with esbuild, `nodejs_compat` on for `mcp-handler`'s `http` and `redis` imports |
| `createMcpHandler(...)` at module load | Built on the FIRST request and reused (`handler ??= makeHandler()`): creating it starts `mcp-handler`'s 30-second cleanup `setInterval`, and Workers refuse a timer in global scope ("Disallowed operation called within global scope") |
| A fresh MCP server and transport per POST, no session id | The same — the SDK's `WebStandardStreamableHTTPServerTransport`, which is fetch-native. Stateless: any isolate answers any call; nothing outlives a request |
| `maxDuration: 60` | Kept as an option; a Worker has no wall-clock limit while the client is connected, and the tools are arithmetic |
| SSE + Redis | Not configured: unreachable in the example (the route mounts `/mcp` only), and a Worker has no Redis. The Redis client is still in the bundle, imported and unused (risk HM-H) |
| `serverInfo`: `mcp-handler`'s default name | The server's own name (`API_NAME`), what a client's `initialize` reads |
| `vc dev` · `vc build` · `vc deploy` | `wrangler dev` · `wrangler deploy --dry-run --outdir dist` · Orun's `wrangler deploy --env <stage\|prod>` on merge |
| Node typings | `@cloudflare/workers-types` through the shared `tooling/tsconfig/worker.json` |

Alternatives rejected:

- **Replace `mcp-handler` with the SDK directly** (`McpServer` and
  `WebStandardStreamableHTTPServerTransport` in a Hono route), or with
  `@hono/mcp`. Either would drop the timer and the Redis client, but it is
  not the example's code: the example IS `mcp-handler` on Hono, and one line
  makes it run.
- **`mcp-handler` 2.x.** It moves to the MCP SDK's v2 packages
  (`@modelcontextprotocol/server`); the example is on the 1.x line. 1.1.0 is
  that line's newest, with the SDK it pins (1.26.0) — newer than the
  example's lockfile (1.0.1 and SDK 1.17.3), same majors.
- **A Durable Object per session** (Cloudflare's `McpAgent`). The example is
  stateless by design; a session store would be a different server.

## 3. The repository

```
apps/api               the example (src/index.ts), its name (src/identity.ts), its licence, the Worker config
  component.yaml       Orun component: build with turbo, dry-run/deploy with wrangler --env; the smoke
  wrangler.jsonc       worker name, compatibility date, nodejs_compat, observability, env.{dev,stage,prod} vars
tests/api              vitest: the routes and the MCP exchange through app.request() — no server, no workerd
tooling/*              shared tsconfig / eslint / wrangler wiring renderer (unused here: nothing to wire)
intent.yaml            environments dev (verify) · stage · prod; `work:` points at specs/epics and tasks
```

## 4. The build

`pnpm --filter @app/api build` = `wrangler deploy --dry-run --outdir dist`:
esbuild bundles `src/index.ts`, Hono, `mcp-handler`, the MCP SDK, zod and the
Redis client into `dist/index.js` — 2.2 MiB, 450 KiB gzipped, well under
Workers Free's 3 MiB — and exits before upload.

## 5. The smoke and the tests

The deploy's smoke reads `/health` for THIS environment (as hono-api's), then
POSTs an MCP `initialize` (it must return `serverInfo`) and a `tools/call` of
`add` (it must return `2 + 3 = 5`) — so a green deploy is a server that
speaks MCP, not a Worker that answers. The vitest suite drives the same
exchange in-process; the end-to-end tier serves the staged Worker with
`wrangler dev --env stage`, runs the smoke verbatim and as the planned step,
and makes a full exchange with the MCP SDK's own `Client` over
`StreamableHTTPClientTransport` (`testing/lib/mcp-client.mjs`): initialize
with no session id issued, tools/list, a call of every tool.

## 6. The baseline

hono-api's, unchanged in shape: one landing (`01-product`) then the record
(`02-docs`); one brokered key pair (`workers-deploy`, `account-id`); the name
seam `API_NAME` in `apps/api/src/identity.ts`, which `/health`, `/` and
`initialize` all read; the workers.dev subdomain from the Cloudflare
connection; no domain asked. The deployment record adds one row per
environment: the tools `/mcp` lists. The leak gate requires
`apps/api/LICENSE.md` to ship, so a product cannot lose the example's credit.
