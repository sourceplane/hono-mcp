# api — runbook

## How it runs

Pull requests verify it; a merge to `main` deploys it to `stage`, `prod`.
CI plans what changed (`orun plan --changed`) and runs each lane with `orun run`;
the plan orders a component after everything it depends on.

## Local commands

```bash
pnpm --filter @app/api dev
pnpm --filter @app/api build
pnpm --filter @app/api typecheck
pnpm --filter @app/api lint
```

## Verify

After a deploy the lane runs this smoke against the environment it
deployed (`ORUN_ENVIRONMENT`); `DEPLOYED_URL` overrides the URL:

```bash
base="${DEPLOYED_URL:-https://hono-mcp-api-${ORUN_ENVIRONMENT}.your-workers-subdomain.workers.dev}" && health="$(curl -sf --max-time 20 "${base}/health")" && echo "${health}" | grep -q "\"status\":\"ok\"" && echo "${health}" | grep -q "\"environment\":\"${ORUN_ENVIRONMENT}\"" && init="$(curl -sf --max-time 20 -X POST "${base}/mcp" -H "content-type: application/json" -H "accept: application/json, text/event-stream" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"initialize\",\"params\":{\"protocolVersion\":\"2025-06-18\",\"capabilities\":{},\"clientInfo\":{\"name\":\"orun-smoke\",\"version\":\"1\"}}}")" && echo "${init}" | grep -q "\"serverInfo\"" && sum="$(curl -sf --max-time 20 -X POST "${base}/mcp" -H "content-type: application/json" -H "accept: application/json, text/event-stream" -d "{\"jsonrpc\":\"2.0\",\"id\":2,\"method\":\"tools/call\",\"params\":{\"name\":\"add\",\"arguments\":{\"a\":2,\"b\":3}}}")" && echo "${sum}" | grep -q "2 + 3 = 5"
```

## Rollback

Revert the commit on `main`. The next convergence applies the previous desired
state; nothing was changed out of band, so there is nothing else to undo.

## Common failures

- **The smoke fails right after a first deploy**: a new workers.dev route can
  answer 4xx for a few seconds and the lane retries. A failure that persists
  is a regression in the deployed code.
