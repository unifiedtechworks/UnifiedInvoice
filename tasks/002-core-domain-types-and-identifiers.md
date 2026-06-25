# Task 002: Core Domain Types and Identifiers

## Status

Completed; ready for review and commit.

## Objective

Define platform-independent core domain vocabulary and identifier types for future customer, catalog, invoice, payment, API, persistence, and offline features.

## Scope completed

- Added compile-time branded string primitives for domain values.
- Added explicit parse, type guard, and assert APIs for:
  - `UserId`
  - `BusinessId`
  - `CustomerId`
  - `CatalogItemId`
  - `InvoiceId`
  - `InvoiceLineItemId`
  - `PaymentId`
  - `InvoiceEventId`
  - `DocumentId`
- Added `DomainErrorCode`, `DomainError`, `DomainResult<T>`, `ok`, `err`, `makeDomainError`, and `DomainValidationError`.
- Added `IsoDateString` validation using explicit Gregorian calendar rules.
- Added `UtcTimestampString` parsing and canonical UTC normalization.
- Added `CurrencyCode` and `DEFAULT_CURRENCY_CODE`.
- Added the initial `InvoiceStatus` vocabulary.
- Preserved Task 001 foundation exports used by mobile, web, and invoice-engine packages.
- Added runtime Vitest coverage for identifiers, dates, timestamps, currency, invoice statuses, and domain errors/results.
- Added TypeScript compile-time assignability checks included by `packages/domain/tsconfig.json` and normal `pnpm typecheck`.
- Documented serialization, archive/deletion, invoice status classification, and future money/lifecycle deferrals in ADR 0002.

## Validation rules

### Identifiers

```text
^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$
```

- Minimum length: 1.
- Maximum length: 128.
- First character must be alphanumeric.
- Remaining characters may be alphanumeric, `_`, or `-`.
- Input is not trimmed.
- Whitespace, spaces, path separators, colons, and unsupported punctuation are rejected.

### Calendar dates

- Canonical format: `YYYY-MM-DD`.
- Dates are validated as real Gregorian calendar dates.
- Leap-year rule: `year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)`.
- Date-time strings and whitespace-padded values are rejected.

### UTC timestamps

- Canonical stored form: `YYYY-MM-DDTHH:mm:ss.sssZ`.
- Parsing accepts valid timestamp input with `Z` or explicit numeric offset.
- Successful parses normalize with `Date.prototype.toISOString()`.
- Local timestamps without offsets, date-only strings, malformed/impossible values, and whitespace-padded values are rejected.
- `isUtcTimestamp` only returns true for already-canonical UTC values.

### Currency codes

```text
^[A-Z]{3}$
```

- Uppercase three-letter values such as `USD` and `EUR` are accepted.
- Lowercase, wrong lengths, digits, punctuation, and whitespace-padded values are rejected.
- Values are not uppercased or trimmed.

### Invoice statuses

Initial vocabulary:

```text
draft
finalized
sent
viewed
partially_paid
paid
overdue
voided
uncollectible
refunded
```

No transition rules, terminal classifications, exceptional-status helpers, payment-state derivation, or lifecycle engine were implemented.

## Non-goals preserved

Task 002 did not implement invoice calculations, money, quantity representation, rounding, tax arithmetic, discounts, persistence, DynamoDB keys, API routes, AWS infrastructure, UI changes, ID generation, offline synchronization, or invoice lifecycle transitions.

## Deferred design decisions

- Money representation and serialization, including `number` versus `bigint`.
- Invoice lifecycle transitions and status classifications.
- Payment-derived state behavior.
- Persistence schemas and archive workflow implementation.
- ID generation strategy.

## Verification

Run from the repository root:

```bash
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm build
pnpm web:build
```

Additional checks:

- Confirm mobile and web compatibility exports remain intact.
- Confirm `packages/domain` has no React or AWS dependencies.
- Confirm no new type-test dependency was added.
