# Task 004: Invoice Calculation Engine

## Status

Implemented and verified; ready to commit after review.

## Objective

Implement a deterministic, platform-independent invoice calculation engine using existing domain primitives for money, quantity, rates, rounding, currency, identifiers, results, and errors.

## Files changed

- `packages/domain/src/result.ts`
- `packages/domain/src/rate.ts`
- `packages/domain/src/index.ts`
- `packages/domain/package.json`
- `packages/domain/test/rate.test.ts`
- `packages/domain/test/type-assignability.test-d.ts`
- `packages/invoice-engine/src/types.ts`
- `packages/invoice-engine/src/calculate-invoice.ts`
- `packages/invoice-engine/src/index.ts`
- `packages/invoice-engine/package.json`
- `packages/invoice-engine/test/calculate-invoice.test.ts`
- `packages/invoice-engine/test/type-assignability.test-d.ts`
- `docs/decisions/0004-invoice-calculation-engine.md`
- `tasks/004-invoice-calculation-engine.md`

## Implementation summary

- Added a reusable domain `Rate` primitive with parts-per-million units, generic 0% through 1000% bounds, strict machine parsing, exact serialized shape validation, and `applyRateToMoney`.
- Added invoice calculation input/output types, calculation metadata, settlement totals, and `INVOICE_CALCULATION_VERSION = '1'`.
- Implemented pure `calculateInvoice` with deterministic line ordering, immutable outputs, line and invoice discounts, largest-remainder allocation, exclusive tax, per-line and invoice-total tax strategies, rate grouping, payments, and overpayment rejection.
- Preserved `invoiceEngineFoundation`.
- Added focused package test scripts so filtered package tests execute from the workspace root with the existing root Vitest config.

## Calculation version

```ts
INVOICE_CALCULATION_VERSION = '1';
```

## Rate representation

```text
RATE_SCALE = 1_000_000n
MIN_RATE_UNITS = 0n
MAX_RATE_UNITS = 10_000_000n
```

Generic domain rates support 0% through 1000%. Invoice calculation discounts and taxes enforce 0% through 100% context bounds.

## Tax scope

- Exclusive taxes only.
- Omitted tax means untaxed line.
- Zero or one tax rate per line.
- No inclusive extraction.
- No compounding.
- No jurisdiction-specific behavior.

## Payment scope

- Optional applied payment list.
- Unique payment IDs.
- Non-negative payment amounts.
- Matching invoice currency.
- Overpayments rejected.
- No refunds, payment processing, or cross-invoice allocation.

## Explicit non-goals

No inclusive taxes, compound taxes, multiple tax components per line, jurisdiction-specific tax law, adjustments, negative line/credit modeling, refunds, overpayment credit balances, payment processing, cross-invoice payment allocation, exchange rates, currency conversion, lifecycle state machine, finalized snapshots, customers, catalog, APIs, persistence, AWS, UI, PDF, email, or Task 005 work.

## Acceptance criteria

- No floating-point currency arithmetic.
- Generic domain rates support 0% through 1000%; invoice-engine policy constrains discounts and taxes to 0% through 100%.
- Caller arrays are not mutated.
- Invoice discount and invoice-total tax allocation are exact, deterministic, currency-preserving, and BigInt-only.
- Untaxed lines remain included in discounted subtotal and grand total.
- Payments are separated into settlement totals and overpayments are rejected.
- Outputs are frozen.
- Public APIs are exported from package indexes.
- Verification commands pass.

## Tests added

- Domain rate parser, serialization, deserialization, immutability, rounding, negative halfway rounding modes, overflow, and type separation tests.
- Invoice calculation tests for basic totals, ordering, invalid positions, currency mismatches, discounts, allocation, tax strategies, tax grouping, payments, runtime validation, immutability, determinism, and overflow.
- Compile-time tests for `RateUnits`, `Rate`, calculated versus input lines, and invalid tax rounding strategy.

## Verification

Required commands:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm web:build
```

Commands already run during continuation:

- `git status --short && git diff --stat && git diff --name-only && git log --oneline --decorate -4` — passed; baseline at `a40bd38` with expected Task 004 working-tree changes.
- `pnpm --filter @invoice/invoice-engine typecheck 2>&1` — passed during implementation.
- `pnpm --filter @invoice/domain test 2>&1` — passed; 11 files, 109 tests.
- `pnpm --filter @invoice/invoice-engine test 2>&1` — initially failed because package-local Vitest could not find files with the root include pattern; after script correction, passed; 2 files, 27 tests.

Final full verification results are recorded in the completion response for this task.

## Deferred decisions

- Adjustments as distinct entities.
- Negative lines and credit memo behavior.
- Inclusive, compound, and multi-component taxes.
- Payment allocation and refunds.
- Invoice lifecycle transitions.
- Finalized invoice snapshots.
- Persistence, APIs, PDF, email, UI, and AWS integration.

## Unresolved decisions

None for Task 004. Deferred features remain explicitly out of scope.

## Android/web implications

The engine is TypeScript-only shared business logic. There are no mobile UI, web UI, native, or AWS changes. Web build verification is still required because web is first-class for this milestone.

## Readiness to commit

Ready to commit after final verification and reviewer approval. No commit was created by this task.
