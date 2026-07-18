# Task 023: API Lifecycle Stabilization and Dev Data Cleanup Plan

## Status

Review and documentation completed locally. No API behavior, infrastructure behavior, deployment,
direct DynamoDB write/delete, dev data cleanup, or commit was performed by this task.

## Current Route Matrix

| Route                          | Auth         | Request body                                                                                            | Success response                                                 | Repository method          | Domain method                                      |
| ------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------- | -------------------------------------------------- |
| `GET /health`                  | Public       | None                                                                                                    | `200` health JSON                                                | None                       | None                                               |
| `GET /invoices`                | JWT required | Query string only: `kind`, `search`, `sortBy`, `sortDirection`, `pageSize`, `cursor`                    | `200` with `items` and optional `nextCursor`                     | `list`                     | None                                               |
| `GET /invoices/{id}`           | JWT required | None                                                                                                    | `200` with serialized `invoice` and opaque `version`             | `getById`                  | None                                               |
| `POST /invoices/drafts`        | JWT required | Optional `{ "draft": { ... } }` with supported draft fields                                             | `201` with serialized draft and opaque `version`                 | `createDraft`              | `createDraftInvoice`, draft edit helpers for lines |
| `PUT /invoices/drafts/{id}`    | JWT required | `{ "expectedVersion": "...", "draft": { ... } }`                                                        | `200` with serialized draft and new opaque `version`             | `getById`, `updateDraft`   | draft edit helpers                                 |
| `DELETE /invoices/drafts/{id}` | JWT required | `{ "expectedVersion": "..." }`                                                                          | `200` with deleted draft `id`                                    | `discardDraft`             | None                                               |
| `POST /invoices/{id}/finalize` | JWT required | `{ "expectedVersion": "...", "invoiceNumber": "...", "finalizedAt": "..." }`; `finalizedAt` is optional | `200` with serialized finalized invoice and new opaque `version` | `getById`, `saveFinalized` | `finalizeInvoice`                                  |
| `POST /invoices/{id}/void`     | JWT required | `{ "expectedVersion": "...", "voidReason": "...", "voidedAt": "..." }`; `voidedAt` is optional          | `200` with serialized voided invoice and new opaque `version`    | `getById`, `saveVoided`    | `voidInvoice`                                      |

## Request and Response Notes

- Draft create accepts optional `draft.id`, `business.displayName`, `customer.displayName`,
  `issueDate`, `dueDate`, `notes`, and `lines`.
- Draft update requires at least one supported mutable draft field in `draft`.
- Draft line `quantity` and `unitPrice` are strings. Unit prices are parsed through the money
  parser; callers do not submit trusted calculated totals.
- Finalize requires an explicit invoice number. Automatic invoice-number sequencing remains out of
  scope.
- Void requires a reason. The handler voids the current finalized aggregate loaded from storage;
  callers do not submit an authoritative voided snapshot.
- Successful invoice-bearing responses return canonical serialized invoice data and an opaque
  repository version token.

## Error Mapping

The current API consistently emits JSON errors shaped as:

```json
{
  "error": {
    "code": "error_code",
    "message": "Human-readable message."
  }
}
```

Observed route and repository mappings:

- Missing or unresolved JWT owner: `401 unauthorized`.
- Malformed JSON, unsupported fields, invalid IDs, invalid query parameters, invalid
  `expectedVersion`, invalid invoice number, invalid timestamps, and domain validation errors:
  `400`.
- Missing invoice records: `404 invoice_not_found`.
- Duplicate draft IDs, stale versions, non-draft update/delete/finalize attempts, non-finalized
  void attempts, duplicate invoice numbers, and repository-reported lifecycle conflicts: `409`.
- DynamoDB or repository availability failures: `503 repository_unavailable`.
- Invalid stored invoice records and repository invariant violations: `500`.
- Unknown routes return `404 not_found`.

ADR 0009 still describes unexpected failures as a non-revealing `500`; the implemented repository
availability path now intentionally maps DynamoDB availability failures to `503`.

## Owner Scoping

- The owner is resolved from API Gateway JWT claims in `apps/api/src/auth/owner.ts`.
- The handler prefers the `sub` claim and falls back to `username` only when `sub` is absent.
- Request body owner fields are ignored where accepted for backward-compatible body tolerance.
- Request bodies cannot override the trusted owner.
- `createInvoiceRepository(ownerId)` creates an owner-scoped DynamoDB adapter instance, so every
  repository operation uses owner-partition keys.

## Version and Concurrency

- `PUT /invoices/drafts/{id}`, `DELETE /invoices/drafts/{id}`,
  `POST /invoices/{id}/finalize`, and `POST /invoices/{id}/void` all require
  `expectedVersion`.
- Versions are parsed through the repository version parser and treated as opaque tokens.
- Stale versions are covered by API tests and DynamoDB adapter tests.
- The DynamoDB adapter uses conditional writes for draft update, draft discard, and void
  persistence.
- Finalization reserves invoice numbers atomically with the finalized invoice write.

## Data Safety Summary

- Draft delete only discards drafts. Finalized and voided invoice hard deletion is intentionally not
  implemented.
- Voiding preserves the finalized snapshot and totals.
- Voiding does not release or rewrite invoice-number reservations.
- Duplicate invoice numbers return conflict, including after the original invoice is voided.
- The API does not accept caller-supplied authoritative totals, payments, finalized snapshots, or
  voided snapshots.
- Financial values use domain money primitives and integer minor units; floating-point currency math
  remains prohibited.

## Dev Data Status

The dev DynamoDB table contains verification data from earlier deployment tasks. Current task notes
show the table was emptied after draft-delete verification, then later tasks added finalizable
drafts, finalized invoices, voided invoices, invoice-number reservations, and conflict-test drafts.
Task 022B recorded a read-only count of `20` items after successful void verification.

The expected record kinds now include:

- draft invoice records created for create/update/finalization/void conflict checks;
- finalized invoice records from finalization verification;
- voided invoice records from void verification;
- invoice-number reservation records for finalized and voided invoices.

## Dev Data Cleanup Plan

Do not delete dev data casually with direct DynamoDB commands. The table stores owner-partitioned
invoice records and invoice-number reservation records whose lifecycle relationships matter; manual
deletes can leave orphaned reservations, permit accidental number reuse, or remove evidence needed
to diagnose API behavior.

Recommended future direction: make dev cleanup a separate Task 024 and implement a dev-only cleanup
command or script, not a public API route.

The cleanup tool should:

- require `environment=dev` explicitly and refuse production;
- discover or require the target dev owner partition intentionally;
- list matching invoice and reservation counts before deleting;
- require an interactive confirmation or equivalent explicit approval;
- delete all records for one known dev owner partition, including invoice records and matching
  invoice-number reservations;
- avoid exposing cleanup through browser or public API routes;
- avoid storing credentials, tokens, full Cognito IDs, live URLs, or account IDs in committed files;
- provide a dry-run mode and a final read-only count check.

Whether the implementation uses API-based cleanup or DynamoDB-admin cleanup should be decided in
Task 024. API-based cleanup would exercise normal authorization and lifecycle rules but cannot
currently delete finalized/voided invoices by design. DynamoDB-admin cleanup can clear dev
verification data completely, but must be tightly guarded because it bypasses lifecycle rules.

## Recommended Next Tasks

- Task 024: dev data cleanup utility plan/implementation.
- Task 025: API client package integration for the authenticated invoice routes.
- Task 026: web app auth wiring.
- Task 027: web invoice dashboard integration.
- Task 028: invoice form workflow integration.

## Proposed commit message

```text
docs(api): summarize lifecycle stabilization
```
