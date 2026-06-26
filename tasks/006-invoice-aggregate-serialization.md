# Task 006: Invoice Aggregate Serialization

## Status

Implemented and verified locally; ready for review.

## Objective

Define explicit, strict, JSON-safe serialization and deserialization for draft, finalized, and voided invoice aggregates while preserving financial precision, lifecycle state, calculation version, and canonical round-trip behavior.

## Implementation summary

- Added `packages/invoice-domain/src/serialization.ts`.
- Added `INVOICE_SCHEMA_VERSION = 1`.
- Added lifecycle-specific and generic serializers/parsers.
- Reused existing Money, Quantity, Rate, CurrencyDefinition, identifier, date, timestamp, invoice number, and text parsers.
- Added strict unknown-property rejection across aggregate and nested shapes.
- Added finalized calculation-version-1 integrity validation without invoking finalization or the full current invoice engine.
- Added runtime round-trip, strict-shape, version, lifecycle, cross-field, integrity, and immutability tests.
- Added compile-time assignability tests for runtime/serialized type separation and schema-version constraints.

## Public APIs

```ts
serializeDraftInvoice(...)
serializeFinalizedInvoice(...)
serializeVoidedInvoice(...)
serializeInvoice(...)

parseSerializedDraftInvoice(...)
parseSerializedFinalizedInvoice(...)
parseSerializedVoidedInvoice(...)
parseSerializedInvoice(...)
```

## Version policy

- Top-level aggregate schema version: numeric literal `1` only.
- Calculation metadata version: `INVOICE_CALCULATION_VERSION`, currently `'1'`, only.
- No migrations are implemented in Task 006.

## Validation policy

- Reject unknown serialized properties consistently.
- Reject raw BigInt in serialized contracts by using primitive serializers.
- Validate lifecycle discriminants.
- Validate draft currency/date/timestamp/line invariants.
- Validate finalized currency consistency, metadata consistency, line identities, totals formulas, and aggregate line sums.
- Validate voided timestamps and nested finalized snapshots.

## Files changed

- `packages/invoice-domain/src/serialization.ts`
- `packages/invoice-domain/src/index.ts`
- `packages/invoice-domain/test/invoice-serialization.test.ts`
- `packages/invoice-domain/test/invoice-serialization-type-assignability.test-d.ts`
- `docs/decisions/0006-invoice-aggregate-serialization.md`
- `docs/architecture.md`
- `tasks/006-invoice-aggregate-serialization.md`

## Verification

Run from the repository root:

```bash
pnpm --filter @invoice/invoice-domain test
pnpm --filter @invoice/invoice-domain typecheck
pnpm --filter @invoice/invoice-domain lint
pnpm --filter @invoice/invoice-domain build
pnpm --filter @invoice/domain test
pnpm --filter @invoice/invoice-engine test
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm web:build
```

## Deferred

- Persistence/API/DynamoDB records.
- Payment and delivery serialization.
- Schema migrations.
- Historical calculation-version migrations.
- Task 007.
