# Task 018: Draft Invoice Update API

## Status

Implemented locally; ready for review after verification. No deployment or commit was performed by
this task.

## Objective

Implement the authenticated draft update path:

```text
PUT /invoices/drafts/{id}
```

The route updates an existing draft invoice for the authenticated owner using existing
`invoice-domain` edit functions and the owner-scoped invoice repository.

## Request body

Supported minimal JSON shape:

```json
{
  "expectedVersion": "v...",
  "draft": {
    "customer": {
      "displayName": "Optional customer name"
    },
    "issueDate": "2026-03-01",
    "dueDate": "2026-03-15",
    "notes": "Optional notes"
  }
}
```

`expectedVersion` is required and validated with the repository version parser. The path `{id}` is
the invoice ID. Request-body `id` and owner fields are ignored when present and cannot override the
path ID or JWT-derived owner.

## Behavior implemented

- Requires an authenticated owner resolved from JWT claims.
- Parses and validates the path invoice ID.
- Parses JSON request bodies and returns `400 bad_request` for malformed JSON or unsupported draft
  fields.
- Requires and validates `expectedVersion`.
- Loads the existing invoice with `repository.getById`.
- Returns `404` when the invoice is missing.
- Returns `409 invoice_conflict` when the existing invoice is not a draft.
- Applies supported draft updates through existing invoice-domain functions:
  - customer display name with `setDraftInvoiceParties`
  - issue/due dates with `setDraftInvoiceDates`
  - notes with `setDraftInvoiceText`
- Persists with `repository.updateDraft(updatedDraft, { expectedVersion })`.
- Returns `200 OK` with serialized invoice data and the repository version.

## Error mapping

- Missing or unresolved authenticated owner: `401 unauthorized`.
- Malformed JSON, invalid path ID, invalid request shape, missing `expectedVersion`, invalid
  `expectedVersion`, or unsupported draft fields: `400`.
- Domain validation errors: `400` using the domain error code and message.
- Missing invoice: `404 invoice_not_found`.
- Existing finalized/voided invoice or stale expected version: `409`.
- Repository unavailable: `503 repository_unavailable`.

## Scope boundaries

No invoice-number generation, finalization, calculation, line-item editing, payment behavior,
PDF/email/export behavior, web integration, login UI, hosted UI/domain, production deployment,
custom domain, VPC/NAT, app S3 bucket, budget, secret, or Task 019 work is included.

The following routes remain authenticated `501 not_implemented` stubs:

- `POST /invoices/{id}/finalize`
- `POST /invoices/{id}/void`
- `DELETE /invoices/drafts/{id}`

## Deployment boundary

No deployment was performed in Task 018. The next task should either deploy and verify draft update
in dev after CDK diff review, or implement draft deletion behavior if deployment is deferred.

## Verification

Final verification results are recorded in the Task 018 completion response.

## Proposed commit message

```text
feat(api): implement draft invoice update route
```
