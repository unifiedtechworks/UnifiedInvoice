# Task 008: In-Memory Invoice Repository Adapter

## Status

Scaffolded in Task 008B; behavior deferred.

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

## Deferred Behavior

No repository behavior is implemented in Task 008B. The factory intentionally
throws until a later task adds concrete adapter behavior.

## Planned Next Phases

- 008C: draft behavior.
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
