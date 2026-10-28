# hono-mcp — open risks

What is not yet proven or not yet decided. The full write-up of every risk,
including the accepted and resolved ones, is
`specs/epics/hono-mcp/risks-and-open-questions.md`; this page lists only what
is still live, so it should be short.

| ID | Risk | State | What closes it |
|---|---|---|---|
| HM-A | No live bootstrap yet: the repository created and linked, the deploy token minted, a real `wrangler deploy`, the smoke and the probes against workers.dev, and an MCP client connected to the deployed `/mcp` are all unproven | OPEN | One bootstrap from a tag against a workspace |
| HM-B | The lazy handler depends on `mcp-handler` creating its timer at creation time and never per request; a version that moves it would break the Worker | WATCH | The tests and the e2e on every bump |
| HM-E | `orun plan --changed` plans nothing for a push with no `before`; the first landing relies on merging into orun's seeded initial commit | WATCH | Confirmed by the first live bootstrap |

Accepted, and worth knowing before you change them: HM-C (`mcp-handler` 1.x
pins the SDK at 1.26.0; 2.x moves to `@modelcontextprotocol/server`), HM-D
(`/mcp` is open: no authentication), HM-F (wrangler's multi-environment
warning on the local build), HM-G (stack-tectonic 0.19.0), HM-H (the bundle
carries the Redis client the example's SSE path imports, unused).
