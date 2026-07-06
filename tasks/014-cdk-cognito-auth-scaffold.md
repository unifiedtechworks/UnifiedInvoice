# Task 014: CDK Cognito Auth Scaffold and HTTP API Authorizer

## Status

Implemented and deployed to dev in Task 014B; not committed.

## Objective

Add Cognito authentication infrastructure and HTTP API JWT authorizer wiring to the CDK dev stack
so future invoice API routes can require authenticated callers.

## Scope implemented

- Added an environment-scoped Cognito User Pool named `unified-invoice-<environment>-users`.
- Disabled public self-registration so users must be created through an explicit administrative
  process.
- Enabled email sign-in.
- Configured a strong dev password policy with a 12-character minimum plus uppercase, lowercase,
  number, and symbol requirements.
- Configured account recovery by verified email.
- Kept MFA off for dev. Production should revisit MFA before real users are onboarded.
- Kept dev removal policy as destroy-on-stack-removal. Production should revisit retention and
  recovery posture before real users are onboarded.
- Added an environment-scoped User Pool Client named `unified-invoice-<environment>-web-client`.
- Configured the client without a secret for future browser/mobile usage.
- Added an HTTP API JWT authorizer named `unified-invoice-<environment>-jwt-authorizer`.
- Left the authorizer unattached until invoice API routes are added.
- Added non-secret `COGNITO_USER_POOL_ID` and `COGNITO_USER_POOL_CLIENT_ID` Lambda environment
  variables for future handler composition.
- Added `UserPoolId` and `UserPoolClientId` stack outputs.

## Intentionally deferred

Invoice API handlers, invoice API routes, web auth integration, user registration UI, real users,
passwords, hosted UI domains, callback/logout URLs, custom domains, migrations, invoice-number
sequencing, PDF/email/export behavior, VPC/NAT, app S3 buckets, budgets, secrets, production
deployment, and later-task work remain deferred. `/health` remains public.

## Verification

Run the focused CDK checks, API checks, repository-wide checks, generated-output cleanup, read-only
AWS identity check, CDK diff, and final Git inspection listed in the Task 014 request. Deployment is
not automatic and must wait for explicit approval after diff review.

## Task 014B dev deployment

Task 014B deployed the Cognito auth scaffold to the existing dev stack.

- Region: `us-west-2`.
- AWS account recorded for review as `9064****2082`.
- Stack name: `unified-invoice-dev-api`.
- Stack outputs include `UserPoolId` and `UserPoolClientId` in addition to the existing health and
  invoice table outputs.
- Cognito User Pool verification confirmed the pool exists, public self-registration is disabled,
  MFA is `OFF` for dev, email sign-in/recovery settings are present, and the estimated user count
  is `0`.
- User Pool Client verification confirmed the client exists and no client secret was returned.
- Lambda configuration verification confirmed `COGNITO_USER_POOL_ID` and
  `COGNITO_USER_POOL_CLIENT_ID` are present alongside `APP_ENV=dev` and
  `INVOICES_TABLE_NAME=unified-invoice-dev-invoices`.
- The `HealthApiUrl` endpoint remained public and returned
  `{"ok":true,"service":"unified-invoice-api"}`.
- No invoice API routes, users, passwords, secrets, hosted UI domain, VPC/NAT, app S3 bucket,
  custom domain, budget, production resource, or Task 015 work was deployed.
