import { Hono } from 'hono'
import { createMcpHandler } from 'mcp-handler'
import { z } from 'zod'
import { API_NAME } from './identity'

// `vars.ENVIRONMENT` in wrangler.jsonc: `local` under a bare `wrangler dev`,
// and the environment's name in each `env.<name>` section the deploy targets.
type Bindings = {
  ENVIRONMENT?: string
}

const app = new Hono<{ Bindings: Bindings }>()

// The MCP server: the example's four math tools, served over Streamable HTTP
// at /mcp by mcp-handler. Every POST gets a fresh server and transport (the
// SDK's Web-standard transport, with no session id), so the Worker holds no
// state between requests and any isolate can answer any call.
const makeHandler = () =>
  createMcpHandler(
    (server) => {
      server.tool(
        'add',
        'Add two numbers',
        {
          a: z.number().describe('First number'),
          b: z.number().describe('Second number'),
        },
        async ({ a, b }) => {
          const result = a + b
          return {
            content: [{ type: 'text', text: `${a} + ${b} = ${result}` }],
          }
        }
      )

      server.tool(
        'subtract',
        'Subtract two numbers',
        {
          a: z.number().describe('First number'),
          b: z.number().describe('Second number'),
        },
        async ({ a, b }) => {
          const result = a - b
          return {
            content: [{ type: 'text', text: `${a} - ${b} = ${result}` }],
          }
        }
      )

      server.tool(
        'multiply',
        'Multiply two numbers',
        {
          a: z.number().describe('First number'),
          b: z.number().describe('Second number'),
        },
        async ({ a, b }) => {
          const result = a * b
          return {
            content: [{ type: 'text', text: `${a} × ${b} = ${result}` }],
          }
        }
      )

      server.tool(
        'divide',
        'Divide two numbers',
        {
          a: z.number().describe('Dividend'),
          b: z.number().describe('Divisor (cannot be zero)'),
        },
        async ({ a, b }) => {
          if (b === 0) {
            return {
              content: [
                { type: 'text', text: 'Error: Division by zero is not allowed' },
              ],
            }
          }
          const result = a / b
          return {
            content: [{ type: 'text', text: `${a} ÷ ${b} = ${result}` }],
          }
        }
      )
    },
    // What an MCP client's `initialize` reads back as the server's identity.
    { serverInfo: { name: API_NAME, version: '0.1.0' } },
    {
      basePath: '/',
      maxDuration: 60,
      verboseLogs: true,
    }
  )

// Built on the first request, not at module load: creating the handler starts
// mcp-handler's cleanup timer, and Workers refuse a timer in global scope.
let handler: ReturnType<typeof makeHandler> | undefined

// Mount MCP handler on /mcp route (it handles transport internally)
app.all('/mcp/*', async (c) => {
  handler ??= makeHandler()
  return await handler(c.req.raw)
})

// Keep the original welcome route
app.get('/', (c) => {
  return c.json({
    message: `${API_NAME} - Math Operations`,
    endpoints: {
      mcp: '/mcp',
      description:
        'MCP server with math operation tools (add, subtract, multiply, divide)',
    },
    tools: ['add', 'subtract', 'multiply', 'divide'],
  })
})

// The operational contract: what the deploy's smoke and the bootstrap's probe
// read. It names the server and the environment whose config the Worker runs,
// so a 200 here is this server, deployed to that environment — not any page
// that happens to answer.
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    name: API_NAME,
    environment: c.env?.ENVIRONMENT ?? 'unknown',
  })
})

export default app
