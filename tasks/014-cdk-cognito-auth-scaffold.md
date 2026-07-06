# Task 014: CDK Cognito Auth Scaffold and HTTP API Authorizer

## Status

Implemented locally; not deployed and not committed.

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
