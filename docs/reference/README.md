# Halo OpenAPI reference snapshots

Offline copies of the Halo REST API v2 OpenAPI spec for diffing against Attuned's live tenant.

| File | Source |
| --- | --- |
| `halo-openapi-v2.potatopsa.json` | Embedded in [usehalo.com/swagger](https://usehalo.com/swagger/) (`haloswagger.html` save) |
| `halo-openapi-v2.attuned.json` | Live fetch from `halo.attuned.it/api/swagger/v2/swagger.json` |
| `openapi-diff.md` | Human-readable drift summary |

Refresh:

```bash
python3 scripts/diff-openapi.py
python3 scripts/diff-openapi.py ~/Downloads/haloswagger.html
```

Use when planning MCP tools — see also [`billing-tools-roadmap.md`](../billing-tools-roadmap.md).
