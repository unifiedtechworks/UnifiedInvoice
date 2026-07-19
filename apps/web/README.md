# UnifiedInvoice Web App

`@invoice/web` is the Vite React Native for Web app. Task 026 wires a small dev/MVP auth and API
smoke-check foundation; it does not implement the invoice dashboard or invoice workflows yet.

## Local Environment

Create `apps/web/.env.local` from `apps/web/.env.local.example` and fill in the dev stack values
locally:

```text
VITE_UNIFIED_INVOICE_API_BASE_URL="<api-base-url>"
VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_ID="<cognito-user-pool-id>"
VITE_UNIFIED_INVOICE_COGNITO_USER_POOL_CLIENT_ID="<cognito-user-pool-client-id>"
VITE_UNIFIED_INVOICE_AWS_REGION="<aws-region>"
```

Do not commit live URLs, Cognito identifiers, passwords, tokens, personal emails, or account IDs.

## Auth and API Wiring

The web app reads env configuration from `src/lib/config.ts`. `src/lib/auth.ts` uses the Cognito
public `USER_PASSWORD_AUTH` flow through browser `fetch` and keeps the returned session tokens in
memory only for this MVP foundation. Passwords are not stored, and token values are not displayed.

`src/lib/invoice-api.ts` creates the `@invoice/api-client` instance with the env API base URL and
the auth layer's access-token provider. `client.health()` remains public and does not request a
token. Invoice routes are authenticated and require a current session token.

## Local Commands

```powershell
pnpm --filter @invoice/web dev
pnpm --filter @invoice/web test
pnpm --filter @invoice/web typecheck
pnpm --filter @invoice/web lint
pnpm --filter @invoice/web build
```

## Manual Dev Verification

With local env values present, start the app and verify:

- configuration reports present;
- public health check succeeds;
- sign-in works with an existing dev user;
- authenticated invoice list smoke check returns a count without creating or changing records;
- sign-out returns to the signed-out state.

Next task work should build the invoice dashboard integration on top of this foundation.
