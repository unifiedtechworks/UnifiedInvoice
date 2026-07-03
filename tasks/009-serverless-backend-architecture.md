# Task 009: Serverless Backend Architecture and Cost Guardrail Plan

## Status

Planning complete; ready for review after verification.

## Objective and baseline

Plan a low-cost serverless backend without implementing backend code, adding dependencies,
deploying resources, changing lockfiles, committing, or starting Task 010.

Work began from clean, synchronized `main` at `f5ffa3d Task 008F`. Recent history contains the
required Task 008 draft, finalized/voided, and list-query behavior commits.

## Repository findings

- The TypeScript pnpm monorepo uses `apps/*` and `packages/*` workspaces.
- Domain, engine, and invoice-domain packages own framework-independent deterministic behavior and
  canonical serialization.
- `packages/invoice-repository` owns storage-neutral async ports, opaque versions, errors, records,
  and list queries.
- `packages/invoice-repository-memory` proves the repository lifecycle, concurrency, uniqueness,
  validation, and query boundaries for non-durable use.
- API client, validation, UI, web, and mobile remain foundation-level.
- No AWS, durable persistence, authentication, or invoice-number generation exists.

## Plan delivered

ADR 0009 selects AWS SAM, `infra/`, `apps/api`, a separate DynamoDB repository adapter, API Gateway
HTTP API, Lambda, DynamoDB on-demand, and Cognito JWT authorization. It specifies server-side
lifecycle operations, owner-partitioned persistence, atomic invoice-number reservations, opaque
conditional versions, one initial updated-time GSI, the $0-$5 monthly target, $10/$20 alerts, cost
guardrails, and security basics.

## Proposed next tasks

- **010:** SAM and backend application scaffold.
- **011:** Owner-scoped DynamoDB invoice repository adapter.
- **012:** Cognito and authorization boundary.
- **013:** Authenticated invoice HTTP handlers and server-side lifecycle operations.
- **014:** Typed API client, Cognito sessions, and web integration.

Task 009 starts none of these tasks.

## Files and non-goals

This task adds only:

- `docs/decisions/0009-serverless-backend-architecture.md`
- `tasks/009-serverless-backend-architecture.md`

`docs/architecture.md` remains an accurate description of implemented surfaces, so no
forward-looking edit is required. No source, dependency, infrastructure template, lockfile,
deployment, generated output, commit, or Task 010 work is included.

## Verification

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm web:build
git diff --check
git status --short
git diff --stat
git diff --name-only
git diff -- pnpm-lock.yaml
```

Actual results are recorded in the completion response.
