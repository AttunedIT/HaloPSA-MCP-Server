# Billing & Accounting Tools — Roadmap

**Date**: 2026-06-08  
**Author**: Nick Vasilopoulos (Attuned IT)  
**Repository**: AttunedIT/halopsa-mcp-server (fork of Tim-ImpendingTech / TheBigPieceOfChicken)

---

## Purpose

Track what billing/accounting coverage exists in the MCP server today, what the Halo REST API exposes, and what to build next. Complements the completed work in [`design-improvements.md`](design-improvements.md) (Phases 1–4) and post-spec additions (runbooks, agent To-Do).

**API reference**

- Public docs portal: [usehalo.com/swagger](https://usehalo.com/swagger/) (HaloAPI Docs)
- Live OpenAPI 3.0.1 spec (auth required): `{HALOPSA_BASE_URL}/api/swagger/v2/swagger.json`
- Offline snapshots + drift report: [`docs/reference/`](reference/) (regenerate with `python3 scripts/diff-openapi.py`)
- As of 2026-06-08 on `halo.attuned.it`: **952 paths**, **91 billing-related base resources**, **7 covered** by MCP

---

## Completed (prior plans)

| Source | Scope | Status |
| --- | --- | --- |
| `design-improvements.md` Phase 1 | Fix lookups, trim `get_ticket` | Done |
| Phase 2 | Delete ticket/action | Done |
| Phase 3 | Time & billing via `/Actions` | Done |
| Phase 4 | Invoice list filters, details, create | Done |
| Runbook tools spec (2026-04-17) | `/WebhookRepository` + `/Webhook` CRUD | Done |
| Agent To-Do tools (2026-06-07) | `/Appointment` with `is_task: true` | Done (committed; reload MCP to expose) |

### Billing tools shipped today

| Tool | API | Notes |
| --- | --- | --- |
| `halo_list_invoices` | `GET /Invoice` | Filters: client, status, date range |
| `halo_get_invoice` | `GET /Invoice/{id}` | Full payload |
| `halo_get_invoice_details` | `GET /Invoice/{id}` | Trimmed header + line items |
| `halo_create_invoice` | `POST /Invoice` | Client + optional tickets/date range |
| `halo_update_invoice_lines` | `POST /Invoice/updatelines` | Edit/add line items on draft invoices |
| `halo_void_invoice` | `POST /Invoice/{id}/void` | Requires `confirm: true` |
| `halo_get_invoice_pdf` | `POST /Invoice/PDF/{id}` | Returns `pdf_attachment_id` + `printhtml` |
| `halo_list_recurring_invoices` | `GET /RecurringInvoice` | Read-only |
| `halo_get_recurring_invoice` | `GET /RecurringInvoice/{id}` | Read-only |
| `halo_list_items` | `GET /Item` | Product/service catalogue |
| `halo_get_item` | `GET /Item/{id}` | |
| `halo_list_suppliers` | `GET /Supplier` | |
| `halo_get_supplier` | `GET /Supplier/{id}` | |
| `halo_list_contracts` | `GET /ClientContract` | |
| `halo_get_contract` | `GET /ClientContract/{id}` | |
| `halo_list_quotations` | `GET /Quotation` | Read-only |
| `halo_get_quotation` | `GET /Quotation/{id}` | Read-only |
| `halo_list_time_entries` | `GET /Actions` | Time = actions with `timetaken > 0` |
| `halo_create_time_entry` | `POST /Actions` | |
| `halo_update_time_entry` | `POST /Actions` | |
| `halo_delete_time_entry` | `DELETE /Actions/{id}` | Requires `confirm: true` |
| `halo_get_billable_summary` | `GET /Actions` | Aggregated hours |
| `halo_unbilled_time` | `GET /Actions` | Compound: unbilled by client |
| `halo_weekly_timesheet` | `GET /Actions` | Compound: agent week view |

### Intentional non-coverage

| Swagger | MCP choice |
| --- | --- |
| `/Timesheet`, `/TimesheetEvent` | Ticket time via `/Actions` (see design-improvements Phase 3) |
| `/ToDo`, `/ToDoGroup` | Ticket checklist templates — not the agent To-Do widget |
| Agent To-Do widget | `/Appointment` + `is_task: true` (separate from `/ToDo`) |

---

## Swagger gap summary

Billing/accounting base resources in OpenAPI vs MCP implementation (2026-06-08):

| Metric | Count |
| --- | ---: |
| Total Swagger paths | 952 |
| Unique API bases used by MCP | 26 |
| Billing-related base resources | 91 |
| Billing bases with MCP coverage | 7 |
| Billing bases missing | 84 |

**Covered billing bases:** `/Appointment`, `/ClientContract`, `/Invoice`, `/Item`, `/Quotation`, `/RecurringInvoice`, `/Supplier`

---

## Tier A — MSP billing operations (build next)

Highest ROI for Attuned monthly billing workflow: draft/edit invoices, run recurring billing, record payments.

| Priority | Proposed tool(s) | Swagger endpoint(s) | Use case |
| ---: | --- | --- | --- |
| A1 | `halo_update_invoice_lines` | `POST /Invoice/updatelines` | Edit draft invoice line items before send |
| A2 | `halo_void_invoice` | `POST /Invoice/{id}/void` | Void an issued invoice |
| A3 | `halo_get_invoice_pdf` | `POST /Invoice/PDF/{id}` | Export PDF for client / records |
| A4 | `halo_record_invoice_payment` | `GET/POST /InvoicePayment`, `GET/DELETE /InvoicePayment/{id}` | Log payments against invoices |
| A5 | `halo_process_recurring_invoice` | `POST /RecurringInvoice/process` | Trigger recurring invoice generation |
| A6 | `halo_update_recurring_invoice_lines` | `POST /RecurringInvoice/updatelines`, `POST /RecurringInvoice/Lines` | Maintain recurring line items |
| A7 | `halo_create_quotation`, `halo_update_quotation`, `halo_add_quotation_lines` | `POST /Quotation`, `POST /Quotation/Lines`, `GET/DELETE /Quotation/{id}` | Quote creation and line editing |
| A8 | `halo_approve_quotation` | `POST /Quotation/Approval` | Quote approval workflow |
| A9 | `halo_list_contract_schedules`, `halo_get_contract_schedule` | `GET /ContractSchedule`, `GET /ContractSchedule/{id}` | Read contract billing schedules |
| A10 | `halo_list_contract_rules` | `GET /ContractRule`, `GET /ContractRule/{id}` | Contract billing rules (read-first) |

**Suggested first implementation slice (A1–A3):** invoice line edit, void, PDF — smallest surface, immediate operator value, extends existing `invoices.ts`.

| Tool | Status |
| --- | --- |
| `halo_update_invoice_lines` (A1) | **Done** (2026-06-08) |
| `halo_void_invoice` (A2) | **Done** (2026-06-08) |
| `halo_get_invoice_pdf` (A3) | **Done** (2026-06-08) |

**Next slice (A4–A6):** payments + recurring invoice processing.

---

## Tier B — Catalogue, inventory, accounting links

| Area | Missing Swagger bases | Notes |
| --- | --- | --- |
| Item CRUD | `POST/DELETE /Item/{id}`, `/ItemGroup` | Full product catalogue management |
| Stock | `/ItemStock`, `/ItemStockHistory` | Inventory tracking |
| Accounting bridge | `/ItemAccountsLink`, `POST /Item/NewAccountsId` | Nominal / accounts integration |
| Supplier CRUD | `POST/DELETE /Supplier/{id}`, `/SupplierContract` | Vendor management |
| Software licences | `/SoftwareLicence`, `/SoftwareLicenceRole` | Subscription assets |
| Rate cards | `/ChargeRate` | Billing rates |
| Templates | `/BillingTemplate` | Invoice/billing templates |
| Cost centres | `/CostCentres` | Cost allocation |
| Tax | `/Tax`, `/TaxRule`, `/Currency` | Tax and currency config |

---

## Tier C — Procurement, expenses, integrations

| Area | Missing Swagger bases | Notes |
| --- | --- | --- |
| Purchase orders | `/PurchaseOrder`, `POST /PurchaseOrder/confirmreceipt` | Hardware/software PO workflow |
| Sales orders | `/SalesOrder` | Post-quote fulfilment |
| Expenses | `/Expense` | Expense claims |
| Payments (GoCardless) | `GET /IntegrationData/Get/GoCardless/Payments` | Direct debit visibility |
| Subscriptions import | `POST /IntegrationData/Import/IngramMicro/Subscriptions` | Distributor sync |
| Client billing profile | `POST /Client/PaymentMethodUpdate` | Payment method updates |

---

## Tier D — Deferred / low priority

- Full CRUD on every billing entity (84 missing bases) — not worth chasing exhaustively
- Reporting/analytics endpoints — out of scope per original design spec
- Workflow/automation editing beyond runbooks — too risky via API for agent use
- Standalone `/Timesheet` unless ticket-via-Actions proves insufficient

---

## Implementation conventions

All new billing tools should follow existing repo patterns:

- New tools live in `src/tools/invoices.ts` (extend) or dedicated files (`quotations-write.ts`, `contract-billing.ts`) if a module exceeds ~200 lines
- Register in `src/tools/index.ts`
- Zod input schemas, `errorResult()` for errors, `paginationSchema` on lists
- POST bodies array-wrapped by `HaloApiClient`
- Destructive ops require `confirm: true`
- Trim responses — do not dump raw 100KB+ invoice JSON unless `include_full_details` is explicitly requested
- Probe live API on `halo.attuned.it` before assuming field names (Halo is inconsistent across endpoints)

---

## Verification checklist (per tool)

- [ ] `npm run build` clean
- [ ] Dry-run against `halo.attuned.it` with test client (Attuned IT, id 12) where safe
- [ ] No secrets or client PII in tool descriptions or default logs
- [ ] Update README tool table when a tranche ships
- [ ] `halopsa-mcp-qa-smoke` / `halopsa-mcp-security-review` for write tools

---

## Related docs

- [`design-improvements.md`](design-improvements.md) — original Phases 1–4 (complete)
- [`superpowers/specs/2026-04-17-runbook-tools-design.md`](superpowers/specs/2026-04-17-runbook-tools-design.md) — runbook tools
- [`QA_PREFLIGHT.md`](QA_PREFLIGHT.md) — CI and pre-merge gates
