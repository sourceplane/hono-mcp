# hono-mcp — risks and open questions

## HM-A — No live bootstrap yet (OPEN)

Everything short of the platform is proven on every pull request: the card
against the build, the blueprint read by the pinned orun, the leak gate, the
offline bootstrap with the blueprint's own hooks, the server's own plan for
the 01-product merge, and the produced server built, dry-deployed, served,
smoke-tested and called by the MCP SDK's client in the job tree orun stages.
Not proven: the repository created and linked, the token minted, a real
`wrangler deploy`, the smoke against workers.dev, and an MCP client connected
to the deployed `/mcp`. Hence the registry row is `unlisted` until one
bootstrap from the tag has come up.

## HM-B — The lazy handler rests on `mcp-handler`'s timer (WATCH)

`mcp-handler` 1.1.0 starts its cleanup interval when the handler is CREATED
(once per module: a module-level guard), and only its SSE path fills the list
the interval sweeps. Built on the first request, the timer belongs to that
request; workerd ends it with the request, and later requests reuse the
handler — verified under `wrangler dev`, including a call after the interval
would have fired. A version that started a timer per request, or at import,
would fail on Workers; the vitest suite and the e2e tier run on every bump.

## HM-C — `mcp-handler` 1.x pins the SDK (ACCEPTED)

`mcp-handler` 1.1.0 declares `@modelcontextprotocol/sdk` `1.26.0` exactly as
its peer, so the SDK moves only with it. 2.x is the SDK v2 line
(`@modelcontextprotocol/server`) and a deliberate upgrade, not a bump.

## HM-D — `/mcp` is open (ACCEPTED)

As upstream: no authentication. Anyone with the URL can list and call the
tools, which are public arithmetic. An owner puts a check in front (a Hono
middleware on `/mcp/*` reading an Orun runtime secret, or `mcp-handler`'s
`withMcpAuth`) before a tool does anything private — and the smoke then sends
the credential too. The README and operations.md say so.

## HM-E — The first landing's push must have a `before` (WATCH)

As hono-api's HA-G: `orun plan --changed` on a push with an all-zeros
`before` plans nothing. The landing merges into orun's seeded `Initial
commit`, so the merge's push has one. Confirmed by the first live bootstrap.

## HM-F — wrangler's multi-environment warning on the local build (ACCEPTED)

`wrangler.jsonc` carries `env.dev`, `env.stage` and `env.prod`; a bare
`wrangler deploy --dry-run` warns that no environment was given and bundles
the top level (`ENVIRONMENT=local`). Orun's lanes always pass `--env`.

## HM-G — stack-tectonic 0.19.0 (ACCEPTED)

The family's one pin (0.20.0's lane-scoped install breaks the Next.js
baselines). The end-to-end tier stages the job with whichever install scope
the pinned composition plans, so a bump is tested rather than assumed.

## HM-H — The Redis client is bundled, unused (ACCEPTED)

`mcp-handler` imports `redis` at the top of its module for the SSE path, so
esbuild bundles it; it is never constructed without a `REDIS_URL`, which this
Worker does not have. It costs bundle size (the Worker is 450 KiB gzipped in
all), not behaviour.
