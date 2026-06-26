# Task 005: Invoice Domain Model, Finalization, and Lifecycle

## Status

Implemented and verified. Ready to commit after review.

## Objective

Create a framework-independent invoice-domain package that owns editable draft invoices, finalization, immutable finalized invoice snapshots, and voiding while using Task 004 for deterministic financial calculation.

## Implementation summary

- Added `InvoiceNumber` to `packages/domain`.
- Added `packages/invoice-domain` with draft invoice types, party/address snapshots, focused text primitives, immutable draft editing functions, calculation adapter, finalization, and voiding.
- Kept settlement, delivery, lifecycle serialization, persistence, APIs, UI, AWS, and Task 006 out of scope.

## Package boundary

```text
@invoice/invoice-domain -> @invoice/domain
@invoice/invoice-domain -> @invoice/invoice-engine
@invoice/invoice-engine -> @invoice/domain
```

No circular dependency is introduced.

## Files changed

- `package.json`
- `tsconfig.base.json`
- `docs/architecture.md`
- `docs/decisions/0005-invoice-domain-lifecycle-and-finalization.md`
- `tasks/005-invoice-domain-lifecycle-and-finalization.md`
- `packages/domain/src/invoice-number.ts`
- `packages/domain/src/index.ts`
- `packages/domain/src/result.ts`
- `packages/domain/test/invoice-number.test.ts`
- `packages/invoice-domain/**`

## Tests added

- Invoice number runtime tests.
- Party/address/text snapshot tests.
- Draft creation and editing tests.
- Draft calculation/finalization tests.
- Voiding lifecycle tests.
- Compile-time lifecycle separation tests.

## Deferred

- Settlement/payment state.
- Delivery/sent/viewed events.
- Overdue display/query state.
- Revision/concurrency.
- Complete lifecycle serialization.
- Persistence, APIs, AWS, UI, PDF, email, customer CRUD, business CRUD, catalog CRUD, credit notes, refunds, Task 006.

## Verification

- `pnpm --filter @invoice/domain test` — passed, 12 files / 112 tests.
- `pnpm --filter @invoice/invoice-engine test` — passed, 2 files / 27 tests.
- `pnpm --filter @invoice/invoice-domain test` — passed, 4 files / 12 tests.
- `pnpm --filter @invoice/invoice-domain typecheck` — passed.
- `pnpm --filter @invoice/invoice-domain lint` — passed.
- `pnpm --filter @invoice/invoice-domain build` — passed.
- `pnpm typecheck` — passed.
- `pnpm lint` — passed.
- `pnpm format:check` — initially reported formatting drift in Task 005 source files; after running Prettier on Task 005 source files only, passed.
- `pnpm test` — passed, 18 files / 151 tests.
- `pnpm build` — passed.
- `pnpm web:build` — passed.
