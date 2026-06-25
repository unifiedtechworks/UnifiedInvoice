# 0002: Core Domain Representations

## Status

Accepted for Task 002.

## Context

The invoice platform needs shared domain vocabulary before implementing customers, catalog items, invoices, payments, APIs, persistence, offline behavior, or UI workflows. These representations must be platform-independent and safe to share across mobile, web, service, and future storage boundaries without coupling the domain package to React, React Native, browser APIs, native APIs, AWS SDKs, database libraries, or transport-specific infrastructure.

Task 002 intentionally defines validation and serialization boundaries only. It does not implement invoice calculations, money amounts, invoice lifecycle transitions, persistence, API routes, AWS infrastructure, ID generation, or offline synchronization.

## Decision

### Opaque identifiers

The current platform opaque identifier format is a branded string validated by:

```text
^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$
```

Identifiers therefore have a minimum length of 1 and maximum length of 128. The first character must be alphanumeric, and remaining characters may be alphanumeric, `_`, or `-`. Validation does not trim input. Whitespace, spaces, slashes, path-like values, colons, and unsupported punctuation are rejected.

This is the platform's current opaque identifier format. It is not a DynamoDB key schema, UUID requirement, ULID requirement, third-party identifier standard, or ID-generation strategy.

### Dates and timestamps

Calendar-only dates are represented as branded `YYYY-MM-DD` strings and validated as real Gregorian dates with explicit year, month, and day checks. JavaScript `Date` is not the authoritative validator for calendar-only dates.

Serialized instants are represented as canonical UTC branded strings in this form:

```text
YYYY-MM-DDTHH:mm:ss.sssZ
```

Parsing may accept valid ISO-8601 timestamp input with `Z` or an explicit numeric offset, but successful values are normalized with `toISOString()`. Local timestamps without offsets and date-only values are rejected. Type guards only accept values already in canonical UTC form.

Domain entities should use branded strings rather than JavaScript `Date` objects for serialized date and timestamp fields.

### Currency codes

Currency codes are represented as branded strings validated by:

```text
^[A-Z]{3}$
```

The default currency code is currently `USD`. Validation does not uppercase or trim. Task 002 does not implement amounts, exchange rates, decimal-place assumptions, rounding, or a money representation.

### Invoice status vocabulary

The initial invoice status vocabulary is:

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

Status classification remains intentionally unresolved because paid invoices may later be refunded, overdue invoices may become partially paid, uncollectible may or may not be terminal, voided invoices may be replaced, and refunded may ultimately be better modeled as payment-derived state. Executable transition and classification behavior is deferred to a future invoice-lifecycle task.

### Domain results and errors

Domain validation APIs use `DomainResult<T>` for parse-style functions and JSON-safe `DomainError` details for failures. Assert-style APIs throw `DomainValidationError`, a real framework-independent exception that wraps a `DomainError` detail.

`DomainError` is plain data and does not carry HTTP status codes, React state, AWS error objects, database exceptions, persistence metadata, or logging-framework fields. `DomainValidationError` is runtime control flow for in-process validation and is not a serialized API contract.

### Serialization policy

Current domain values are JSON-safe:

- identifiers are strings
- calendar dates are strings
- timestamps are strings
- currency codes are strings
- invoice statuses are string literals
- domain error details are plain objects

No source module was created solely to hold serialization comments or placeholder constants.

Future money serialization remains unresolved. Native `JSON.stringify` does not serialize `bigint`; Task 002 must not choose `number` versus `bigint`; money serialization will be designed in a later task.

### Archive and deletion policy

Persistence is not implemented in Task 002, but the initial product policy is:

- customers should normally be archived rather than hard-deleted
- catalog items should normally be archived rather than hard-deleted
- finalized financial records must not be hard-deleted through normal workflows
- draft records may eventually support deletion
- historical invoice snapshots must remain valid if source customers or catalog items are archived
- archive behavior must not mutate finalized invoice history

## Consequences

- Domain representation code remains independent of UI, native, browser, AWS, database, and transport concerns.
- Public APIs are explicit and discoverable per identifier type instead of exposing only generic branded helpers.
- Compile-time brands prevent unrelated identifiers from being assigned to one another while retaining JSON-safe string serialization.
- Future tasks can build customer, catalog, invoice, payment, persistence, API, and offline behavior on stable vocabulary without prematurely choosing money or lifecycle semantics.
