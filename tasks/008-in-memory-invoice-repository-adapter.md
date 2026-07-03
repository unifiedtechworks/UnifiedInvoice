# Task 008: In-Memory Invoice Repository Adapter

## Status

Draft behavior implemented in Task 008C. Finalized and voided behavior,
invoice-number indexing, and finalized/voided seed support implemented in Task
008D. List/query/search/sort/pagination behavior remains deferred to Task 008E.

## Scope Implemented in 008B

- Created `packages/invoice-repository-memory` as `@invoice/invoice-repository-memory`.
- Added package-local TypeScript, tsup, Vitest, and lint/build script wiring.
- Added placeholder exports for `createInMemoryInvoiceRepository` and
  `InMemoryInvoiceRepositoryOptions`.
- Added minimal runtime scaffold verification that confirms the placeholder
  factory is exported and throws the scaffold message.
- Added compile-time assignability coverage for scaffold options and factory
  shape.
- Added root TypeScript path and root build script wiring.
- Documented the scaffold boundary in ADR 0008 and `docs/architecture.md`.

## Behavior Deferred After 008B

Task 008B did not implement repository behavior. The scaffold factory
intentionally threw until Task 008C added concrete draft adapter behavior.

## Scope Implemented in 008C

- Replaced the placeholder factory with a draft-capable
  `createInMemoryInvoiceRepository()` implementation.
- Implemented draft lifecycle methods:
  - `createDraft`
  - `updateDraft`
  - `getById`
  - `discardDraft`
- Added deterministic in-memory version tokens (`v1`, `v2`, `v3`, ...), using
  `assertInvoiceRecordVersion` from `@invoice/invoice-repository`.
- Added optimistic concurrency checks for `updateDraft` and `discardDraft`.
- Stored only canonical `StoredInvoiceRecord` values in private adapter-owned
  memory storage.
- Serialized draft runtime invoices with `serializeDraftInvoice` at successful
  write boundaries.
- Parsed stored serialized draft payloads with `parseSerializedDraftInvoice`
  before returning runtime invoices.
- Added draft record metadata validation against parsed payloads for `getById`
  and write round trips.
- Supported `initialRecords` for valid draft records, including duplicate seed ID
  rejection and future version generation that avoids seeded `vN` collisions.
- Rejected finalized and voided seed records with a construction error because
  they are deferred to Task 008D.
- Kept `saveFinalized`, `saveVoided`, and `list` present on the repository object
  but returning `repository_unavailable` results with clear deferred-task
  messages.
- Replaced scaffold runtime tests with focused draft lifecycle tests.
- Updated memory adapter compile-time assignability tests for the public API and
  branded ID/version constraints.

## Behavior Still Deferred After 008C

- `saveFinalized` returns `repository_unavailable` until Task 008D.
- `saveVoided` returns `repository_unavailable` until Task 008D.
- `list` returns `repository_unavailable` until Task 008E.
- Finalized invoice persistence, voided invoice persistence, invoice-number
  indexing/uniqueness, finalized/voided idempotency, and finalized/voided seed
  support are not implemented in Task 008C.
- List/query/search/sort/pagination behavior is not implemented in Task 008C.

## Scope Implemented in 008D

- Implemented finalized lifecycle persistence through `saveFinalized`.
- Implemented voided lifecycle persistence through `saveVoided`.
- Added in-memory invoice-number indexing with uniqueness enforcement for
  finalized and voided invoices.
- Preserved invoice-number reservation after voiding.
- Added finalized and voided stored-record derivation from canonical Task 006
  serializers.
- Added finalized and voided metadata validation against parsed serialized
  payloads.
- Extended `getById` to parse and return draft, finalized, and voided runtime
  invoices with versions.
- Added idempotent finalized and voided saves using canonical serialized payload
  equality; idempotent no-op saves return the existing version without
  incrementing.
- Added finalized and voided initial-record seed support, including duplicate ID
  rejection, duplicate invoice-number rejection, and future version generation
  that avoids seeded `vN` collisions.
- Preserved Task 008C draft behavior for `createDraft`, `updateDraft`,
  `discardDraft`, draft seed support, version tokens, and metadata validation.
- Kept `list` deferred with `repository_unavailable` and the Task 008E message.
- Added no AWS, API, UI, local-storage, IndexedDB, filesystem, DynamoDB, or
  invoice-number generation code.

## Behavior Still Deferred After 008D

- `list` returns `repository_unavailable` until Task 008E.
- Query/search/sort/pagination behavior is not implemented in Task 008D.
- Local storage, IndexedDB, filesystem storage, DynamoDB, AWS SDK usage,
  Lambda/API Gateway, HTTP/API client methods, UI, auth/users/accounts/tenants,
  invoice-number generation/sequencing, migrations, payments, delivery events,
  and Task 008F remain out of scope.

## Verification Results for 008D

Focused checks run during implementation:

```powershell
pnpm --filter @invoice/invoice-repository-memory test
pnpm --filter @invoice/invoice-repository-memory typecheck
pnpm --filter @invoice/invoice-repository-memory lint
```

Results: all passed during implementation. The package build and repository-wide
verification commands are listed below and should be run before final handoff.

## Verification Results for 008C

Focused checks run during implementation:

```powershell
pnpm --filter @invoice/invoice-repository-memory typecheck
pnpm --filter @invoice/invoice-repository-memory test
```

Results: both passed after replacing the obsolete scaffold test with draft
behavior coverage.

## Planned Next Phases

- 008C: draft behavior. (Implemented)
- 008D: finalized and voided behavior.
- 008E: list and query behavior.
- 008F: documentation, verification, and final cleanup.

## Verification Commands

Focused package checks:

```powershell
pnpm --filter @invoice/invoice-repository-memory test
pnpm --filter @invoice/invoice-repository-memory typecheck
pnpm --filter @invoice/invoice-repository-memory lint
pnpm --filter @invoice/invoice-repository-memory build
```

Repository-wide checks:

```powershell
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm web:build
```
