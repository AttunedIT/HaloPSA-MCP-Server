# QA preflight — halopsa-mcp-server

Workspace standard: [`/Projects/docs/CODE_PREFLIGHT_STANDARD.md`](../../../docs/CODE_PREFLIGHT_STANDARD.md)

## CI (source of truth)

Workflow: [`.github/workflows/ci.yml`](../.github/workflows/ci.yml)

| Job | What it catches |
|-----|-----------------|
| **build** | TypeScript compile (`npm run build`) |
| **audit** | High/critical npm vulnerabilities |
| **secrets** | Committed credentials (gitleaks) |

## Local preflight

```bash
cd /Users/nickvasilopoulos/Projects/halopsa-mcp-server
npm ci
npm run build
npm audit --audit-level=high
# Optional: gitleaks detect --source . --config .gitleaks.toml
```

## Agent skills

| Skill | Use when |
|-------|----------|
| **code-preflight** | Default orchestrator |
| **halopsa-mcp-security-review** | OAuth, Halo tokens, destructive tools, KB/ticket data in logs |
| **halopsa-mcp-qa-smoke** | Build, tool handler changes, API client behavior |

## Merge bar

1. CI green.
2. Security lane: no credential leakage; delete/update tools appropriately gated.
3. Smoke lane: `npm run build` passes.
