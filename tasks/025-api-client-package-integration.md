# Task 025: API Client Package Integration

## Status

Implemented and verified locally. No deployment, live API mutation, direct DynamoDB write/delete,
commit, web UI wiring, login UI, or Task 026 work was performed.

## Objective

Add a typed frontend-facing API client package for the existing UnifiedInvoice HTTP API routes so
future web work can depend on a testable transport boundary instead of calling raw route paths
directly.

## Package

Implemented `@invoice/api-client` in `packages/api-client`.

The package exposes:

- `createInvoiceApiClient`;
- typed client options and request/response DTOs;
- `InvoiceApiError` for non-2xx API responses;
- `InvoiceApiAuthError` for missing invoice-route tokens.

## Route Coverage

The client covers the current route matrix:

- public `GET /health`;
- authenticated `GET /invoices`;
- authenticated `GET /invoices/{id}`;
- authenticated `POST /invoices/drafts`;
- authenticated `PUT /invoices/drafts/{id}`;
- authenticated `DELETE /invoices/drafts/{id}`;
- authenticated `POST /invoices/{id}/finalize`;
- authenticated `POST /invoices/{id}/void`.

Draft create and update expose cleaner client methods while still sending the current backend
transport envelopes: `{ draft: ... }` and `{ expectedVersion, draft: ... }`.

## Auth Behavior

The caller injects `getAccessToken`. The client does not own Cognito, login UI, Hosted UI, refresh
logic, or token persistence.

`health()` does not request or attach a token. Invoice routes require a non-empty token and attach
`Authorization: Bearer <token>`. Missing tokens fail before `fetch` is called. Tokens are not logged
or included in thrown error messages.

## Error Behavior

Non-2xx responses throw `InvoiceApiError` with status, optional API error code, message, and safe
response body data. The client handles malformed or non-JSON error responses without surfacing JSON
parse failures.

## Tests

Added fake-fetch tests for:

- base URL trailing slash normalization;
- public health auth behavior;
- authenticated route auth headers;
- missing-token failure before fetch;
- list query parameters;
- create/update/delete/finalize/void request bodies;
- successful JSON parsing;
- typed 400, 401, 404, 409, and 503 API errors;
- non-JSON error responses;
- token exclusion from thrown error messages.

Tests do not call live API, AWS, Cognito, or DynamoDB.

## Documentation

Added `packages/api-client/README.md` and updated architecture notes to describe how the client fits
between the web app and API.

## Proposed commit message

```text
feat(api-client): add typed invoice API client
```
