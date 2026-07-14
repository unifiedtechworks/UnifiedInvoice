# Task 020: Invoice Finalize API

## Status

Implemented and committed in Task 020. Dev finalization verification was retried and completed in
Task 020B after Task 021B deployed finalizable draft fields.

## Objective

Implement the authenticated finalize path:

```text
POST /invoices/{id}/finalize
```

The route finalizes an existing draft invoice for the authenticated owner using the existing
invoice-domain finalization behavior and the owner-scoped invoice repository.

## Request body

Supported minimal JSON shape:

```json
{
  "expectedVersion": "v...",
  "invoiceNumber": "INV-1001",
  "finalizedAt": "2026-07-09T00:00:00.000Z"
}
```

`expectedVersion` and `invoiceNumber` are required. `finalizedAt` is optional; when omitted, the
handler clock supplies the finalization timestamp. The path `{id}` is the invoice ID.
Request-body `id`, owner fields, and totals are ignored when present and cannot override the path
ID, JWT-derived owner, or domain-calculated totals.

## Behavior implemented

- Requires an authenticated owner resolved from JWT claims.
- Parses and validates the path invoice ID.
- Parses JSON request bodies and returns `400 bad_request` for malformed JSON or unsupported
  finalize fields.
- Requires and validates `expectedVersion` with the repository version parser.
- Requires and validates `invoiceNumber` with the domain invoice-number parser.
- Validates optional `finalizedAt` as a UTC timestamp.
- Loads the existing invoice with `repository.getById`.
- Returns `404` when the invoice is missing.
- Returns `409 invoice_conflict` when the existing invoice is not a draft.
- Finalizes through `finalizeInvoice`, including domain-required parties, dates, lines,
  calculation, and immutable finalized snapshot creation.
- Persists with `repository.saveFinalized(finalizedInvoice, { expectedVersion })`.
- Returns `200 OK` with serialized finalized invoice data and the repository version.

## Error mapping

- Missing or unresolved authenticated owner: `401 unauthorized`.
- Malformed JSON, invalid path ID, invalid request shape, missing `expectedVersion`, invalid
  `expectedVersion`, missing/invalid `invoiceNumber`, invalid `finalizedAt`, or unsupported
  finalize fields: `400`.
- Domain finalization validation errors: `400` using the domain error code and message.
- Missing invoice: `404 invoice_not_found`.
- Existing non-draft invoice, stale expected version, or duplicate invoice number: `409`.
- Repository unavailable: `503 repository_unavailable`.
- Repository invariant/internal record errors continue to use the existing repository error mapper.

## Scope boundaries

Finalization does not generate invoice numbers, does not accept client-provided totals, does not
add line-item editing, does not implement voiding, and does not add payment, PDF, email, export,
web integration, login UI, hosted UI/domain, production deployment, custom domain, VPC/NAT, app S3
bucket, budget, secret, or Task 021 behavior.

The following route remains an authenticated `501 not_implemented` stub:

- `POST /invoices/{id}/void`

## Deployment boundary

No deployment was performed in Task 020. CDK diff review is the stopping point until explicit
deployment approval is given.

## Task 021 follow-up

Task 021 adds minimal business display name and draft line-item support to authenticated draft
create/update routes so clients can prepare drafts that satisfy finalization preconditions through
the API. The finalize route contract remains unchanged: it still requires `expectedVersion` and an
explicit invoice number, computes totals through invoice-domain/invoice-engine behavior, and does
not accept client-provided totals or payments.

## Verification

Task 020 local verification results are recorded in the Task 020 completion response.

Task 020B verified the deployed dev finalization path after Task 021B made API-created drafts
finalizable. Verification confirmed public health remained available, authenticated draft creation
could prepare a finalizable draft, authenticated finalization returned a finalized invoice,
get-by-id returned the finalized invoice, list endpoints included the finalized invoice, duplicate
invoice-number finalization returned `409`, and the void route remained `501`.

## Proposed commit message

```text
feat(api): implement invoice finalize route
```
