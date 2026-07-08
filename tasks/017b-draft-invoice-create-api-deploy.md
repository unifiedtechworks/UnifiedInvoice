# Task 017B: Draft Invoice Create API Dev Deployment

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

- Confirmed unauthenticated `POST /invoices/drafts` returned `401 Unauthorized`.
- Created exactly one authenticated dev verification draft through `POST /invoices/drafts`.
- Confirmed the create response returned `201`, `invoice.kind=draft`, customer display name,
  notes, and a repository version.
- Confirmed authenticated `GET /invoices` included the created draft.
- Confirmed authenticated `GET /invoices/{id}` returned the created draft and version.
- Confirmed remaining authenticated mutation routes still returned `501 not_implemented`:
  - `PUT /invoices/drafts/{id}`
  - `POST /invoices/{id}/finalize`
  - `POST /invoices/{id}/void`
- Confirmed DynamoDB read-only count returned `1`, matching the one dev verification draft.

## Data and security notes

One dev verification draft was intentionally left in the dev invoice table. No direct DynamoDB
writes were run; the write happened only through the authenticated API. No additional Cognito users
were created. No passwords, tokens, full account IDs, full Cognito IDs, personal email addresses,
or live URLs are recorded in this repository.

## Scope boundaries

No new API behavior was implemented in this deployment task. Draft update, finalize, void, discard,
invoice-number sequencing, finalized invoice API behavior, web integration, hosted UI/domain,
production deployment, custom domains, VPC/NAT, app S3 buckets, budgets, PDF/email/export behavior,
and Task 018 remain deferred.

## Proposed commit message

```text
docs(api): record draft creation deployment
```
