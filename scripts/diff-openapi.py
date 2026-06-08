#!/usr/bin/env python3
"""Refresh Halo OpenAPI reference snapshots and write docs/reference/openapi-diff.md.

Usage:
  python3 scripts/diff-openapi.py
  python3 scripts/diff-openapi.py ~/Downloads/haloswagger.html

Reads potatopsa baseline from haloswagger.html (or keeps existing potato JSON),
fetches live spec from HALOPSA_* in .env, writes JSON + diff report.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
REF = REPO / "docs" / "reference"
POTATO_JSON = REF / "halo-openapi-v2.potatopsa.json"
ATTUNED_JSON = REF / "halo-openapi-v2.attuned.json"
DIFF_MD = REF / "openapi-diff.md"
DEFAULT_HTML = Path.home() / "Downloads" / "haloswagger.html"
BILLING_RE = re.compile(
    r"invoice|recurr|quote|payment|timesheet|contract|item|supplier|"
    r"billing|tax|expense|purchase|sales",
    re.I,
)


def load_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in (REPO / ".env").read_text().splitlines():
        if "=" in line and not line.strip().startswith("#"):
            key, value = line.split("=", 1)
            env[key.strip()] = value.strip()
    return env


def extract_openapi_from_html(html_path: Path) -> dict:
    html = html_path.read_text(encoding="utf-8", errors="replace")
    start = html.find('{\n  "openapi"')
    if start < 0:
        start = html.find('{"openapi"')
    if start < 0:
        raise SystemExit(f"No embedded OpenAPI JSON in {html_path}")

    depth = 0
    end = start
    for index, char in enumerate(html[start:], start):
        if char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                end = index + 1
                break

    return json.loads(html[start:end])


def fetch_attuned_spec(env: dict[str, str]) -> dict:
    base = env["HALOPSA_BASE_URL"].rstrip("/")
    auth = env.get("HALOPSA_AUTH_URL", f"{base}/auth").rstrip("/")
    body = urllib.parse.urlencode(
        {
            "grant_type": "client_credentials",
            "client_id": env["HALOPSA_CLIENT_ID"],
            "client_secret": env["HALOPSA_CLIENT_SECRET"],
            "scope": env.get("HALOPSA_SCOPE", "all"),
        }
    ).encode()
    token_req = urllib.request.Request(
        f"{auth}/token?tenant={urllib.parse.quote(env['HALOPSA_TENANT'])}",
        data=body,
        method="POST",
    )
    token_req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(token_req, timeout=30) as response:
        token = json.loads(response.read())["access_token"]

    spec_req = urllib.request.Request(f"{base}/api/swagger/v2/swagger.json")
    spec_req.add_header("Authorization", f"Bearer {token}")
    with urllib.request.urlopen(spec_req, timeout=120) as response:
        return json.loads(response.read())


def path_methods(spec: dict) -> dict[str, tuple[str, ...]]:
    return {
        path: tuple(sorted(ops.keys()))
        for path, ops in spec.get("paths", {}).items()
    }


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


def build_report(potato: dict, attuned: dict) -> str:
    p_pot = path_methods(potato)
    p_att = path_methods(attuned)
    only_pot = sorted(set(p_pot) - set(p_att))
    only_att = sorted(set(p_att) - set(p_pot))
    method_diff = [
        (path, p_pot[path], p_att[path])
        for path in sorted(set(p_pot) & set(p_att))
        if p_pot[path] != p_att[path]
    ]

    schemas_pot = set(potato.get("components", {}).get("schemas", {}))
    schemas_att = set(attuned.get("components", {}).get("schemas", {}))

    billing_only_pot = [p for p in only_pot if BILLING_RE.search(p)]
    billing_only_att = [p for p in only_att if BILLING_RE.search(p)]
    billing_method_diff = [
        (path, a, b) for path, a, b in method_diff if BILLING_RE.search(path)
    ]

    lines = [
        "# Halo OpenAPI diff — potatopsa baseline vs attuned.it live",
        "",
        f"**Generated:** {date.today().isoformat()}  ",
        "**Sources:**",
        "- `halo-openapi-v2.potatopsa.json` — [usehalo.com/swagger](https://usehalo.com/swagger/) embed",
        "- `halo-openapi-v2.attuned.json` — live `halo.attuned.it/api/swagger/v2/swagger.json`",
        "",
        "## Summary",
        "",
        "| Metric | potatopsa (docs) | attuned.it (live) |",
        "| --- | ---: | ---: |",
        f"| Paths | {len(p_pot)} | {len(p_att)} |",
        f"| Schemas | {len(schemas_pot)} | {len(schemas_att)} |",
        f"| Paths only in potatopsa | {len(only_pot)} | — |",
        f"| Paths only in attuned | — | {len(only_att)} |",
        f"| Paths with method differences | {len(method_diff)} | {len(method_diff)} |",
        f"| Schemas only in potatopsa | {len(schemas_pot - schemas_att)} | — |",
        f"| Schemas only in attuned | — | {len(schemas_att - schemas_pot)} |",
        "",
        "## Billing-related drift",
        "",
        "| Category | Count |",
        "| --- | ---: |",
        f"| Billing paths only in potatopsa | {len(billing_only_pot)} |",
        f"| Billing paths only in attuned | {len(billing_only_att)} |",
        f"| Billing paths with method diff | {len(billing_method_diff)} |",
        "",
    ]

    if only_att:
        lines += ["### Paths only on attuned.it (newer / tenant-specific)", ""]
        for path in only_att:
            lines.append(f"- `{path}` — {', '.join(p_att[path])}")
        lines.append("")

    if only_pot:
        lines += ["### Paths only in potatopsa docs embed (removed or not on attuned)", ""]
        for path in only_pot:
            lines.append(f"- `{path}` — {', '.join(p_pot[path])}")
        lines.append("")

    if method_diff:
        lines += ["### Method differences (same path, different verbs)", ""]
        for path, potato_methods, attuned_methods in method_diff:
            lines.append(
                f"- `{path}`: potatopsa `{', '.join(potato_methods)}` "
                f"→ attuned `{', '.join(attuned_methods)}`"
            )
        lines.append("")

    schema_only_att = sorted(schemas_att - schemas_pot)
    if schema_only_att:
        lines += ["### Schemas only on attuned.it", ""]
        for name in schema_only_att[:20]:
            lines.append(f"- `{name}`")
        if len(schema_only_att) > 20:
            lines.append(f"\n_…and {len(schema_only_att) - 20} more._")
        lines.append("")

    lines += [
        "## Regenerating",
        "",
        "```bash",
        "python3 scripts/diff-openapi.py",
        "python3 scripts/diff-openapi.py ~/Downloads/haloswagger.html",
        "```",
        "",
        "Re-run when Halo ships a platform update or after saving a new page from usehalo.com/swagger.",
    ]
    return "\n".join(lines) + "\n"


def main() -> None:
    REF.mkdir(parents=True, exist_ok=True)
    html_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_HTML

    if html_path.exists():
        potato = extract_openapi_from_html(html_path)
        write_json(POTATO_JSON, potato)
        print(f"Updated {POTATO_JSON.name} from {html_path}")
    elif POTATO_JSON.exists():
        potato = json.loads(POTATO_JSON.read_text())
        print(f"Using existing {POTATO_JSON.name}")
    else:
        raise SystemExit(f"No {html_path} and no existing potato JSON")

    attuned = fetch_attuned_spec(load_env())
    write_json(ATTUNED_JSON, attuned)
    print(f"Updated {ATTUNED_JSON.name} from live API")

    DIFF_MD.write_text(build_report(potato, attuned), encoding="utf-8")
    print(f"Wrote {DIFF_MD.relative_to(REPO)}")


if __name__ == "__main__":
    main()
