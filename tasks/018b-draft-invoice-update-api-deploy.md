# Task 018B: Draft Invoice Update API Dev Deployment

## Status

Deployed and verified in dev; ready for review after final checks. No commit was created by this
task.

## Deployment summary

- Environment: `dev`.
- Region: `us-west-2`.
- AWS account recorded for review as `9064****2082`.
- Stack name: `unified-invoice-dev-api`.
- Deploy command: `pnpm --filter @invoice/infra-cdk exec cdk deploy -c environment=dev`.
- CDK bootstrap already existed and was not rerun.
- Reviewed CDK diff showed only the Lambda code asset changed.
- No DynamoDB table replacement, Cognito replacement, new routes, VPC/NAT, app S3 bucket, custom
  domain, budget, secret, or production resource was deployed.

## Verification completed

- Obtained a token for the existing Task 016 dev user with `USER_PASSWORD_AUTH`, kept only in the
  current shell environment.
- Confirmed `GET /health` remains public and returned:

```json
{ "ok": true, "service": "unified-invoice-api" }
```

- Confirmed unauthenticated `PUT /invoices/drafts/{id}` returned `401 Unauthorized`.
- Used authenticated `GET /invoices` to find the existing dev verification draft from Task 017B.
- Used authenticated `GET /invoices/{id}` to capture the current draft version before update.
- Updated that draft through authenticated `PUT /invoices/drafts/{id}` with `expectedVersion`.
- Confirmed the update response returned `200`, `invoice.kind=draft`, updated customer display
  name, updated notes, and a changed repository version.
- Confirmed authenticated `GET /invoices/{id}` returned the updated draft and updated version.
- Confirmed reusing a stale expected version returned `409 Conflict`.
- Confirmed remaining authenticated mutation routes still returned `501 not_implemented`:
  - `POST /invoices/{id}/finalize`
  - `POST /invoices/{id}/void`
- Confirmed DynamoDB read-only count returned `1`, matching the existing dev verification draft.

## Data and security notes

The existing dev verification draft was updated and intentionally left in the dev invoice table. No
additional draft was created. No direct DynamoDB writes were run; the update happened only through
the authenticated API. No additional Cognito users were created. No passwords, tokens, full account
IDs, full Cognito IDs, personal email addresses, or live URLs are recorded in this repository.

## Scope boundaries

No new API behavior was implemented in this deployment task. Finalize, void, draft discard,
invoice-number sequencing, finalized invoice API behavior, web integration, hosted UI/domain,
production deployment, custom domains, VPC/NAT, app S3 buckets, budgets, PDF/email/export behavior,
and Task 019 remain deferred.

## Proposed commit message

```text
docs(api): record draft update deployment
```
