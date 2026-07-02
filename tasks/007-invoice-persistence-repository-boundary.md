# Task 007: Invoice Persistence Repository Boundary

## Status

Implemented locally; ready for review after verification.

## Objective

Add a small storage-neutral repository ports package for invoice aggregate persistence boundaries without implementing any concrete persistence drivers.

## Scope implemented

- Created `packages/invoice-repository` as `@invoice/invoice-repository`.
- Added repository-local result/error types and helpers.
- Added opaque `InvoiceRecordVersion` token parser, guard, and assert API.
- Added lifecycle-aware invoice repository interface contracts.
- Added explicit operation option/result types.
- Added storage-neutral `StoredInvoiceRecord` contract using canonical `SerializedInvoice` payloads.
- Added list/query/list-item contracts.
- Added runtime tests for version tokens and result helpers.
- Added compile-time assignability tests for repository API boundaries.
- Added ADR 0007.
- Updated architecture docs and root workspace TypeScript/build configuration.

## Package boundary

```text
@invoice/invoice-repository -> @invoice/domain
@invoice/invoice-repository -> @invoice/invoice-domain
@invoice/invoice-domain -> @invoice/domain
@invoice/invoice-domain -> @invoice/invoice-engine
@invoice/invoice-engine -> @invoice/domain
```

No reverse dependency from domain packages to `@invoice/invoice-repository` was introduced.

## Public APIs

```ts
InvoiceRepository
InvoiceRecordVersion
isInvoiceRecordVersion(...)
parseInvoiceRecordVersion(...)
assertInvoiceRecordVersion(...)
InvoiceRepositoryError
InvoiceRepositoryResult<T>
StoredInvoiceRecord
InvoiceListQuery
InvoiceListResult
```

Repository public methods accept runtime `DraftInvoice`, `FinalizedInvoice`, `VoidedInvoice`, and return runtime `Invoice` aggregates. Raw `SerializedInvoice` is only part of the adapter-facing stored record contract.

## Explicit non-goals preserved

Task 007 did not implement an in-memory repository, local storage, IndexedDB, filesystem storage, DynamoDB, AWS SDK usage, Lambda/API Gateway, HTTP APIs, API client methods, UI, payment settlement, delivery events, invoice-number generation, migrations, or Task 008.

## Verification

Run from the repository root:

```bash
pnpm --filter @invoice/invoice-repository test
pnpm --filter @invoice/invoice-repository typecheck
pnpm --filter @invoice/invoice-repository lint
pnpm --filter @invoice/invoice-repository build
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

Actual verification results are recorded in the task completion response.
