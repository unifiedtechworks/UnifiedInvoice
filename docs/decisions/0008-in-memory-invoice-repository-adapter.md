# ADR 0008: In-Memory Invoice Repository Adapter

## Status

Accepted. Completed through Task 008F.

## Context

Task 007 introduced the storage-neutral invoice repository boundary contracts in
`@invoice/invoice-repository`. Task 008 adds a concrete in-memory adapter without
changing those contracts or creating reverse dependencies from domain or port
packages back to an adapter.

The adapter is intended for tests, development, and local non-durable use. It is
not a persistence strategy for production data.

## Decision

- Provide `@invoice/invoice-repository-memory` in
  `packages/invoice-repository-memory` as a separate adapter package.
- Keep repository contracts in `@invoice/invoice-repository`; the in-memory
  package implements those contracts but does not define new repository ports.
- Preserve the dependency direction from the adapter package to:
  - `@invoice/domain`
  - `@invoice/invoice-domain`
  - `@invoice/invoice-repository`
- Expose `createInMemoryInvoiceRepository` and
  `InMemoryInvoiceRepositoryOptions`.
- Store only serialized `StoredInvoiceRecord` values as canonical adapter state.
- Serialize successful writes before storage and parse stored serialized payloads
  before returning runtime invoice aggregates.
- Enforce repository lifecycle rules for draft creation/update/discard,
  finalized saves, voided saves, reads, and list queries.
- Enforce optimistic concurrency through opaque record versions.
- Enforce invoice-number uniqueness for finalized and voided invoices and keep
  invoice numbers reserved after voiding.
- Support `initialRecords` seeding with validation, duplicate ID rejection,
  duplicate invoice-number rejection, and deterministic future version generation.
- Support adapter-local list/query behavior: lifecycle filtering, simple
  case-insensitive search over invoice number and customer display name,
  supported sorting, deterministic tie-breaking, offset cursors, and page-size
  validation.

## Non-Goals

- No durable storage is included.
- No AWS, API, UI, local-storage, IndexedDB, filesystem, DynamoDB, SDK, or
  external persistence work is included.
- The adapter is not responsible for invoice-number generation or sequencing;
  callers provide already-assigned invoice numbers when saving finalized
  invoices.
- The adapter does not recalculate, finalize, void, settle, deliver, render, or
  email invoices.

## Consequences

- Tests and local development can use a concrete repository implementation while
  durable persistence adapters remain separate future work.
- Domain packages and repository contracts remain independent of adapter code.
- The adapter provides useful contract enforcement but process memory remains
  non-durable; data is lost when the repository instance/process is discarded.
