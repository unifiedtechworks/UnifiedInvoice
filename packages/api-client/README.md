# Invoice API Client

`@invoice/api-client` is the typed frontend-facing boundary for the current UnifiedInvoice HTTP API.
It is intended for the web app to use after auth wiring is added, without coupling UI components to
raw route paths, transport envelopes, or API error parsing.

The package does not call live AWS in tests. Tests inject a fake `fetch` implementation.

## Usage

```ts
import { createInvoiceApiClient } from '@invoice/api-client';

const client = createInvoiceApiClient({
  baseUrl: '<api-base-url>',
  getAccessToken: async () => authSession.accessToken,
});
```

The caller owns authentication. The client asks `getAccessToken` only for authenticated invoice
routes and sends `Authorization: Bearer <token>` when a token is available. `health()` is public and
does not attach authorization.

## Covered Routes

- `GET /health`
- `GET /invoices`
- `GET /invoices/{id}`
- `POST /invoices/drafts`
- `PUT /invoices/drafts/{id}`
- `DELETE /invoices/drafts/{id}`
- `POST /invoices/{id}/finalize`
- `POST /invoices/{id}/void`

Draft create/update methods expose cleaner inputs while still sending the backend transport shapes
expected today: `{ draft: ... }` for create and `{ expectedVersion, draft: ... }` for update.

## Errors

Non-2xx responses throw `InvoiceApiError` with `status`, optional API `code`, message, and safe
response body data. Non-JSON error bodies are handled without throwing parser errors. Missing tokens
for invoice routes throw `InvoiceApiAuthError` before any fetch call.

Next task work should wire web auth and client usage. Backend routes and behavior remain unchanged.
