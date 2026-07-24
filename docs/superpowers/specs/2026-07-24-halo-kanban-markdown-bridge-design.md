# Halo Kanban ↔ Kanban Markdown Bridge — Design

**Status:** Draft (awaiting user review)
**Date:** 2026-07-24
**Author:** Nick Vasilopoulos (with Cursor agent)
**Scope:** Add MCP tools that pull a HaloPSA project board into a Kanban Markdown–compatible workspace mirror, and write status moves + notes back to Halo.

## Motivation

[Kanban Markdown](https://marketplace.visualstudio.com/items?itemName=LachyFS.kanban-markdown) makes project work agent-native inside Cursor: cards are markdown files with YAML frontmatter, a visual board reads those files, and agents can create/move/work cards without a SaaS board. That loop is the target UX.

Attuned delivery still runs in HaloPSA Projects (client-visible, billable, portal-backed). Halo’s kanban is a UI over the same project/ticket graph — not a separate board store — so the useful integration is a **Halo-backed mirror** of the Kanban Markdown loop, not a second disconnected board.

Today this MCP has project CRUD (`halo_list/get/create/update_project`) and agent To-Do tools (`/Appointment` + `is_task`), but nothing that lists project child tasks, maps statuses to columns, or materializes a board agents can run from Cursor.

## Decisions (locked)

| Decision | Choice |
| --- | --- |
| Source of truth | **HaloPSA** — pull/refresh overwrite the mirror |
| Surface | **Both** — MCP owns Halo I/O; markdown mirror is Kanban Markdown–compatible |
| Which projects | **On demand** — pull any project when starting work; no always-on sync |
| Write-back (v1) | **Status moves + notes** only |
| Mirror location | **Active coding workspace** under `.halo/kanban/<projectId>/` |
| Approach | MCP tools + file sync; reuse Kanban Markdown for the visual board (no custom Cursor extension) |

## Scope

**In scope (v1):**

- `halo_kanban_pull` — fetch project + child tasks + project statuses; write mirror + Kanban Markdown settings pointers
- `halo_kanban_refresh` — re-pull active/specified project; Halo wins
- `halo_kanban_status` — report active mirror metadata
- `halo_kanban_move` — set Halo task `status_id` from column id or status id; update card file
- `halo_kanban_note` — POST an Action note on the Halo task; append a stamped block to the card body
- `halo_list_project_tasks` — raw task list without touching the filesystem (helper)

**Explicitly out of scope (v1):**

- Create/delete tasks from markdown
- Assignee / priority / due-date / label write-back
- Silent file watcher that auto-pushes markdown edits to Halo
- Always-on multi-project sync / background daemon
- Custom Cursor extension or forking Kanban Markdown
- Milestone / Gantt / dependency editing
- Portal kanban (`kanbanviewontheportal`) specifics

## Architecture

```
HaloPSA (projects / child tasks / statuses / actions)
        ▲
        │ MCP tools (pull, refresh, move, note)
        ▼
halopsa-mcp-server
        │
        ▼ write/read files
.active workspace: .halo/kanban/<projectId>/
  ├── board.json          # sync metadata, status→column map
  └── cards/…             # Kanban Markdown–compatible frontmatter + body
        │
        ▼ (optional UI)
Kanban Markdown extension (featuresDirectory + columns pointed at mirror)
```

Halo remains authoritative. The workspace mirror is disposable cache shaped for agents and the Kanban Markdown UI.

New module: `src/tools/kanban.ts` exporting `registerKanbanTools(server, client)`, registered from `src/tools/index.ts`. Shared helpers for card serialization / status slug mapping live beside it (e.g. `src/tools/kanban-mirror.ts`) so tools stay thin. No auth/client changes beyond using existing `get` / `getList` / `post`.

**Workspace root:** MCP has no implicit Cursor cwd. All file-writing tools require `workspace_path` (absolute path to the coding workspace root).

## Halo data model notes

- Halo Projects are ticket-area entities (`domain=prjs` / project ticket area).
- Project “tasks” are child tickets under a project (`parent_id`, `project_ids`, optional milestones).
- Kanban columns are statuses (project status set via `/Status`, filterable for `prjs`).
- Moving a card = updating the task’s `status_id`.
- Notes = `POST /Actions` on that ticket/task id.
- OpenAPI flags like `kanbanviewontheagentapp` are UI hints on list endpoints; v1 does not depend on them. Prefer explicit `parent_id` / `project_ids` + status lookups.

Exact query param combinations for child-task listing should be validated against `halo.attuned.it` during implementation smoke; if `parent_id={projectId}` is insufficient, fall back to `project_ids` + `includechildren` as discovered.

## Tool specifications

### `halo_kanban_pull`

- **Purpose:** Materialize one Halo project as a Kanban Markdown–compatible mirror.
- **Input:**
  - `project_id: number` — Halo project id
  - `workspace_path: string` — absolute workspace root
- **Halo reads:** `GET /Projects/{id}`; list child tasks; `GET /Status` for project statuses.
- **Filesystem writes (atomic):** replace `.halo/kanban/<projectId>/` via temp dir + rename:
  - `board.json`
  - `cards/` markdown files (flat or status subfolders — match installed Kanban Markdown layout)
  - update workspace settings so Kanban Markdown points at this mirror (`kanban-markdown.featuresDirectory`, `kanban-markdown.columns`)
- **Output:** summary JSON — project id/name, path, `pulled_at`, counts by column.
- **Behavior:** overwrites any prior mirror for that `project_id`. Does not delete mirrors for other project ids.

### `halo_kanban_refresh`

- **Purpose:** Re-sync from Halo; Halo wins over local frontmatter/body edits.
- **Input:** `workspace_path: string`; optional `project_id` (default: last pulled project recorded under `.halo/kanban/` or `board.json` “active” pointer).
- **Behavior:** same write path as pull. Refuse if no mirror/project can be resolved.

### `halo_kanban_status`

- **Purpose:** Inspect local mirror metadata without calling Halo.
- **Input:** `workspace_path: string`; optional `project_id`.
- **Output:** active project id, summary, `pulled_at`, card count, column map, mirror path.

### `halo_kanban_move`

- **Purpose:** Move a card on the Halo board and keep the mirror consistent.
- **Input:**
  - `workspace_path: string`
  - `halo_task_id: number`
  - `status: string` — column id (e.g. `in-progress`) **or**
  - `status_id: number` — Halo status id (one of `status` / `status_id` required)
  - optional `project_id` if multiple mirrors exist
- **Halo write:** update task status (`POST` ticket/project update with `{ id, status_id }`).
- **Filesystem:** update card frontmatter `status` + `halo_status_id`; relocate status subfolder if used.
- **Guards:** refuse if mirror missing/stale project mismatch; unknown column → list valid columns from `board.json`.

### `halo_kanban_note`

- **Purpose:** Leave an agent/human progress note on the Halo task and mirror it into the card.
- **Input:**
  - `workspace_path: string`
  - `halo_task_id: number`
  - `note: string`
  - optional `project_id`
- **Halo write:** `POST /Actions` with ticket/task id + note text (match existing `halo_create_action` patterns).
- **Filesystem:** append:

  ```markdown
  ### Note (2026-07-24T12:00:00.000Z)

  <note text>
  ```

- **Output:** action id + confirmation.

### `halo_list_project_tasks`

- **Purpose:** List child tasks for a project without writing files.
- **Input:** `project_id: number`; standard pagination optional.
- **Output:** trimmed task rows — id, summary, status, status_id, agent, priority, dates, parent/project ids.

## Mirror layout

```
.halo/kanban/<projectId>/
  board.json
  cards/
    <halo-task-id>-<slug>.md
```

Optional active pointer (for refresh default):

```
.halo/kanban/active.json
→ { "project_id": 42, "path": ".halo/kanban/42" }
```

### `board.json`

```json
{
  "project_id": 42,
  "project_summary": "Client X — Okta rollout",
  "pulled_at": "2026-07-24T12:00:00.000Z",
  "workspace_root": "/path/to/workspace",
  "columns": [
    {
      "id": "to-do",
      "name": "To Do",
      "color": "#3b82f6",
      "halo_status_id": 1
    }
  ]
}
```

Column `id` is a stable slug derived from the Halo status name (lowercase, hyphenated). Colors may be assigned from a fixed palette by column index when Halo does not supply one.

### Card frontmatter (Kanban Markdown–compatible)

```markdown
---
id: "halo-12345"
status: "in-progress"
priority: "medium"
assignee: "nick"
dueDate: "2026-07-30"
created: "2026-07-01T10:30:00.000Z"
modified: "2026-07-24T14:20:00.000Z"
labels: ["halo", "project:42"]
order: 0
halo_task_id: 12345
halo_project_id: 42
halo_status_id: 3
---

# Task summary from Halo

Task details body (trimmed to a safe length)...
```

Required Kanban Markdown fields: `id`, `status`, plus body heading. Halo ids live in `halo_*` keys so round-trips never depend on parsing the display `id`.

### Extension wiring

On pull/refresh, merge into workspace `.vscode/settings.json` (create if missing; preserve unrelated keys):

- `kanban-markdown.featuresDirectory` → `.halo/kanban/<projectId>/cards`
- `kanban-markdown.columns` → column objects from `board.json` (`id`, `name`, `color`)

If the installed Kanban Markdown version organizes cards into status subfolders, pull writes `cards/<status>/<file>.md` and move relocates files accordingly. Prefer matching the extension’s current default behavior during implementation.

## Sync rules

| Direction | When | Policy |
| --- | --- | --- |
| Halo → files | `pull`, `refresh` | Overwrite mirror |
| Files/MCP → Halo | `move`, `note` only | Explicit calls; no silent watcher in v1 |
| Conflicts | refresh after local edits | Halo wins |

Agents or UI that only edit markdown **must** call `halo_kanban_move` / `halo_kanban_note` to persist to Halo. This avoids surprise writes while drafting card text.

## Data flow

### Pull

1. Validate `workspace_path`.
2. Fetch project, child tasks, project statuses.
3. Build column map + card models.
4. Write to temp dir under workspace; atomic replace `.halo/kanban/<projectId>/`.
5. Update `active.json` + Kanban Markdown settings.
6. Return summary.

### Move

1. Load `board.json`; resolve column → `halo_status_id`.
2. Update Halo task status.
3. Patch/move local card.
4. Return before/after.

### Note

1. Verify task exists in mirror (or optionally fetch from Halo if missing).
2. POST Action.
3. Append note block to card body.
4. Return action id.

## Errors

- Missing/invalid `workspace_path` → error, no Halo write.
- Unknown project/task → Halo error via existing `errorResult`.
- Unknown column on move → list valid columns from `board.json`.
- No mirror / project mismatch → refuse move/note until pull.
- Partial pull failure → no half-written board (temp + atomic replace).
- Settings merge failure → still leave mirror files; report settings warning in tool output.

## Agent usage sketch

```
halo_kanban_pull({ project_id, workspace_path })
→ open Kanban Markdown board / read cards
→ implement work for a card
→ halo_kanban_note({ workspace_path, halo_task_id, note })
→ halo_kanban_move({ workspace_path, halo_task_id, status: "review" })
```

## Files to add/change

| File | Change |
| --- | --- |
| `src/tools/kanban.ts` | Register the six kanban tools |
| `src/tools/kanban-mirror.ts` (or similar) | Board/card serialize, slug map, atomic write, settings merge |
| `src/tools/index.ts` | `registerKanbanTools` |
| `README.md` | Document kanban tools + mirror layout |
| `.gitignore` (workspace consumers) | Document ignoring `.halo/kanban/` in client repos (optional note in README; do not force-ignore in this MCP repo unless we add example fixtures) |

## Testing / verification

Match existing repo pattern (no new test framework in this change):

1. `npm run build` — TypeScript compile clean.
2. Manual smoke against Halo:
   - pull known project → files on disk + settings pointers
   - move one task → Halo status + card frontmatter agree
   - note → Action created + body append
   - refresh → local drift overwritten (Halo wins)
3. No live Halo credentials in CI for this feature.

## Risks

| Risk | Mitigation |
| --- | --- |
| Child-task filter params differ from OpenAPI guesses | Smoke against attuned tenant; keep list helper parameterized |
| Kanban Markdown layout drift (subfolders vs flat) | Detect/adapt to extension defaults; keep frontmatter `status` canonical |
| `.vscode/settings.json` merge surprises | Merge only `kanban-markdown.*` keys; never wipe unrelated settings |
| Large project boards / huge `details` fields | Trim body; paginate task fetch; keep card list fields lean |
| Agents edit markdown status without calling move | Tool descriptions + README state explicitly; v2 may add `halo_kanban_push` |

## Future (not v1)

- `halo_kanban_push` — scan frontmatter deltas and batch status writes
- Create/close tasks from cards
- File watcher / debounce push
- Multi-project dashboards
- Skill file (`kanban-halo`) mirroring [kanban-skill](https://github.com/LachyFS/kanban-skill) for agent UX
- Richer field sync (assignee, priority, due date)
