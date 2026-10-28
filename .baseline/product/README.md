# hono-mcp

A remote [Model Context Protocol](https://modelcontextprotocol.io) server on
one **Cloudflare Worker**: four math tools — `add`, `subtract`, `multiply`,
`divide` — served over Streamable HTTP at `/mcp` by a
[Hono](https://hono.dev) app, with
[`mcp-handler`](https://github.com/vercel/mcp-handler) and the MCP SDK doing
the protocol. Hono's `fetch` handler is the Worker's — no adapter, no
framework build: wrangler bundles `apps/api/src/index.ts` and Cloudflare runs
it. Every merge to `main` deploys it to stage, then prod.

## Live deployment

<!-- 02-docs:begin -->
Not recorded yet. The bootstrap's last phase writes the live URLs, the
workspace and the secrets the server uses into
[ai/context/deployment.md](ai/context/deployment.md); how the server deploys
and how to operate it is in
[ai/context/operations.md](ai/context/operations.md).
<!-- 02-docs:end -->

## Connecting an MCP client

Point the client at the Worker's `/mcp` URL —
`https://hono-mcp-api-prod.your-workers-subdomain.workers.dev/mcp` — as a
remote (Streamable HTTP) server. For a client that only speaks stdio, bridge
it with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote):

```json
{
  "mcpServers": {
    "hono-mcp": {
      "command": "npx",
      "args": ["mcp-remote", "https://hono-mcp-api-prod.your-workers-subdomain.workers.dev/mcp"]
    }
  }
}
```

The server is **stateless**: every `POST /mcp` builds a fresh server and
transport and issues no session id, so any isolate answers any call and
nothing is kept between requests. It serves no server-to-client stream (a
`GET /mcp` is a 405) and no SSE transport. It is also **open**: anyone with
the URL can list and call its tools. Put authentication in front of it before
it does anything that is not public (see "Adding a binding or a secret").

## Routes

| Route | Answers |
|---|---|
| `POST /mcp` | the MCP server, over Streamable HTTP: `initialize`, `tools/list`, `tools/call` |
| `GET /` | a JSON welcome — the server's name, the `/mcp` endpoint and its tools |
| `GET /health` | `{"status":"ok","name":"<API_NAME>","environment":"<env>"}` — what the deploy's smoke and an operator's probe read |
| anything else | `404 Not Found` (`GET /mcp`: `405`) |

## What is here

| Surface | Where |
|---|---|
| The MCP server (its tools) and the routes | `apps/api/src/index.ts` |
| The server's name (what `initialize` and `/health` answer with) | `apps/api/src/identity.ts` |
| Worker config (name, compatibility date, per-environment vars) | `apps/api/wrangler.jsonc` |
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
pnpm --filter @app/api dev                 # http://localhost:8787
curl http://localhost:8787/health          # {"status":"ok",…,"environment":"local"}
curl -X POST http://localhost:8787/mcp \
  -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"add","arguments":{"a":2,"b":3}}}'
npx @modelcontextprotocol/inspector         # an MCP client in the browser: connect to http://localhost:8787/mcp
```

Add a tool with `server.tool(name, description, { …zod schema }, handler)`
inside `createMcpHandler` in `apps/api/src/index.ts`; `wrangler dev` reloads
on save. Keep `/health`: the deploy's smoke reads it, then calls `add`.

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. The server deploys to `stage`, then to
`prod` once stage has converged on the same commit; `dev` only verifies. The
Worker is `hono-mcp-api-<env>` on your account's workers.dev subdomain, and
every deploy is smoke-tested over HTTP: `/health` must answer `"status":"ok"`
for that environment, an MCP `initialize` at `/mcp` must come back with the
server's identity, and a `tools/call` of `add` with its sum. A pull request
runs the same pipeline's verify lanes: the Worker built, type-checked and
dry-deployed for each environment, with nothing deployed. They do not lint or
run the tests, so run `pnpm typecheck`, `pnpm lint` and `pnpm test` before
you push. (A push to `main` builds, deploys and smoke-tests.)

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The
Cloudflare token and account id are brokered per run from the workspace's
Cloudflare connection; nothing provider-shaped is stored in the repository
or in GitHub.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would deploy it. Leave the component blank to redeploy
every component in that environment, with nothing changed: after rotating a
secret, say. A component with nothing to run in that environment (a test
suite in `prod`) is left out with a notice.

## Adding a binding or a secret

The Worker binds nothing today, so `wrangler.jsonc` is committed as it
deploys (a tool that needs storage or state gets a binding). To give it a KV namespace, a D1 database or an R2 bucket, add the
resource under `infra/` as its own component and have `apps/api/component.yaml`
depend on it; `tooling/wire/` renders a wrangler template from the ids that
component publishes. A runtime secret (an API key for a service a tool
calls, or the token clients must present once you add authentication) is an Orun secret: `orun secrets set <KEY> --org <ws> --env <env>`,
declared in the component's `optionalSecretEnv` and named in its
`runtimeSecrets`, then pushed to the Worker after each deploy. Until it is
set, the tool that needs it should say so rather than fail.

## Custom domain

The server answers on workers.dev from its first deploy. To serve it on your own
domain, add the domain to the Cloudflare account the server deploys into and
attach it to the Worker (dashboard → Workers & Pages → `hono-mcp-api-prod` →
Settings → Domains & Routes → Add → Custom domain); do the same for stage
with a subdomain if you want one. The workers.dev URL keeps answering, and the
deploy's smoke keeps reading it — unless the environment sets `DEPLOYED_URL`
in `intent.yaml`, which the smoke reads instead:

```yaml
environments:
  prod:
    env:
      DEPLOYED_URL: https://hono-mcp.example.com
```

The repository names the domain in one place, `BASE_DOMAIN` in `intent.yaml`
(one line per environment), which the server was born with as the reserved
placeholder `hono-mcp.example.com` — the example above carries it too. MCP
clients then connect to `https://<your domain>/mcp`.
Replace it with your domain in the same change that attaches it.

## Credits

The server is Vercel's Hono MCP remote server example
([vercel/examples](https://github.com/vercel/examples), `starter/hono-mcp`,
MIT — `apps/api/LICENSE.md`).
