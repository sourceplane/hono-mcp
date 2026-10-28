// The server's identity, written once. GET /health answers with API_NAME, and
// an MCP client's `initialize` reads it back as the server's name, so a
// deploy's smoke, an operator's curl and a connected client all see which
// server answered. The Orun bootstrap that creates a product rewrites it to
// that product's name, so keep it literal and on one line.
export const API_NAME = "Hono MCP Server"
