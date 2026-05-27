# halopsa-mcp-server

MCP server for HaloPSA — tickets, clients, assets, KB, invoicing, and related PSA operations.

## QA preflight

[`docs/QA_PREFLIGHT.md`](docs/QA_PREFLIGHT.md) · workspace [`/Projects/docs/CODE_PREFLIGHT_STANDARD.md`](../docs/CODE_PREFLIGHT_STANDARD.md)

Cursor skills: **code-preflight**, **halopsa-mcp-security-review**, **halopsa-mcp-qa-smoke**.

## Development

```bash
npm ci
npm run build
npm run dev   # tsx src/index.ts
```

Environment: Halo OAuth and API base URL via env (see `src/config.ts`). Never commit `.env`.
