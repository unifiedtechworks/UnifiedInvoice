# Task 015: Authenticated Invoice API Route Scaffold and Handler Wiring

## Status

Implemented, deployed to dev in Task 015B, and committed before Task 016 began.

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
invoice-number sequencing, remaining mutation behavior, PDF/email/export behavior, VPC/NAT, app S3
buckets, custom domains, budgets, secrets, production deployment, and Task 016+ work remain
deferred.

## Deployment boundary

Task 015B deployed the authenticated invoice route scaffold after CDK diff review and explicit
approval. The deployed change was limited to authenticated invoice HTTP API routes, route
authorizer attachments, Lambda invoke permissions for invoice routes, and Lambda code/package asset
changes from the new API handler wiring. During deployment readiness, the API bundle was adjusted to
include runtime workspace and AWS SDK dependencies in the Lambda artifact so deployed Lambda startup
does not depend on package-local `node_modules`.

## Task 015B dev deployment

Task 015B deployed the authenticated invoice route scaffold to the existing dev stack.

- Region: `us-west-2`.
- AWS account recorded for review as `9064****2082`.
- Stack name: `unified-invoice-dev-api`.
- Stack outputs include `HealthApiUrl`, `HealthFunctionName`, `InvoicesTableName`, `UserPoolId`,
  and `UserPoolClientId`.
- The existing `GET /health` endpoint remained public and returned
  `{"ok":true,"service":"unified-invoice-api"}`.
- Unauthenticated requests to `GET /invoices`, `GET /invoices/{id}`, and
  `POST /invoices/drafts` returned `401 Unauthorized` from the API Gateway JWT authorizer.
- Mutation routes remain protected `501 Not Implemented` stubs for future authenticated testing.
- No Cognito users or passwords were created.
- No test invoice data was written to DynamoDB.
- No web integration, hosted UI/domain, VPC/NAT, app S3 bucket, custom domain, budget, secret,
  production resource, or Task 016 work was performed.

## Task 016 authenticated verification follow-up

Task 016 created one dev-only Cognito admin verification user using the deployed email-sign-in
User Pool shape. The Cognito username is the approved email address and `preferred_username` is
`dev-admin`; no password, token, full User Pool ID, full client ID, full account ID, or live URL is
recorded here.

Authenticated route verification confirmed:

- `GET /health` remains public and returned the expected health JSON.
- `GET /invoices` with a Cognito JWT returned `200` and an empty `items` list.
- `GET /invoices/{id}` for a valid missing invoice ID returned `404 invoice_not_found`.
- `POST /invoices/drafts`, `POST /invoices/{id}/finalize`, and `POST /invoices/{id}/void`
  returned `501 not_implemented`.
- The dev DynamoDB invoice table item count remained `0`; no invoice data was written.
- No deploy, web integration, hosted UI/domain, production resource, additional Cognito user, or
  Task 017 work was performed.

## Task 017 implementation follow-up

Task 017 replaced only the authenticated `POST /invoices/drafts` stub with real draft creation
behavior. The route creates owner-scoped draft invoices through the existing DynamoDB repository
adapter, uses JWT claims for repository scoping, ignores request-body owner fields, generates an
invoice ID when one is not supplied, and does not create invoice numbers, finalize, calculate,
write line items, or integrate the web app. Other mutation routes remain protected `501
not_implemented` stubs.

Task 018 replaced only the authenticated `PUT /invoices/drafts/{id}` stub with real draft update
behavior. The route uses the path invoice ID, requires `expectedVersion`, loads the existing
owner-scoped draft, applies supported customer/date/notes updates through invoice-domain functions,
and persists through `repository.updateDraft`. Finalize, void, and draft delete routes remain
protected `501 not_implemented` stubs.

## Verification

Run the focused API checks, focused CDK checks, repository-wide checks, generated-output cleanup,
read-only AWS identity check, CDK diff, final Git inspection, and post-deploy route checks listed
in the Task 015B request.

## Proposed commit message

```text
feat(api): add authenticated invoice route scaffold
```
