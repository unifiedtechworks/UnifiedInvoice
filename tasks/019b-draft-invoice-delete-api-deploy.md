# Task 019B: Draft Invoice Delete API Dev Deployment

## Status

Deployed and verified in dev; ready for review after final checks. No commit was created by this
task.

## Deployment summary

- Environment: `dev`.
- Region: `us-west-2`.
- AWS account recorded for review as `9064****2082`.
- Stack name: `unified-invoice-dev-api`.
- Deploy command: `pnpm --filter @invoice/infra-cdk exec cdk deploy -c environment=dev`.
- Reviewed CDK diff showed only the Lambda code asset changed.
- No DynamoDB table replacement, Cognito replacement, new routes, VPC/NAT, app S3 bucket, custom
  domain, budget, secret, or production resource was deployed.

## Verification completed

- Used the existing dev Cognito verification user; no additional Cognito user was created.
- Reset the existing dev user password using the approved temporary verification password, kept out
  of files and documentation.
- Obtained a token with `USER_PASSWORD_AUTH`, kept only in the verification process environment.
- Confirmed `GET /health` remains public and returned the expected health response.
- Confirmed unauthenticated `DELETE /invoices/drafts/{id}` returned `401 Unauthorized`.
- Used authenticated `GET /invoices` to find an existing dev draft; no new draft was created.
- Used authenticated `GET /invoices/{id}` to capture the current draft version before deletion.
- Discarded the draft through authenticated `DELETE /invoices/drafts/{id}` with
  `expectedVersion`.
- Confirmed the delete response returned `200` with the deleted draft ID.
- Confirmed authenticated `GET /invoices/{id}` returned `404 Not Found` after deletion.
- Confirmed authenticated `GET /invoices` no longer included the deleted draft.
- Confirmed remaining authenticated mutation routes still returned `501 not_implemented`:
  - `POST /invoices/{id}/finalize`
  - `POST /invoices/{id}/void`
- Confirmed DynamoDB read-only count returned `0` after deletion.

## Data and security notes

The existing dev verification draft was discarded through the authenticated API. No direct
DynamoDB writes or deletes were run. No additional Cognito users were created. No passwords,
tokens, full account IDs, full Cognito IDs, personal email addresses, or live URLs are recorded in
this repository.

## Scope boundaries

No new API behavior was implemented in this deployment task. Finalize, void, invoice-number
sequencing, finalized invoice API behavior, web integration, hosted UI/domain, production
deployment, custom domains, VPC/NAT, app S3 buckets, budgets, PDF/email/export behavior, and
Task 020 remain deferred.

## Proposed commit message

```text
docs(api): record draft delete deployment
```
