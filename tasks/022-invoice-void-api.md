# Task 022: Invoice Void API

## Status

Implemented locally; ready for review after verification. No deployment or commit was performed by
this task.

## Objective

Implement the authenticated void path:

```text
POST /invoices/{id}/void
```

The route voids an existing finalized invoice for the authenticated owner using the existing
invoice-domain voiding behavior and the owner-scoped invoice repository.

## Request body

Supported minimal JSON shape:

```json
{
  "expectedVersion": "v...",
  "voidReason": "Customer cancelled",
  "voidedAt": "2026-07-09T00:00:00.000Z"
}
```

`expectedVersion` and `voidReason` are required. `voidedAt` is optional; when omitted, the handler
clock supplies the void timestamp. The path `{id}` is the invoice ID. Request-body `id`, owner
fields, totals, and payments are ignored when present and cannot override the path ID, JWT-derived
owner, existing finalized snapshot, or repository-scoped invoice number reservation.

## Behavior implemented

- Requires an authenticated owner resolved from JWT claims.
- Parses and validates the path invoice ID.
- Parses JSON request bodies and returns `400 bad_request` for malformed JSON or unsupported void
  fields.
- Requires and validates `expectedVersion` with the repository version parser.
- Requires and validates `voidReason` with the invoice-domain void reason parser.
- Validates optional `voidedAt` as a UTC timestamp.
- Loads the existing invoice with `repository.getById`.
- Returns `404` when the invoice is missing.
- Returns `409 invoice_conflict` when the existing invoice is not finalized, including drafts and
  already voided invoices.
- Voids through `voidInvoice`, preserving the finalized snapshot and totals.
- Persists with `repository.saveVoided(voidedInvoice, { expectedVersion })`.
- Returns `200 OK` with serialized voided invoice data and the repository version.

## Error mapping

- Missing or unresolved authenticated owner: `401 unauthorized`.
- Malformed JSON, invalid path ID, invalid request shape, missing `expectedVersion`, invalid
  `expectedVersion`, missing/invalid `voidReason`, invalid `voidedAt`, or unsupported void fields:
  `400`.
- Domain void validation errors: `400` using the domain error code and message.
- Missing invoice: `404 invoice_not_found`.
- Existing draft/voided invoice, stale expected version, or invoice-number conflict surfaced by the
  repository: `409`.
- Repository unavailable: `503 repository_unavailable`.
- Repository invariant/internal record errors continue to use the existing repository error mapper.

## Scope boundaries

Voiding does not recalculate totals, does not zero totals, does not alter the finalized snapshot,
does not release or reuse invoice numbers, does not implement unvoid, does not delete finalized or
voided invoices, and does not add payment settlement, PDF, email, export, web integration, login
UI, hosted UI/domain, production deployment, custom domain, VPC/NAT, app S3 bucket, budget, secret,
or Task 023 behavior.

## Deployment boundary

No deployment was performed in Task 022. CDK diff review is the stopping point until explicit
deployment approval is given.

## Verification

Final verification results are recorded in the Task 022 completion response.

## Task 022C follow-up

Task 022B dev verification found that deployed voiding returned `409 invoice_conflict` after a
successful finalize and `GET /invoices/{id}` current-version read. Task 022C traced this to the
DynamoDB adapter's finalized snapshot comparison using order-sensitive JSON text for DynamoDB map
attributes. The fix keeps snapshot validation intact but canonicalizes serialized invoice maps with
stable key ordering before comparison. No deployment was performed in Task 022C; the next deployment
verification task should retry Task 022B against the fixed Lambda asset.

## Task 022D follow-up

Task 022B retry verification deployed the Task 022C Lambda asset, then found live void persistence
returned `503 repository_unavailable`. Task 022D traced this to the DynamoDB adapter's void write
using a two-item transaction even though the invoice-number reservation is only validated and not
modified during void. The source fix keeps the consistent reservation read/validation, preserves the
reservation item unchanged, and writes the voided invoice with a conditional invoice `PutCommand`
requiring the current expected version and finalized lifecycle state. No deployment was performed in
Task 022D; the next task should rerun Task 022B verification after this source fix is reviewed,
committed, and deployed.

## Proposed commit message

```text
feat(api): implement invoice void route
```
