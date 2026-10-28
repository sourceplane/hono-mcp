# hono-mcp — decisions

The choices that shape this repository, one line each, with where the full
reasoning lives. Superseded decisions stay listed, marked, so the history
reads in order.

| # | Decision | Why | Source |
|---|---|---|---|
| 1 | A plain Worker (`cloudflare-worker-turbo`), no adapter, no Durable Object | Hono's default export already is a Workers module handler, and the example's Streamable HTTP transport is stateless — a fresh server and transport per POST, no session — so nothing has to outlive a request | `specs/epics/hono-mcp/design.md` |
| 2 | The example's `mcp-handler`, kept, at 1.1.0 with the MCP SDK it pins (1.26.0) | The example's library and major; it already serves Streamable HTTP through the SDK's Web-standard transport, which runs on Workers under `nodejs_compat` | design.md, risk HM-C |
| 3 | The handler is built on the first request, not at module load | Creating it starts `mcp-handler`'s cleanup timer, and Workers refuse a timer in global scope; built once and reused, every POST still gets its own server | design.md, risk HM-B |
| 4 | `serverInfo.name` is the server's name (`API_NAME`), not `mcp-handler`'s default | A client sees which server it connected to, and the rename has one seam | IMPLEMENTATION-STATUS |
| 5 | Streamable HTTP alone; SSE and Redis not configured | The example's route mounts `/mcp` only, so its SSE endpoints were never reachable; a Worker has no Redis | design.md |
| 6 | `wrangler.jsonc` is committed, not rendered | The Worker binds nothing, so there is nothing to wire; the lane's structure check finds it before any build | design.md, `apps/api/component.yaml` |
| 7 | `GET /health` and one name seam (`apps/api/src/identity.ts`); the smoke then makes an MCP `initialize` and a `tools/call` | The deploy smoke and the bootstrap's probes read `/health`; the MCP calls prove the server, not just the Worker, answers | `apps/api/component.yaml` |
| 8 | One landing (`01-product`) then the record (`02-docs`) | A landing has a fixed cost; the plan, not the phases, carries deploy order (cirrus-baseline since baseline-v22) | `repo-blueprint.yaml` |
| 9 | `ci.yml` plans nothing while `intent.yaml` names `ws_CHANGE_ME` | A bootstrap cannot set a repository variable | hono-api's design |
| 10 | stack-tectonic 0.19.0 | The family's one pin (risk HM-G) | risks-and-open-questions.md |
| 11 | `subdomain` is read from the Cloudflare connection, never asked; the console asks for no domain | It belongs to the account; a domain is an owner's step after the bootstrap | `blueprint.yaml` |
| 12 | No authentication in front of `/mcp` | The example has none, and its tools are public arithmetic; an owner adds it before a tool does anything private (risk HM-D) | operations.md |
