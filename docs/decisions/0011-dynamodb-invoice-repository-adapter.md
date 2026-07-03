# 0011: DynamoDB Invoice Repository Adapter

## Status

Accepted as the Task 011 implementation direction. Task 011A creates a scaffold only.

## Context

`@invoice/invoice-repository` already owns storage-neutral invoice persistence contracts, and
`@invoice/invoice-repository-memory` implements them for non-durable tests and development. The
serverless plan in ADR 0009 selects DynamoDB for durable storage without allowing AWS concerns to
enter domain, lifecycle, calculation, repository-port, API-client, or UI packages.

## Decision

Create `@invoice/invoice-repository-dynamodb` as a separate adapter package. It depends toward the
storage-neutral repository boundary; no domain or repository package depends back on it. Task 011A
exports a typed factory and options only. The factory always throws the documented scaffold error
until Task 011B implements the complete repository behavior.

Do not accept an AWS SDK client in the initial public options. The scaffold needs only an invoice
table name and authenticated owner ID. Task 011B will decide the narrow client injection boundary
when real calls and tests exist, avoiding a premature SDK dependency in 011A.

## Intended table model

The adapter will map ADR 0009's owner-partitioned model:

```text
Invoice item:
  PK = OWNER#<ownerId>
  SK = INVOICE#<invoiceId>

Invoice-number reservation:
  PK = OWNER#<ownerId>
  SK = INVOICE_NUMBER#<canonicalInvoiceNumber>

Updated-time index:
  GSI1PK = OWNER#<ownerId>
  GSI1SK = UPDATED#<updatedAt>#<invoiceId>
```

The owner ID is supplied by trusted backend composition after authentication, never derived from
invoice request data. Adapter instances are owner-scoped so every key and query remains within one
owner partition. A future account resolver may replace the initial Cognito subject without changing
domain aggregates or repository contracts.

## Stored item shape

Invoice items will use a DynamoDB-specific physical envelope containing keys, entity discriminator,
owner scope, GSI attributes, and the fields from `StoredInvoiceRecord`: invoice ID, lifecycle kind,
schema version, canonical `SerializedInvoice`, opaque version, timestamps, and denormalized list
metadata. DynamoDB keys and ownership remain outside `StoredInvoiceRecord`.

The adapter must serialize runtime invoices at successful write boundaries and parse canonical
payloads through `@invoice/invoice-domain` before returning runtime aggregates. Money, quantities,
and rates remain in their JSON-safe serialized representations and are never converted to floating
point.

## Optimistic concurrency

Each successful mutation will receive a new opaque version token, such as a UUID. Versions have no
numeric meaning, and `updatedAt` is not a version. Draft creation uses an absence condition;
updates, finalization, voiding, and draft discard condition on the expected stored version.
Conditional failures map to the existing storage-neutral repository error model.

## Invoice-number uniqueness

Finalization will use an atomic DynamoDB transaction to update the invoice and conditionally create
an owner-scoped number-reservation item. A verified same-invoice idempotent retry may reuse the
reservation. Voiding retains it permanently, and draft discard does not touch it. The adapter does
not generate or sequence invoice numbers.

## List/query strategy

The initial durable list will query GSI1 in descending updated-time order and encode DynamoDB's
evaluated key as an opaque cursor. Lifecycle filtering may continue bounded reads to fill a page.
Small-dataset invoice-number/customer-name search may use bounded post-filtering. Other sort modes
remain unavailable until an index can provide globally correct pagination. OpenSearch and full-text
search are not introduced.

## Implementation sequence

- 011A: package, public types, throwing factory, tests, documentation, and workspace wiring only.
- 011B: core draft/finalized/voided persistence, reads, discard, validation, concurrency,
  transactions, and number reservations.
- 011C: durable list/query/cursor behavior if kept separate for review safety.
- 011D: compose the adapter into `apps/api` or confirm that integration remains in the planned HTTP
  API task.

## Non-goals

Task 011A includes no DynamoDB calls, AWS SDK dependency, AWS resource creation, invoice-number
generation, API routes, authentication implementation, UI, migrations, local/browser storage,
partial repository implementation, or changes to the in-memory adapter.

## Consequences

AWS-specific persistence has a clear package boundary while repository contracts and business
logic remain portable. The unusable-by-design throwing factory prevents scaffold code from being
mistaken for durable behavior. Real client and persistence decisions stay reviewable in Task 011B.
