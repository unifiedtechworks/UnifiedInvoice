# Task 008: In-Memory Invoice Repository Adapter

## Status

Complete through Task 008F.

Task 008 delivered `@invoice/invoice-repository-memory` as an in-memory-only
invoice repository adapter. 008B scaffolded the package, 008C implemented draft
behavior, 008D implemented finalized/voided behavior and invoice-number
uniqueness, 008E implemented list/query/search/sort/pagination behavior, and
008F performed final cleanup, documentation review, and verification.

No AWS, API, UI, local-storage, IndexedDB, filesystem, DynamoDB, durable
persistence, or invoice-number generation/sequencing work was added. Future
persistence adapters remain separate work.

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

## Scope Implemented in 008E

- Replaced the deferred `list` method with in-memory list/query behavior.
- Added list support for all stored lifecycle kinds: draft, finalized, and voided.
- Added optional lifecycle-kind filtering.
- Added simple adapter-local, case-insensitive search across invoice number and
  customer display name only.
- Added sorting by `updatedAt`, `createdAt`, `issueDate`, and `invoiceNumber`,
  with default `updatedAt desc` ordering.
- Kept records missing optional sort fields after records with present sort fields
  for both ascending and descending directions.
- Added deterministic tie-breaking by invoice ID ascending and then version
  ascending.
- Added offset cursor pagination using opaque `offset:<non-negative integer>`
  cursors.
- Added page-size defaults and validation: default 50, maximum 100, positive safe
  integers only.
- Added cursor validation with `repository_invariant_violation` errors using
  `path: 'cursor'` for invalid cursor formats or unsafe offsets.
- Added page-size validation with `repository_invariant_violation` errors using
  `path: 'pageSize'` for invalid page sizes.
- Reused existing serialized payload parsing and metadata validation before list
  output so corrupt included records are not leaked as list metadata.
- Added frozen list results, frozen list arrays, and frozen list items so callers
  cannot mutate internal repository state through list output.
- Preserved Task 008C/008D create/update/finalize/void/get/discard behavior,
  invoice-number uniqueness, seed support, version-token behavior, and
  serialization/parse boundaries.
- Added runtime tests for default listing, filtering, search, sorting,
  pagination, validation, and immutability.
- Added compile-time tests for valid list queries, invalid kind/sort fields/sort
  directions, and the list result type.
- Added no local storage, AWS, API, UI, auth, invoice-number generation,
  migrations, payments, delivery, PDF/email, reporting, or full-text search code.

## Behavior Still Deferred After 008E

- Task 008F documentation/final verification/cleanup remains deferred.
- Local storage, IndexedDB, filesystem storage, DynamoDB, AWS SDK usage,
  Lambda/API Gateway, HTTP/API client methods, UI, auth/users/accounts/tenants,
  invoice-number generation/sequencing, migrations, payments, delivery events,
  PDF/email, reporting, and full-text search remain out of scope.

## Scope Completed in 008F

- Performed final review of `@invoice/invoice-repository-memory` source exports,
  package scripts, dependencies, tests, repository contracts, domain exports, root
  build/path wiring, lockfile package entries, architecture documentation, ADR
  0008, and this task record.
- Confirmed public package shape exports `createInMemoryInvoiceRepository` and
  `InMemoryInvoiceRepositoryOptions` only.
- Confirmed dependency direction remains adapter-to-domain/ports:
  `@invoice/invoice-repository-memory -> @invoice/domain`,
  `@invoice/invoice-repository-memory -> @invoice/invoice-domain`, and
  `@invoice/invoice-repository-memory -> @invoice/invoice-repository`.
- Confirmed no reverse dependency from source packages back to
  `@invoice/invoice-repository-memory`.
- Confirmed the adapter stores serialized `StoredInvoiceRecord` values in
  private process memory and does not store runtime invoice objects as canonical
  state.
- Confirmed successful writes serialize before storage and reads/lists validate
  stored payloads through invoice-domain parsers before returning data.
- Confirmed implemented behavior covers `createDraft`, `updateDraft`,
  `saveFinalized`, `saveVoided`, `getById`, `list`, `discardDraft`,
  `initialRecords`, optimistic concurrency, idempotency, invoice-number
  uniqueness, invoice-number reservation after void, lifecycle conflicts,
  deterministic version tokens, query validation, frozen outputs, and no internal
  mutable state leakage.
- Updated `docs/architecture.md` and ADR 0008 to reflect the completed adapter
  rather than the earlier scaffold state.
- Added no local storage, AWS, API, UI, auth, invoice-number generation,
  migrations, payments, delivery, PDF/email, reporting, full-text search, new
  package, or dependency code.
- Added no generated files and no package-local `node_modules` to source control.

## Behavior Deferred After 008F

- Durable persistence remains future adapter work, separate from
  `@invoice/invoice-repository-memory`.
- Local storage, IndexedDB, filesystem storage, DynamoDB, AWS SDK usage,
  Lambda/API Gateway, HTTP/API client methods, UI, auth/users/accounts/tenants,
  invoice-number generation/sequencing, migrations, payments, delivery events,
  PDF/email, reporting, and full-text search remain out of scope.

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
- 008D: finalized and voided behavior. (Implemented)
- 008E: list and query behavior. (Implemented)
- 008F: documentation, verification, and final cleanup. (Implemented)

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
