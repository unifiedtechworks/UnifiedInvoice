# Unified Invoice API

`@invoice/api` is the serverless backend application scaffold. It currently exports only a
testable `GET /health` Lambda handler returning:

```json
{ "ok": true, "service": "unified-invoice-api" }
```

## Local commands

Run from the repository root:

```powershell
pnpm api:test
pnpm api:build
pnpm --filter @invoice/api typecheck
pnpm --filter @invoice/api lint
```

The build produces `apps/api/dist/index.mjs`, which `infra/sam/template.yaml` packages. With AWS
SAM CLI and Docker installed, build the package first and then run:

```powershell
sam local start-api --template-file infra/sam/template.yaml
```

Invoice routes, persistence, DynamoDB, Cognito, authorization, and deployment automation are
intentionally deferred. The health route is unauthenticated and exposes no invoice data. This
scaffold is not production-ready until the persistence and authentication tasks are complete.
