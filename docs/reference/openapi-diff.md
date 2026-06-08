# Halo OpenAPI diff — potatopsa baseline vs attuned.it live

**Generated:** 2026-06-07  
**Sources:**
- `halo-openapi-v2.potatopsa.json` — [usehalo.com/swagger](https://usehalo.com/swagger/) embed
- `halo-openapi-v2.attuned.json` — live `halo.attuned.it/api/swagger/v2/swagger.json`

## Summary

| Metric | potatopsa (docs) | attuned.it (live) |
| --- | ---: | ---: |
| Paths | 951 | 952 |
| Schemas | 756 | 760 |
| Paths only in potatopsa | 1 | — |
| Paths only in attuned | — | 2 |
| Paths with method differences | 0 | 0 |
| Schemas only in potatopsa | 0 | — |
| Schemas only in attuned | — | 4 |

## Billing-related drift

| Category | Count |
| --- | ---: |
| Billing paths only in potatopsa | 0 |
| Billing paths only in attuned | 0 |
| Billing paths with method diff | 0 |

### Paths only on attuned.it (newer / tenant-specific)

- `/IntegrationData/Get/BeyondTrust/Code` — get
- `/TakeControl/GetUrl` — get

### Paths only in potatopsa docs embed (removed or not on attuned)

- `/ApprovalStore` — post

### Schemas only on attuned.it

- `StdRequestCustomField`
- `TStatus_List`
- `UserRoleMapping`
- `UserRoleRules`

## Regenerating

```bash
python3 scripts/diff-openapi.py
python3 scripts/diff-openapi.py ~/Downloads/haloswagger.html
```

Re-run when Halo ships a platform update or after saving a new page from usehalo.com/swagger.
