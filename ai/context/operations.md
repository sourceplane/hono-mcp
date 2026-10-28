# hono-mcp — operating contract (for humans and agents)

This is the standing guide to how this MCP server is deployed and operated.
Instance facts (live URLs, workspace, the secrets it uses) live in
[deployment.md](deployment.md), rendered from probed reality by the
bootstrap's `02-docs` phase; this file is the contract that stays true
between deployments. It is written to give an agent with repository read
access enough context to reason about and operate the server without any
other source.

## What this system is

A remote Model Context Protocol server on Cloudflare alone, expressed as an
Orun component-native desired-state repo.

- **`apps/api`** — the server: one Hono app, bundled by wrangler into one
  Cloudflare Worker (`cloudflare-worker-turbo`). `POST /mcp` is the MCP
  server over Streamable HTTP (`mcp-handler` and the MCP SDK): `initialize`,
  `tools/list` and `tools/call` of four math tools — `add`, `subtract`,
  `multiply`, `divide`. It is **stateless**: every POST builds a fresh server
  and transport and issues no session id, so any isolate answers any call;
  a `GET /mcp` (a server-to-client stream) is a 405, and there is no SSE
  transport. `GET /` answers a JSON welcome naming the server, the endpoint
  and the tools; `GET /health` answers
  `{"status":"ok","name":…,"environment":…}`; anything else is a 404. It
  binds nothing — no KV, D1, R2, Durable Object or service binding — and
  holds no runtime secret. **It has no authentication**: anyone with the URL
  can call its tools.
- **`tests/api`** — vitest driving the app — the MCP exchange included —
  in-process with `app.request()`.
  A pull request's lanes do not run it (its `quick-check` lane on `dev`
  installs and checks the package; the Worker's lanes build, type-check and
  dry-deploy it): run `pnpm typecheck`, `pnpm lint` and `pnpm test` before
  you push.
- **`tooling/*`** — shared TypeScript and ESLint configuration, and the
  deploy-time wrangler renderer for workers that take wiring.

Environments: **`stage`** and **`prod`** are deployed; **`dev` is
verify-only by design** — lanes build, type-check and dry-run the deploy,
nothing deploys.

## Identity and tenancy

Every remote operation runs against ONE Orun workspace, declared in
`intent.yaml` under `execution.state.workspace` — committed, enforced, and
what CI uses. Do not remove it; headless credentials depend on it. If it
reads `ws_SET_ME`, the bootstrap had no workspace to write: set the real one
before anything else.

## How deployment works

1. Merge (or push) to `main`.
2. CI (`.github/workflows/ci.yml`) runs `orun plan --changed` — only
   components whose files changed are planned — then runs each planned lane
   with `orun run --remote-state`, authenticated by GitHub OIDC (the
   exchange resolves this repository's linked workspace server-side).
3. Each deploy lane installs the workspace, checks the Worker's structure
   (`package.json` and the committed `wrangler.jsonc`), builds and
   typechecks it, runs `wrangler deploy --env <env>` — the Worker is
   `hono-mcp-api-<env>` — and smoke-tests it: `/health` on its workers.dev URL
   must answer `"status":"ok"` for that environment, an MCP `initialize` at
   `/mcp` must return the server's identity, and a `tools/call` of `add` its
   sum.
4. `prod` deploys after `stage` has converged on the same commit
   (`environments.prod.promotion` in intent.yaml).
5. **The convergence run is the deployment.** A green run means every
   planned lane applied. Failed lanes are retried with
   `gh run rerun --failed`, which resumes the same execution.

Caveats that matter:

- A push that touches no component files plans zero lanes — that run is
  green and deployed nothing. Never treat "latest run green" as "server
  converged"; probe `/health` instead.
- A change to `intent.yaml`'s `environments` maps to no component and
  redeploys nothing on its own. Land it with a change under `apps/api`.

## Secrets model

- **Brokered provider secrets**: `CLOUDFLARE_API_TOKEN` (Workers deploy
  scope) and `CLOUDFLARE_ACCOUNT_ID` — pointers minted per run from the
  workspace's Cloudflare connection. No long-lived values at rest; nothing
  to rotate by hand.
- Inspect by NAME only: `orun secrets list --org <ws> --project` and
  `--env stage|prod`. No tooling in this repository prints a secret value,
  and no document in `ai/context/` may contain one.
- The server needs no runtime secret. One it comes to need (a key for a
  service a tool calls, or the token clients must present once authentication
  is added) is set with `orun secrets set <KEY> --org <ws> --env <env>`,
  declared in `apps/api/component.yaml`'s `optionalSecretEnv` and named in
  its `runtimeSecrets` parameter, and pushed to the Worker after each deploy;
  until it is set, the tool that needs it should answer that it is not
  configured rather than fail.

## Verifying the system

```bash
# the server on each environment (also recorded, probed, in deployment.md)
curl -s https://hono-mcp-api-stage.your-workers-subdomain.workers.dev/health
curl -s -X POST https://hono-mcp-api-prod.your-workers-subdomain.workers.dev/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# workspace readiness (integrations + repository link)
orun integrations list --org <ws> --json && orun cloud check --org <ws>
```

## Common operations

| task | how |
|---|---|
| add a tool | `server.tool(name, description, { …zod schema }, handler)` inside `createMcpHandler` in `apps/api/src/index.ts`, a test in `tests/api`, merge |
| connect an MCP client | the Worker's `/mcp` URL as a remote (Streamable HTTP) server; a stdio-only client through `npx mcp-remote <url>/mcp`; the MCP Inspector (`npx @modelcontextprotocol/inspector`) to try it by hand |
| put authentication in front | not built in: check a bearer token (an Orun runtime secret) in a Hono middleware on `/mcp/*` before the handler, or `mcp-handler`'s `withMcpAuth` — then the smoke must send it too |
| deploy a change | merge to `main`; watch the run; failed lanes → `gh run rerun --failed` |
| deploy by hand | Orunbase's Deploy button, or `gh workflow run ci.yml --ref main -f environment=<env> [-f component=<a,b>]` — the named components (blank: every one) run in that environment as a merge runs them; started off `main` it is refused |
| redeploy without a change | edit the last line of `apps/api/component.yaml` (`# orun: redeploy <reason> <stamp>`) and merge — it is a deploy trigger, nothing reads it |
| rename the server | `API_NAME` in `apps/api/src/identity.ts` — what `initialize` and `/health` answer with |
| serve a custom domain | attach it to the Worker in Cloudflare (README, "Custom domain"), then replace the placeholder `hono-mcp.example.com` in `intent.yaml`'s `BASE_DOMAIN` (every environment) with it; the workers.dev URL keeps answering for the smoke |
| add a runtime secret | `orun secrets set <KEY> --org <ws> --env <env>`, then declare it in the component's `optionalSecretEnv` and name it in `runtimeSecrets` |
| headless credentials | `ORUN_TOKEN` (workspace-scoped) + `GITHUB_TOKEN` |

The deployment record is the bootstrap's `02-docs` phase. Re-running it (the
Orun console's Retry on that phase) re-probes the URLs and re-renders
[deployment.md](deployment.md); it is idempotent.

## Evolution

Structural changes (a second Worker, a data store, a tool that needs state) follow the same
contract that deployed the server: add a component under `apps/`, `infra/` or
`packages/` with a `component.yaml`, land it as a pull request, and the
convergence run applies it. A Worker that reads an infra component's wiring
declares `dependsOn` on it, `mode: enforced` on `github-push-main`, so one
convergence applies the infra first.
