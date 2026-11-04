# Daylight MCP service

A separate Node/TypeScript [MCP Streamable HTTP](https://modelcontextprotocol.io/) server for Daylight. Uses the official `@modelcontextprotocol/sdk` with Zod input validation. Requires Node 22 or newer.

## Setup

```bash
cd mcp
npm install
cp .env.example .env
# Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
npm run check
npm start
```

The service listens at `http://localhost:8787/mcp`. Deploy it to a long-running Node host (Fly.io, Railway or Render) with the same server-only environment variables and an HTTPS endpoint. GitHub Pages cannot host an MCP HTTP server. **This standalone service has not yet been deployed;** the separately deployed Supabase Edge endpoint can be used for preliminary MCP testing.

All token hashes live in `mcp_tokens`. The service never exposes its service-role credential to the browser. Every tool request checks token ownership, scopes and revocation. Deletion also requires the owner's independent `mcp_allow_delete` setting and adds an audit record.

### MCP client

Configure Streamable HTTP URL `https://YOUR-MCP-HOST/mcp` and header `Authorization: Bearer YOUR_DAYLIGHT_TOKEN`. Create a token from Daylight Settings → AI access in the development branch after it is deployed.

### Smoke tests

`npm run smoke` requires `MCP_READ_TOKEN` and `MCP_WRITE_TOKEN` plus a running service. It performs non-destructive read/write checks by default, and tests deletion only when explicitly opted in.

Never commit `.env` or raw bearer tokens. Cloud event and task data is kept in `workspace_snapshots` until the normalized-table migration is completed.
