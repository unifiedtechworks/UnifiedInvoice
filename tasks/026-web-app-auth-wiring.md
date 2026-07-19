# Task 026: Web App Auth Wiring

## Status

Implemented and verified locally. No deployment, live API mutation calls, direct DynamoDB
write/delete, commit, invoice dashboard workflow, backend route change, or Task 027 work was
performed.

## Objective

Wire the Vite React Native for Web app to the existing Cognito-backed API foundation and the
`@invoice/api-client` package. This task creates only the auth/client smoke-check foundation.

## Environment

The web app uses Vite environment variables:

```text
VITE_UNIFIED_INVOICE_API_BASE_URL="<api-base-url>"
VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_ID="<cognito-user-pool-id>"
VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_CLIENT_ID="<cognito-user-pool-client-id>"
VITE_UNIFIED_INVOICE_AWS_REGION="<aws-region>"
```

`apps/web/.env.local.example` contains placeholders only. Live URLs, full Cognito identifiers,
account IDs, passwords, tokens, and personal emails are intentionally not committed.

## Auth Approach

`apps/web/src/lib/auth.ts` implements a small browser-side Cognito `USER_PASSWORD_AUTH` client using
`fetch`. It is dependency-light and matches the current dev User Pool Client, which has no client
secret and no Hosted UI/domain.

The auth layer keeps the session tokens in memory only for this MVP foundation. It supports:

- sign-in with email/password for local dev;
- sign-out;
- current session reads;
- subscription to session changes;
- access-token retrieval for invoice API calls.

Passwords are not stored. Token values are not logged or displayed.

## API Client Wiring

`apps/web/src/lib/invoice-api.ts` creates `@invoice/api-client` with:

- env-based API base URL;
- the auth layer's `getAccessToken`;
- optional fake `fetch` injection for tests.

`health()` remains public and does not request a token. Invoice routes are authenticated and fail
safely when no session token is available.

## Minimal UI

`apps/web/src/App.tsx` now renders a dev/MVP API session panel that shows:

- env config presence;
- public health route status;
- signed-out state;
- email/password sign-in form;
- signed-in state without raw token values;
- sign-out button;
- authenticated invoice-list smoke-check result count.

The UI does not create, update, finalize, void, delete, export, email, or otherwise mutate invoice
records.

## Tests

Added fake-only web tests for:

- config reads required env variables;
- config reports missing env safely;
- invoice API wrapper calls public health without requesting a token;
- invoice API wrapper uses the auth token provider for list calls;
- authenticated list calls fail before fetch without a token;
- auth smoke panel renders signed-out state;
- signed-in state does not render raw token values.

Tests do not call live AWS, Cognito, API Gateway, or DynamoDB.

## Manual Verification

Manual dev sign-in verification remains optional. With local env values present, run the web app and
verify health, sign-in, authenticated invoice list count, and sign-out. Do not perform live mutation
calls from this task.

## Proposed commit message

```text
feat(web): wire Cognito auth and invoice API client
```
