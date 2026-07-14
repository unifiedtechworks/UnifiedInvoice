# Task 020B: Invoice Finalize API Dev Verification

## Status

Dev finalization verification completed. No deployment or commit was performed by this task.

## Scope

Task 020B retried invoice finalization verification after Task 021B deployed finalizable draft
field support. CDK diff showed no stack differences, so no dev deployment was needed.

## Verification

- `GET /health` remained public and returned the expected service health payload.
- An existing dev Cognito user was used for authenticated API verification.
- Authenticated `POST /invoices/drafts` created a finalizable draft with business, customer,
  issue date, due date, notes, and one line item.
- Authenticated `POST /invoices/{id}/finalize` finalized that draft with a unique dev invoice
  number.
- Authenticated `GET /invoices/{id}` returned the finalized invoice.
- Authenticated `GET /invoices` included the finalized invoice.
- Authenticated `GET /invoices?kind=finalized` included the finalized invoice.
- A second finalizable draft was created through the API, and finalizing it with the same invoice
  number returned `409`.
- Authenticated `POST /invoices/{id}/void` remained a `501 not_implemented` stub.
- DynamoDB read-only count after verification was `7`.

## Count Interpretation

The count reflects existing dev verification drafts from Task 021B, finalized invoice records,
invoice-number reservation records, and the duplicate-test draft that was intentionally left in dev.
No finalized invoice records or invoice-number reservation records were deleted.

## Safety Notes

No direct DynamoDB writes or deletes were performed. Data mutations happened only through the
authenticated application API. No Cognito users were created. No passwords, tokens, full account
IDs, full Cognito IDs, live URLs, personal email addresses, exact live invoice IDs, or exact live
invoice numbers are recorded here.

## Proposed commit message

```text
docs(api): record invoice finalization deployment
```
