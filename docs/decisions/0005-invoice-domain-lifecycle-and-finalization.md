# 0005: Invoice Domain Lifecycle and Finalization

## Status

Accepted for Task 005.

## Decision

Task 005 introduces `packages/invoice-domain` as an orchestration package for draft invoices, finalization, immutable finalized invoice snapshots, and voiding.

Dependency graph:

```text
@invoice/invoice-domain -> @invoice/domain
@invoice/invoice-domain -> @invoice/invoice-engine
@invoice/invoice-engine -> @invoice/domain
```

`packages/domain` owns reusable primitives such as `InvoiceNumber`. `packages/invoice-engine` continues to own financial calculation only. No `domain -> invoice-engine` dependency is introduced.

## Lifecycle model

The public lifecycle model is:

```ts
type Invoice = DraftInvoice | FinalizedInvoice | VoidedInvoice;
```

Discriminants are `draft`, `finalized`, and `voided`. Legacy `invoiceStatuses` remains exported from `packages/domain` for compatibility, but it is not the Task 005 lifecycle model because it mixes document lifecycle, delivery, payment, and display states.

## Draft model

Draft invoices contain editable document data, no invoice number, no payments, and no cached calculation output. Empty drafts are allowed. Draft edit operations are immutable, accept explicit caller-supplied `updatedAt` timestamps, validate affected invariants, and return frozen results.

Draft lines use the strict minimal snapshot: line ID, position, description, quantity, unit price, optional discount, and optional tax. SKU, catalog references, unit labels, service dates, tax labels, product metadata, and internal line notes are deferred.

## Invoice number

`InvoiceNumber` is a branded reusable primitive in `packages/domain` with canonical pattern:

```text
^[A-Za-z0-9][A-Za-z0-9_/-]{0,63}$
```

It validates format only. Uniqueness and sequence generation are deferred to persistence/backend services. Invoice numbers are supplied externally during finalization.

## Party and address snapshots

Business and customer use the same immutable `PartySnapshot` shape. Finalization requires each party to have `displayName`. Optional snapshot fields include legal name, email, phone, billing address, and tax identifier. Address snapshots require line1, city, and country code when an address is present; postal code is optional. `CountryCode` is exactly two uppercase ASCII letters without a full ISO registry.

Task 005 does not implement customer CRUD, business-profile CRUD, or catalog CRUD. Finalized invoices preserve party and line snapshots so rendering and audit do not depend on mutable external records.

## Text, dates, and timestamps

Canonical input is not silently trimmed. Human-readable fields allow printable Unicode and reject inappropriate ASCII control characters. Notes and terms allow newlines; line descriptions and void reasons are single-line.

Existing `IsoDateString` and `UtcTimestampString` primitives are used. Domain operations never call `Date.now()` or `new Date()` for current-time generation. Required ordering rules include:

```text
dueDate >= issueDate
updatedAt >= createdAt
new edit updatedAt >= previous draft.updatedAt
finalizedAt >= createdAt
voidedAt >= finalizedAt
```

Structured payment terms and due-date derivation are deferred. Task 005 keeps only explicit issue/due dates and free-text terms.

## Calculation integration and finalization

Draft calculation is derived on demand through `toInvoiceCalculationInput` and `calculateDraftInvoice`. Payments are omitted. Task 005 does not duplicate Task 004 formulas.

Finalization accepts only:

```ts
type FinalizeInvoiceCommand = Readonly<{
  invoiceNumber: InvoiceNumber;
  finalizedAt: UtcTimestampString;
}>;
```

The draft must already contain business, customer, issue date, due date, and at least one line. Finalization invokes Task 004, propagates calculation errors, verifies calculated line count and IDs, combines descriptive inputs with calculated outputs, records calculation metadata/version, sets `updatedAt = finalizedAt`, and freezes outputs. Caller-supplied totals are never accepted.

## Finalized snapshot

`FinalizedInvoice` is immutable issuance data. It includes invoice number, parties, dates, currency, finalized lines, invoice discount, totals, calculation metadata, notes/terms, created/updated/finalized timestamps. It does not include payments, settlement totals, payment status, delivery history, or mutable external references.

Finalized lines retain both entered financial definitions and calculated amounts as flat fields for audit and rendering.

## Voiding

Only finalized invoices can be voided. Voiding requires a single-line `VoidReason` and `voidedAt >= finalizedAt`. `VoidedInvoice` preserves the original finalized snapshot, invoice number, and totals; totals are not replaced with zero. Voided is terminal and no unvoid operation exists. Drafts are discarded by application behavior, not voided.

## Deferred features

- Settlement, payment status, payment ledger, refunds, and credit notes.
- Delivery/sent/viewed events and email/PDF integration.
- Overdue as a time-dependent query/display condition.
- Revision numbers and optimistic concurrency.
- Complete lifecycle serialization; future contracts must use explicit schema versions, no raw BigInt, existing Money/Quantity/Rate serializers, strict parsing from `unknown`, calculation-version preservation, and no AWS-specific storage shape.
- Persistence, APIs, AWS, UI, catalog/customer/business CRUD, exchange rates, currency conversion, and Task 006.

## Error model

Domain operations remain fail-fast with `DomainResult<T>`. Task 005 reuses existing errors where appropriate and adds only concrete implemented paths, including invoice number, invoice, invoice line, missing required field, party snapshot, address, and void reason validation errors.
