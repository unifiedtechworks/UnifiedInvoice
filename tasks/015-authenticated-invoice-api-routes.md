# Task 015: Authenticated Invoice API Route Scaffold and Handler Wiring

## Status

Implemented locally; deployment is intentionally deferred until CDK diff review and explicit
approval.

## Objective

Add the first authenticated invoice API route scaffold, wire read-only invoice handlers to the
existing owner-scoped DynamoDB repository adapter, and keep mutation behavior deferred behind
protected `501 Not Implemented` stubs.

## Scope implemented

- Kept `GET /health` public and unauthenticated.
- Added JWT-protected invoice routes:
  - `GET /invoices`
  - `GET /invoices/{id}`
  - `POST /invoices/drafts`
  - `PUT /invoices/drafts/{id}`
  - `POST /invoices/{id}/finalize`
  - `POST /invoices/{id}/void`
  - `DELETE /invoices/drafts/{id}`
- Implemented `GET /invoices` using supported query parameters:
  `kind`, `search`, `sortBy`, `sortDirection`, `pageSize`, and `cursor`.
- Implemented `GET /invoices/{id}` using domain invoice ID parsing and the repository `getById`
  contract.
- Serialized invoice aggregate responses through the existing invoice-domain serializer so API
  responses remain JSON-safe.
- Added mutation route stubs that require an authenticated owner and return stable
  `not_implemented` JSON errors.
- Added an owner resolver that uses JWT `sub` first and falls back to `username` only when `sub` is
  absent.
- Added API-side DynamoDB repository composition with `DynamoDBDocumentClient`,
  `INVOICES_TABLE_NAME`, and the resolved owner ID.
- Updated CDK to route all invoice paths through the existing Lambda and attach the Cognito JWT
  authorizer to invoice routes only.

## Intentionally deferred

Web app integration, login UI, hosted UI/domain, Cognito users/passwords, login-flow testing,
invoice-number sequencing, mutation behavior, PDF/email/export behavior, VPC/NAT, app S3 buckets,
custom domains, budgets, secrets, production deployment, and Task 016+ work remain deferred.

## Deployment boundary

No deployment is performed by this task unless the CDK diff is reviewed and explicitly approved.
The expected diff is limited to authenticated invoice HTTP API routes, route authorizer
attachments, and Lambda code/package asset changes from the new API handler wiring.

## Verification

Run the focused API checks, focused CDK checks, repository-wide checks, generated-output cleanup,
read-only AWS identity check, CDK diff, and final Git inspection listed in the Task 015 request.
Stop after the CDK diff and wait for deployment approval.

## Proposed commit message

```text
feat(api): add authenticated invoice route scaffold
```
