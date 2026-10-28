#!/usr/bin/env node
// A real MCP client exchange against a served Worker — the e2e's proof that
// the server a bootstrap produces speaks MCP, not just that /mcp answers 200.
//
//   node testing/lib/mcp-client.mjs <base-url> <expected-server-name> <api-dir>
//
// The client is the MCP SDK's own (`Client` over `StreamableHTTPClientTransport`),
// loaded from <api-dir>'s dependencies — the exact SDK the API ships — so the
// handshake is the one any MCP client makes: initialize, then the initialized
// notification, then tools/list and a tools/call of every tool. It prints one
// line on success and exits non-zero naming the first thing that was wrong.
import { createRequire } from "node:module";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

const [base, expectedName, apiDir] = process.argv.slice(2);
if (!base || !expectedName || !apiDir) {
  console.error("usage: mcp-client.mjs <base-url> <expected-server-name> <api-dir>");
  process.exit(2);
}

const require = createRequire(path.join(path.resolve(apiDir), "package.json"));
const load = async (spec) => import(pathToFileURL(require.resolve(spec)).href);
const { Client } = await load("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = await load("@modelcontextprotocol/sdk/client/streamableHttp.js");

function fail(message) {
  console.error(`  ✕ ${message}`);
  process.exit(1);
}

const client = new Client({ name: "hono-mcp-e2e", version: "1.0.0" });
const transport = new StreamableHTTPClientTransport(new URL("/mcp", base));
try {
  await client.connect(transport);
} catch (error) {
  fail(`initialize failed: ${error?.message ?? error}`);
}

const server = client.getServerVersion();
if (server?.name !== expectedName) fail(`the server names itself ${JSON.stringify(server?.name)}, not ${JSON.stringify(expectedName)}`);
if (!client.getServerCapabilities()?.tools) fail("the server does not offer tools");
// Stateless: the server issues no session id, so any isolate answers any call.
if (transport.sessionId !== undefined) fail(`the server issued a session id (${transport.sessionId}); it is meant to be stateless`);

const { tools } = await client.listTools();
const names = tools.map((t) => t.name);
if (JSON.stringify(names) !== JSON.stringify(["add", "subtract", "multiply", "divide"])) {
  fail(`tools/list answered ${JSON.stringify(names)}`);
}

const calls = [
  ["add", { a: 2, b: 3 }, "2 + 3 = 5"],
  ["subtract", { a: 10, b: 4 }, "10 - 4 = 6"],
  ["multiply", { a: 6, b: 7 }, "6 × 7 = 42"],
  ["divide", { a: 7, b: 2 }, "7 ÷ 2 = 3.5"],
  ["divide", { a: 1, b: 0 }, "Error: Division by zero is not allowed"],
];
for (const [name, args, want] of calls) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content?.[0]?.text;
  if (text !== want) fail(`tools/call ${name}(${JSON.stringify(args)}) answered ${JSON.stringify(text)}, not ${JSON.stringify(want)}`);
}

await client.close();
console.log(`   an MCP client: initialize (${server.name} ${server.version}, no session), tools/list (${names.join(", ")}), ${calls.length} tools/call`);
