import { describe, expect, it } from "vitest";

// Hono's app.request() drives the router in-process — no server, no
// workerd — so this is the template's behaviour, independent of the runtime.
// The MCP calls go through the same mcp-handler and SDK transport the Worker
// runs; `wrangler dev` serves the same exchange under workerd.

const MCP_HEADERS = {
  "content-type": "application/json",
  // Streamable HTTP: a client must accept both a JSON body and an SSE stream.
  accept: "application/json, text/event-stream",
};

type RpcMessage = {
  jsonrpc: "2.0";
  id?: number | string | null;
  result?: Record<string, unknown>;
  error?: { code: number; message: string };
};

// The transport answers a request with an SSE stream of `event: message`
// frames; the JSON-RPC response is the `data:` of the frame carrying its id.
async function rpc(method: string, params: Record<string, unknown> = {}, id = 1): Promise<RpcMessage> {
  const { default: app } = await import("@/index");
  const res = await app.request("/mcp", {
    method: "POST",
    headers: MCP_HEADERS,
    body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
  });
  expect(res.status).toBe(200);
  const body = await res.text();
  const messages = body
    .split("\n")
    .filter((line) => line.startsWith("data: "))
    .map((line) => JSON.parse(line.slice("data: ".length)) as RpcMessage);
  const reply = messages.find((m) => m.id === id);
  if (!reply) throw new Error(`no JSON-RPC reply to ${method} in: ${body}`);
  return reply;
}

async function callTool(name: string, args: Record<string, unknown>) {
  const reply = await rpc("tools/call", { name, arguments: args });
  expect(reply.error).toBeUndefined();
  return reply.result as { content: { type: string; text: string }[]; isError?: boolean };
}

describe("the welcome route (apps/api/src/index.ts)", () => {
  it("answers / with the server, its endpoint and its tools", async () => {
    const { default: app } = await import("@/index");
    const { API_NAME } = await import("@/identity");
    const res = await app.request("/");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await res.json()).toEqual({
      message: `${API_NAME} - Math Operations`,
      endpoints: {
        mcp: "/mcp",
        description: "MCP server with math operation tools (add, subtract, multiply, divide)",
      },
      tools: ["add", "subtract", "multiply", "divide"],
    });
  });

  it("answers an unknown path with 404", async () => {
    const { default: app } = await import("@/index");
    const res = await app.request("/nope");
    expect(res.status).toBe(404);
  });
});

describe("GET /health — what the deploy's smoke and the bootstrap's probe read", () => {
  it("names the server and the environment the Worker runs as", async () => {
    const { default: app } = await import("@/index");
    const { API_NAME } = await import("@/identity");
    // The third argument is the Worker's env: what wrangler's
    // `env.stage.vars` hands the deployed Worker.
    const res = await app.request("/health", {}, { ENVIRONMENT: "stage" });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^application\/json/);
    expect(await res.json()).toEqual({ status: "ok", name: API_NAME, environment: "stage" });
  });

  it("still answers when the Worker has no ENVIRONMENT var", async () => {
    const { default: app } = await import("@/index");
    const res = await app.request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ status: "ok", environment: "unknown" });
  });
});

describe("POST /mcp — the MCP server over Streamable HTTP", () => {
  it("initializes, naming itself with the server's name and offering tools", async () => {
    const { API_NAME } = await import("@/identity");
    const reply = await rpc("initialize", {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "vitest", version: "0" },
    });
    expect(reply.error).toBeUndefined();
    expect(reply.result).toMatchObject({
      protocolVersion: "2025-06-18",
      serverInfo: { name: API_NAME },
      capabilities: { tools: {} },
    });
  });

  it("is stateless: a tools/list with no session and no initialize before it is answered", async () => {
    const reply = await rpc("tools/list", {}, 7);
    expect(reply.error).toBeUndefined();
    const tools = (reply.result as { tools: { name: string; description: string; inputSchema: { required?: string[] } }[] }).tools;
    expect(tools.map((t) => t.name)).toEqual(["add", "subtract", "multiply", "divide"]);
    for (const tool of tools) {
      expect(tool.description).not.toBe("");
      expect(tool.inputSchema.required).toEqual(["a", "b"]);
    }
  });

  it.each([
    ["add", { a: 2, b: 3 }, "2 + 3 = 5"],
    ["subtract", { a: 10, b: 4 }, "10 - 4 = 6"],
    ["multiply", { a: 6, b: 7 }, "6 × 7 = 42"],
    ["divide", { a: 7, b: 2 }, "7 ÷ 2 = 3.5"],
  ])("tools/call %s", async (name, args, text) => {
    const result = await callTool(name, args);
    expect(result.content).toEqual([{ type: "text", text }]);
  });

  it("refuses division by zero with the template's message, not a fault", async () => {
    const result = await callTool("divide", { a: 1, b: 0 });
    expect(result.content).toEqual([{ type: "text", text: "Error: Division by zero is not allowed" }]);
  });

  it("rejects arguments that are not numbers", async () => {
    const reply = await rpc("tools/call", { name: "add", arguments: { a: "two", b: 3 } });
    // The SDK reports a failed input validation as a tool error result (or a
    // JSON-RPC error, depending on its version) — either way, no sum.
    const failed = reply.error !== undefined || (reply.result as { isError?: boolean }).isError === true;
    expect(failed).toBe(true);
  });

  it("answers GET /mcp with 405: there is no server-to-client stream to open", async () => {
    const { default: app } = await import("@/index");
    const res = await app.request("/mcp", { headers: { accept: "text/event-stream" } });
    expect(res.status).toBe(405);
  });
});

describe("the server's identity (apps/api/src/identity.ts)", () => {
  it("names the server", async () => {
    const { API_NAME } = await import("@/identity");
    expect(API_NAME.trim()).not.toBe("");
  });
});
