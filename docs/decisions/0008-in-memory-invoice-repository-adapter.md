# ADR 0008: In-Memory Invoice Repository Adapter Scaffold

## Status

Accepted for scaffold only in Task 008B.

## Context

Task 007 introduced the storage-neutral invoice repository boundary contracts in
`@invoice/invoice-repository`. Task 008B prepares a separate in-memory adapter
package for future repository behavior without changing the existing contracts.

## Decision

- Scaffold `@invoice/invoice-repository-memory` in `packages/invoice-repository-memory`.
- Keep the adapter package separate from `@invoice/invoice-repository`.
- Establish the intended dependency direction from the adapter package to:
  - `@invoice/domain`
  - `@invoice/invoice-domain`
  - `@invoice/invoice-repository`
- Expose a placeholder `createInMemoryInvoiceRepository` factory and options type.

## Non-Goals

- No in-memory adapter behavior is implemented in this scaffold task.
- The package does not yet implement `InvoiceRepository` behavior.
- Concrete create, update, save, get, list, query, discard, seeding, indexing,
  cursor, metadata, or storage behavior is deferred to Task 008C onward.
- No AWS, API, UI, local-storage, IndexedDB, filesystem, or external persistence
  work is included.

## Consequences

- Future tasks can implement `InvoiceRepository` in the adapter package without
  adding reverse dependencies from domain packages or repository contracts.
- Task 008C and later tasks must replace the throwing placeholder with real
  adapter behavior and dedicated verification.
