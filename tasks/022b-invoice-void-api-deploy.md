# Task 022B: Invoice Void API Dev Deployment

## Status

Dev deployment and verification completed after the Task 022C snapshot comparison fix and Task 022D
DynamoDB void persistence fix. No commit was performed by this task.

## Deployment

The dev stack was deployed with a Lambda-code-only asset change. No production deployment,
bootstrap, DynamoDB table replacement, Cognito replacement, new routes, VPC/NAT, S3 app bucket,
custom domain, budget, secret, or real account ID change was performed.

## Verification

The final retry verified the deployed dev API end to end:

- `GET /health` remained public and returned `200`.
- An authenticated finalizable draft was created with business, customer, dates, and one line item.
- The draft finalized successfully with a unique dev invoice number.
- `GET /invoices/{id}` immediately after finalization returned the finalized invoice and current
  version.
- `POST /invoices/{id}/void` using that current version returned `200`.
- `GET /invoices/{id}` returned `kind=voided`.
- `GET /invoices` included the voided invoice.
- `GET /invoices?kind=voided` included the voided invoice.
- Voiding a draft returned `409`.
- Voiding the already-voided invoice returned `409`, matching the API-level documented conflict
  behavior for non-finalized invoices.
- Attempting to finalize another draft with the voided invoice's number returned `409`, confirming
  the invoice number remained reserved after void.

## DynamoDB Count

The read-only DynamoDB count after verification was `20` items. This reflects existing dev data
from prior verification attempts plus this final retry's expected records. The final retry left the
voided dev invoice, its invoice-number reservation, and the draft records created for conflict and
reservation checks in dev. No direct DynamoDB writes or deletes were run.

## Security Notes

The token was acquired in memory using the existing dev user and was not printed or written to disk.
No passwords, tokens, full account IDs, full Cognito IDs, live URLs, personal email addresses, exact
live invoice IDs, or exact live invoice numbers are recorded in this document.

## Proposed commit message

```text
docs(api): record invoice void deployment
```
