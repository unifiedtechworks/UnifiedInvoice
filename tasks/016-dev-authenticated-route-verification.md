# Task 016: Dev Authenticated Route Verification

## Status

Completed locally against the deployed dev stack and committed before Task 017 began.

## Objective

Create one dev-only Cognito admin verification user, obtain a JWT without persisting it, and verify
the deployed authenticated invoice route scaffold from Task 015 using the existing dev stack.

## Dev identity used

- Environment: `dev`.
- Region: `us-west-2`.
- AWS account recorded for review as `9064****2082`.
- Stack name: `unified-invoice-dev-api`.
- Cognito User Pool sign-in shape: email username.
- Verification user: the approved dev email address with `preferred_username=dev-admin`.

No password, JWT, full User Pool ID, full client ID, full account ID, or live endpoint URL is
recorded in this repository.

## Verification completed

- Created exactly one dev Cognito verification user.
- Set the approved replacement dev password as permanent for verification.
- Obtained a Cognito token using `USER_PASSWORD_AUTH` and kept it only in the current shell
  environment while running route checks.
- Confirmed `GET /health` remains public and returned:

```json
{ "ok": true, "service": "unified-invoice-api" }
```

- Confirmed authenticated `GET /invoices` returned `200` with:

```json
{ "items": [] }
```

- Confirmed authenticated `GET /invoices/{id}` for a valid missing invoice ID returned `404` with
  `invoice_not_found`.
- Confirmed authenticated mutation stubs returned `501 not_implemented` for:
  - `POST /invoices/drafts`
  - `POST /invoices/{id}/finalize`
  - `POST /invoices/{id}/void`
- Confirmed the dev DynamoDB invoice table item count remained `0`; no invoice data was written.

## Scope boundaries

No deployment was performed in Task 016. No additional Cognito users, passwords, hosted UI/domain,
web app integration, invoice mutation behavior, test invoice data, VPC/NAT, app S3 bucket, custom
domain, budget, secret, production resource, or Task 017 work was added.

## Task 017 follow-up

Task 017 implements `POST /invoices/drafts` locally after this verification task was committed.
The Task 016 deployed verification results remain a snapshot of the previously deployed behavior:
at that time `POST /invoices/drafts` returned `501 not_implemented`. Task 017 does not deploy the
new create behavior without a later explicit deploy approval.

## Verification commands

Final local verification should include the focused API checks, focused CDK checks, repository-wide
checks, generated-output cleanup, final Git inspection, and secret scan reported in the Task 016
completion response.

## Proposed commit message

```text
docs(api): record authenticated route verification
```
