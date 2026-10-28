# hono-mcp

Vercel's [Hono MCP remote server](https://github.com/vercel/examples/tree/main/starter/hono-mcp)
example — a Model Context Protocol server with four math tools (add,
subtract, multiply, divide), served over Streamable HTTP at `/mcp` by one
`Hono` app through `mcp-handler` — running natively as a **Cloudflare
Worker**, and packaged as an **Orun baseline**: one command takes a new MCP
server from nothing to live on stage and prod, in its own repository, under
its own name — in ONE landing.

Hono's `fetch` handler is the Worker's: no adapter and no framework build,
wrangler bundles `src/index.ts` and Cloudflare runs it. The server is
stateless — every `POST /mcp` builds a fresh server and transport and issues
no session — so any isolate answers any call. The example's code is the
code; one line moved: the handler is built on the first request instead of
at module load, because `mcp-handler` starts a timer when it is created and
Workers refuse a timer in global scope. The port adds the Worker's config,
the monorepo wrapper, a test package, the deploy contract and a `/health`
route the deploy smoke-tests before it makes an MCP call. What the baseline
adds is everything needed to make a copy of it somebody else's — built the
way [cirrus-baseline](https://github.com/sourceplane/cirrus-baseline) is.
See [`specs/epics/hono-mcp`](specs/epics/hono-mcp/README.md) for the design,
the milestones and the as-built status.

## Instantiating a product

```bash
git clone --depth 1 --branch <baseline-tag> https://github.com/sourceplane/hono-mcp
cd hono-mcp
orun new --blueprint repo-blueprint.yaml --out ~/mcp/acme-mcp --run-hooks --resume \
  --set reponame=acme-mcp --set productname="Acme MCP" \
  --set githuborg=acme-inc --set subdomain=<workers-dev-subdomain>
```

Or, once the platform's registry lists it, from the Orun console (Baselines →
`hono-mcp` → Build). Two phases — `01-product` (the repository, its CI and
the whole server in one pull request, deployed to stage and prod by one
convergence, smoke-tested) and `02-docs` (the live deployment recorded) —
each landing one pull request in the new repository.
**[BOOTSTRAP.md](BOOTSTRAP.md)** is the operator guide;
[docs/phases/](docs/phases/README.md) has a page per phase.

The new repository receives the **server only** — the Worker, its tests, its
CI, its tooling, a README of its own, its operating contract and the
example's licence — renamed throughout to the server's name, repository and
Cloudflare Worker. None of this
repository's machinery ships, and nothing that ships names it.

| What makes it a baseline | Where |
|---|---|
| The console card (inputs, secrets, programme) | `blueprint.yaml` |
| The build document (modules, phases, hooks) | `repo-blueprint.yaml` |
| This tree's identity, and the bootstrap's task contracts | `.baseline/` |
| The rename engine | `tooling/rebrand/rebrand.mjs` |
| The bootstrap's helpers (deferrals, redeploy marker, work-tree strip) | `tooling/bootstrap/` |
| The deployment-record renderer | `hooks/render-deployment-docs.sh` |
| The server's README and context pack | `.baseline/product/README.md`, `ai/context/` |
| The baseline's tests: contract, leak, offline bootstrap, end to end | `testing/`, `.github/workflows/baseline.yml` |
| Cutting a `baseline-vN` tag | `.github/workflows/tag.yml` |

## What is here (the product)

| Surface | Where |
|---|---|
| The MCP server — its four tools over Streamable HTTP at `POST /mcp`; `GET /` a JSON welcome, `GET /health` the server's name and environment | `apps/api/src/index.ts` |
| The server's name (the rename's seam; what `initialize` and `/health` answer with) | `apps/api/src/identity.ts` |
| The example's licence (MIT, Vercel) | `apps/api/LICENSE.md` |
| Worker config (name, compatibility, per-environment vars) | `apps/api/wrangler.jsonc` |
| Deploy contract | `apps/api/component.yaml` (`cloudflare-worker-turbo`) |
| Tests | `tests/api` (vitest, drives the app — the MCP exchange included — in-process with `app.request()`) |

## Getting started

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build            # wrangler deploy --dry-run → apps/api/dist (the bundle, no upload)
```

Run the Worker locally under workerd and call it:

```bash
pnpm --filter @app/api dev        # http://localhost:8787
curl http://localhost:8787/health # {"status":"ok","name":"Hono MCP Server","environment":"local"}
curl -X POST http://localhost:8787/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

Add a tool with `server.tool(...)` inside `createMcpHandler` in
`apps/api/src/index.ts`; `wrangler dev` reloads on save. Any MCP client
connects to `http://localhost:8787/mcp` (the MCP Inspector:
`npx @modelcontextprotocol/inspector`).

## How it maps to Vercel

| Vercel | Here |
|---|---|
| Hono detected by Vercel's framework builder and run as a serverless function | A Cloudflare Worker: `export default app` is the module handler (`fetch` is `app.fetch`); wrangler bundles `src/index.ts` with `nodejs_compat` for `mcp-handler`'s Node imports |
| `mcp-handler`'s handler created at module load | Created on the first request and reused: creating it starts a cleanup timer, which Workers allow only inside a handler. Every `POST /mcp` still builds a fresh server and transport — stateless, as on Vercel |
| `maxDuration: 60` (the function's time limit) | Kept in the handler's options; a Worker has no wall-clock limit while it waits on the client, and its CPU limit is the plan's |
| SSE and Redis (`REDIS_URL`) — reachable only at `/sse`, which the example's route does not mount | Not configured: Streamable HTTP alone, at `/mcp` |
| `serverInfo` left at `mcp-handler`'s default name | The server's own name (`API_NAME`), so a client sees which server it connected to |
| `vc dev` · `vc build` · `vc deploy` | `wrangler dev` · `wrangler deploy --dry-run --outdir dist` · `wrangler deploy --env <stage\|prod>` |
| Deploy on push | Orun deploys `<repo>-api-{stage,prod}` on merge to `main` and smoke-tests `/health`, an MCP `initialize` and a `tools/call` (`apps/api/component.yaml`) |
| "Deploy with Vercel" (clone the template) | `orun new --blueprint repo-blueprint.yaml` — a new repository, branded, deployed |

## CI

| Workflow | What it runs | Ships to a server |
|---|---|---|
| `ci.yml` | the Orun pipeline, and the only workflow a server carries: `orun plan --changed`, then one job per lane. A pull request runs the verify lanes (the Worker built, type-checked and dry-deployed per environment; the tests' `quick-check` lane installs and checks the package, it does not run them), except the bootstrap's own landings (`orun/BASE-*`), where `plan` alone is the check; a merge deploys stage → prod. It plans nothing while `intent.yaml` names the placeholder workspace `ws_CHANGE_ME`, as this repository does. A manual run (Orunbase's Deploy button, or Run workflow on `main`) plans the environment and components it names under the push-to-main trigger, so they deploy as a merge deploys them | yes |
| `baseline.yml` | the baseline's own tiers: contract tests, the blueprint read by the pinned orun, the leak gate, the offline bootstrap, the server built, dry-deployed, served and called by the MCP SDK's own client | no |
| `tag.yml` | cuts a `baseline-vN` tag (manual) | no |

## Credits

The server is Vercel's Hono MCP remote server example
([vercel/examples](https://github.com/vercel/examples), `starter/hono-mcp`,
MIT — `apps/api/LICENSE.md`).
