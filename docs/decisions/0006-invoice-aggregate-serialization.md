# 0006: Invoice Aggregate Serialization

## Status

Accepted for Task 006.

## Context

Task 005 introduced framework-independent draft, finalized, and voided invoice aggregate runtime types. Those runtime values include branded strings, frozen objects, and BigInt-backed financial primitives that are not safe to serialize directly with JSON. The platform needs canonical machine contracts for moving invoice aggregates across future persistence, API, offline, and integration boundaries without choosing any storage or transport-specific shape.

Serialization must remain independent of React, React Native, browser/native APIs, AWS SDKs, DynamoDB attribute-value records, HTTP frameworks, databases, ORMs, PDF, email, payment gateways, and locale formatting libraries.

## Decision

Aggregate serialization lives in `packages/invoice-domain/src/serialization.ts` because it depends on invoice-domain aggregate types, domain primitive serializers, and invoice-engine calculation result types. The dependency graph remains:

```text
@invoice/invoice-domain -> @invoice/domain
@invoice/invoice-domain -> @invoice/invoice-engine
@invoice/invoice-engine -> @invoice/domain
```

## Schema version

Every top-level serialized invoice includes:

```ts
schemaVersion: 1;
```

Task 006 exports:

```ts
INVOICE_SCHEMA_VERSION = 1;
```

Only numeric schema version `1` is accepted. Missing versions, string versions, unsupported numeric versions, and extra version fields are rejected with existing invoice validation errors. Task 006 does not implement schema migrations.

## Lifecycle contracts

Top-level lifecycle discriminants are:

```text
draft
finalized
voided
```

Voided invoices contain a nested finalized snapshot that includes `kind: 'finalized'` but omits its own `schemaVersion`; the top-level voided schema version governs the nested snapshot and avoids conflicting version metadata.

## Primitive reuse

Money, quantity, and rate use existing JSON-safe serializers and parsers from `@invoice/domain`. Currency definitions use the existing `{ code, minorUnitDigits }` structure and are parsed with `parseCurrencyDefinition`. Identifiers, dates, timestamps, invoice numbers, parties, addresses, and text values are parsed through their existing public domain or invoice-domain parsers. Untrusted strings are not branded by unchecked casts.

## Strict shape policy

All serialized object levels reject unknown properties, including invoices, nested finalized snapshots, lines, parties, addresses, discounts, taxes, totals, and metadata. Optional fields are omitted when absent; serializers do not emit `undefined` properties.

## Calculation version

Schema version 1 supports calculation version 1 only:

```ts
calculationVersion === INVOICE_CALCULATION_VERSION;
```

Unsupported calculation versions fail with `invalid_invoice_calculation`. Task 006 does not provide historical multi-version reading, version-aware validation, or migration. Future calculation versions may require version-specific validators or explicit migrations.

## Finalized integrity policy

Finalized and voided parsing does not call `finalizeInvoice` or the full current `calculateInvoice` engine. Parsers validate stored values and construct frozen runtime snapshots without replacing calculated values.

For calculation version 1, parsers validate line identities, tax/taxable-base rules, totals formulas, and aggregate totals against line sums using Money operations. Inconsistent finalized snapshots fail with `invariant_violation` and accurate paths. Stored values are never repaired or normalized.

## Immutability and round trips

Parsed runtime invoices, nested lines, parties, addresses, totals, metadata, and arrays are frozen. Serialized outputs are newly created and frozen without mutating caller-owned runtime objects or serialized inputs.

Canonical round trips preserve lifecycle kind, invoice numbers, line order, optional field absence, financial precision, calculation metadata, and all stored calculated values through `JSON.stringify`/`JSON.parse`.

## Rejected alternatives

- Storage-specific records, DynamoDB keys, API DTO wrappers, and persistence schemas were rejected as out of scope.
- Nested schema versions inside voided finalized snapshots were rejected to avoid conflicting version metadata.
- Recalculating finalized snapshots with the current engine during parsing was rejected because it could rewrite historical values.
- Adding a schema validation dependency was rejected; Task 006 uses small internal helpers.

## Deferred

- Aggregate schema migrations.
- Historical calculation-version migrations and multi-version readers.
- Persistence records, APIs, DynamoDB mappings, offline storage adapters, payment serialization, delivery serialization, hashing, signatures, encryption, compression, and Task 007.
