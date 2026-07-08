# Task 019: Draft Invoice Delete API

## Status

Implemented locally; ready for review after verification. No deployment or commit was performed by
this task.

## Objective

Implement the authenticated draft discard path:

```text
DELETE /invoices/drafts/{id}
```

The route discards an existing draft invoice for the authenticated owner using the existing
owner-scoped invoice repository adapter.

## Request body

Supported minimal JSON shape:

```json
{
  "expectedVersion": "v..."
}
```

`expectedVersion` is required and validated with the repository version parser. The path `{id}` is
the invoice ID. Request-body `id` and owner fields are ignored when present and cannot override the
path ID or JWT-derived owner.

## Behavior implemented

- Requires an authenticated owner resolved from JWT claims.
- Parses and validates the path invoice ID.
- Parses JSON request bodies and returns `400 bad_request` for malformed JSON or unsupported delete
  fields.
- Requires and validates `expectedVersion`.
- Calls `repository.discardDraft(id, { expectedVersion })`.
- Returns `200 OK` with the discarded invoice ID.

## Error mapping

- Missing or unresolved authenticated owner: `401 unauthorized`.
- Malformed JSON, invalid path ID, invalid request shape, missing `expectedVersion`, invalid
  `expectedVersion`, or unsupported delete fields: `400`.
- Missing invoice: `404 invoice_not_found`.
- Existing finalized/voided invoice or stale expected version: `409`.
- Repository unavailable: `503 repository_unavailable`.
- Repository invariant violation: `500 repository_invariant_violation`.

## Scope boundaries

Draft discard does not delete finalized or voided invoices, does not delete invoice-number
reservations, and does not implement hard deletes for finalized or voided invoice records.

No invoice-number generation, finalization, voiding, finalized invoice API behavior, payment
behavior, PDF/email/export behavior, web integration, login UI, hosted UI/domain, production
deployment, custom domain, VPC/NAT, app S3 bucket, budget, secret, or Task 020 work is included.

The following routes remain authenticated `501 not_implemented` stubs:

- `POST /invoices/{id}/finalize`
- `POST /invoices/{id}/void`

## Deployment boundary

No deployment was performed in Task 019. The next task should deploy and verify draft deletion in
dev after CDK diff review, or implement finalization if deployment is deferred.

## Verification

Final verification results are recorded in the Task 019 completion response.

## Proposed commit message

```text
feat(api): implement draft invoice delete route
```
