# Task 017: Draft Invoice Create API

## Status

Implemented, deployed to dev in Task 017B, and committed before Task 018 began.

## Objective

Implement the first authenticated invoice write path:

```text
POST /invoices/drafts
```

The route creates a new draft invoice for the authenticated owner using the existing
`invoice-domain` draft creation API and the owner-scoped invoice repository.

## Request body

The route accepts a minimal JSON object. An empty body or `{}` creates an empty USD draft with a
generated invoice ID.

Supported optional shape:

```json
{
  "draft": {
    "id": "optional-client-generated-id",
    "customer": {
      "displayName": "Optional customer name"
    },
    "issueDate": "2026-02-01",
    "dueDate": "2026-02-15",
    "notes": "Optional notes"
  }
}
```

The route intentionally does not accept owner ID, line items, invoice numbers, finalized state, or
calculation inputs from the request body. If an `ownerId` field is present in the body, it is
ignored.

## Behavior implemented

- Requires an authenticated owner resolved from JWT claims.
- Parses JSON request bodies and returns `400 bad_request` for malformed JSON.
- Uses `createDraftInvoice` from `@invoice/invoice-domain`.
- Uses the default USD currency definition for newly created drafts.
- Applies optional customer display name, issue date, due date, and notes only through existing
  domain parsers.
- Persists the draft with `repository.createDraft`.
- Returns `201 Created` with serialized invoice data and the repository version.
- Generates invoice IDs with `crypto.randomUUID()` through the runtime `globalThis.crypto` API when
  the client does not provide a valid ID.

## Error mapping

- Missing or unresolved authenticated owner: `401 unauthorized`.
- Malformed JSON or invalid request shape: `400 bad_request`.
- Domain validation errors: `400` using the domain error code and message.
- Duplicate invoice ID from the repository: `409 invoice_already_exists`.
- Repository unavailable: `503 repository_unavailable`.
- Repository invariant/internal record errors continue to use the existing repository error mapper.

## Scope boundaries

No invoice-number generation, finalization, calculation, payment behavior, PDF/email/export
behavior, web integration, login UI, hosted UI/domain, production deployment, custom domain,
VPC/NAT, app S3 bucket, budget, secret, or Task 018 work is included.

The following routes remain authenticated `501 not_implemented` stubs:

- `PUT /invoices/drafts/{id}`
- `POST /invoices/{id}/finalize`
- `POST /invoices/{id}/void`
- `DELETE /invoices/drafts/{id}`

## Deployment boundary

No deployment was performed in Task 017. Task 017B later deployed and verified draft creation in
dev after CDK diff review.

## Task 018 follow-up

Task 018 implements authenticated `PUT /invoices/drafts/{id}` locally after Task 017B was
committed. Draft updates require `expectedVersion`, use the path invoice ID, ignore request-body
owner and ID fields, and keep invoice-number generation/finalization/calculation deferred.
Finalize, void, and draft delete routes remain protected `501 not_implemented` stubs. Task 018
does not deploy the new update behavior without later explicit deploy approval.

## Task 020 follow-up

Task 020 implements authenticated `POST /invoices/{id}/finalize` locally after draft delete was
deployed in Task 019B. Finalization requires `expectedVersion` and an explicit invoice number,
uses the path invoice ID and JWT-derived owner, ignores request-body owner/ID/totals fields,
finalizes through the existing invoice-domain calculation/finalization behavior, and persists
through `repository.saveFinalized`. The void route remains a protected `501 not_implemented` stub.

## Verification

Final verification results are recorded in the Task 017 completion response.

## Proposed commit message

```text
feat(api): implement draft invoice creation route
```
