# 0007: Invoice Persistence Repository Boundary

## Status

Accepted for Task 007.

## Context

The platform now has framework-independent primitives, deterministic invoice calculation, invoice lifecycle/finalization, voiding, and canonical JSON-safe aggregate serialization. The next boundary must define how invoices are saved, loaded, listed, and conditionally updated without leaking React, React Native, browser storage, local device storage, filesystem, AWS, DynamoDB, Lambda, API Gateway, HTTP framework, PDF, email, or payment provider concerns into the domain packages.

Task 007 implements repository ports only. It does not implement persistence drivers, in-memory storage, API methods, AWS resources, UI, migrations, invoice-number generation, settlement, delivery events, or Task 008.

## Decision

Create `packages/invoice-repository` with package name `@invoice/invoice-repository`.

The package owns storage-neutral invoice repository contracts, repository-local result/error types, an opaque invoice record version token, and adapter-facing record/list/query types.

Dependency graph:

```text
@invoice/invoice-repository -> @invoice/domain
@invoice/invoice-repository -> @invoice/invoice-domain
@invoice/invoice-domain -> @invoice/domain
@invoice/invoice-domain -> @invoice/invoice-engine
@invoice/invoice-engine -> @invoice/domain
```

No reverse dependency is introduced from `domain`, `invoice-domain`, or `invoice-engine` to `invoice-repository`.

## Package ownership alternatives

Repository interfaces were not placed in `packages/invoice-domain` because async persistence ports, concurrency tokens, listing contracts, and storage records are not invoice aggregate lifecycle rules. Keeping them separate preserves `invoice-domain` as the owner of runtime aggregate behavior and canonical serialization.

Repository interfaces were not placed in `packages/api-client` because the repository boundary must be usable by local, memory, server-side, backend, and future API adapters. Putting the port in `api-client` would imply HTTP/client transport too early.

Concrete storage first was rejected because it would likely leak storage-specific decisions into UI or API code before a stable boundary exists.

## Runtime API and serialized storage

Repository public methods accept and return runtime invoice aggregate objects from `@invoice/invoice-domain`:

```ts
DraftInvoice;
FinalizedInvoice;
VoidedInvoice;
Invoice;
```

Callers do not pass raw `SerializedInvoice` values into create, update, finalize-save, or void-save operations. This prevents application code from bypassing runtime aggregate invariants.

Adapter-facing record contracts may contain canonical `SerializedInvoice` payloads. Concrete adapters are expected to serialize runtime invoices at the boundary and parse stored serialized payloads through Task 006 parsers before returning runtime aggregates.

## Repository interface

The repository port uses explicit lifecycle-aware methods:

- `createDraft`
- `updateDraft`
- `saveFinalized`
- `saveVoided`
- `getById`
- `list`
- `discardDraft`

`saveFinalized` and `saveVoided` are persistence operations only. They do not perform domain finalization or domain voiding. Callers must pass already-finalized or already-voided aggregate values.

All repository methods are async and return `Promise<InvoiceRepositoryResult<T>>`. No synchronous repository interface, streams, observables, subscriptions, or event emitters are introduced.

## Repository-local error model

Repository errors are local to `@invoice/invoice-repository` and are not added to `@invoice/domain`.

Expected persistence-boundary failures are modeled as results rather than exceptions. Error codes include not found, already exists, concurrency conflict, invoice-number conflict, invalid records, invalid record versions, repository unavailable, and repository invariant violation.

## Opaque version token

Optimistic concurrency uses:

```ts
type InvoiceRecordVersion = Brand<string, 'InvoiceRecordVersion'>;
```

The token is non-empty, at most 128 characters, contains no whitespace or ASCII control characters, and has no numeric meaning. Real adapters supply tokens. Callers pass previously returned tokens as expected versions for update/finalize/void/discard operations.

Domain invoice aggregates do not gain revision fields, and `updatedAt` is not used as a concurrency token.

## Storage-neutral record contract

`StoredInvoiceRecord` contains invoice ID, lifecycle kind, schema version, canonical serialized invoice payload, version token, timestamps, and denormalized list/query metadata such as invoice number, customer display name, issue date, due date, finalized timestamp, and voided timestamp.

The record shape does not include DynamoDB keys, API route fields, localStorage keys, filesystem paths, database table names, auth fields, user IDs, account IDs, or tenant IDs.

Record metadata is denormalized from the canonical serialized invoice payload and must be validated by concrete adapters.

## Persistence semantics

### `createDraft`

- create-only
- fails if invoice ID already exists
- accepts only `DraftInvoice`
- returns a new version

### `updateDraft`

- requires expected version
- updates only an existing draft
- fails if missing
- fails if stale version
- fails if existing record is finalized or voided
- does not recalculate

### `saveFinalized`

- requires expected version
- normally replaces an existing draft with a finalized invoice of the same ID
- fails if stale version
- fails if existing record is voided
- fails if an existing finalized record differs
- enforces invoice-number uniqueness
- does not recalculate

### `saveVoided`

- requires expected version
- replaces an existing finalized invoice with a voided invoice of the same ID
- fails if stale version
- fails if existing record is draft
- fails if an existing voided record differs
- preserves invoice-number reservation
- does not recalculate or zero totals

### `discardDraft`

- requires expected version
- deletes/discards drafts only
- fails for finalized or voided invoices
- finalized/voided hard deletion is deferred

### `getById`

- returns runtime parsed invoice and version
- returns `invoice_not_found` if absent

### `list`

- returns list metadata and versions
- full invoice inclusion is deferred

## Invoice-number uniqueness

Invoice-number uniqueness is enforced at the repository/application persistence boundary, not by the aggregate domain.

- Applies to finalized and voided invoices.
- Drafts do not have invoice numbers.
- Voided invoice numbers remain reserved.
- Duplicate numbers use `invoice_number_conflict`.
- Scope will likely become per account/business after auth/backend planning.
- Task 007 does not implement invoice-number generation or sequencing.

## Query/listing scope

The initial query contract supports lifecycle kind filtering, optional search text, sorting by updated date, created date, issue date, or invoice number, sort direction, page size, and opaque cursor.

Task 007 does not implement search behavior. Exact matching, customer-display-name matching, sorting stability, cursor encoding, and backend index strategy belong to concrete adapters.

## Validation at persistence boundary

Concrete repository implementations should serialize through Task 006 serializers, parse stored payloads through Task 006 parsers before returning aggregates, reject invalid stored records, validate denormalized metadata against payloads, never return unvalidated serialized data, never mutate input aggregates, and never recalculate finalized or voided invoices.

## Deferred

- in-memory repository adapter
- local storage, IndexedDB, filesystem, or database adapters
- DynamoDB tables and AWS SDK usage
- Lambda, API Gateway, HTTP, REST, or GraphQL
- API client methods
- UI/screens/forms/navigation
- auth, users, accounts, tenants, and ownership scope
- invoice-number generation/sequencing
- migrations and historical schema readers
- payment settlement and delivery events
- PDF, email, payments, reporting, full-text search, and Task 008
