# 0011: DynamoDB Invoice Repository Adapter

## Status

Accepted. Task 011A created the scaffold, and Task 011B implements core persistence.

## Context

`@invoice/invoice-repository` already owns storage-neutral invoice persistence contracts, and
`@invoice/invoice-repository-memory` implements them for non-durable tests and development. The
serverless plan in ADR 0009 selects DynamoDB for durable storage without allowing AWS concerns to
enter domain, lifecycle, calculation, repository-port, API-client, or UI packages.

## Decision

Create `@invoice/invoice-repository-dynamodb` as a separate adapter package. It depends toward the
storage-neutral repository boundary; no domain or repository package depends back on it. Task 011B
implements create, update, get, discard, finalize-save, and void-save operations. `list` remains an
explicit `repository_unavailable` result until Task 011C.

The public options require a `DynamoDBDocumentClient`, invoice table name, and authenticated owner
ID. Client injection prevents global clients and lets tests use a command-aware fake without real
AWS. An optional version generator supports deterministic tests; runtime defaults to a UUID-based
opaque token validated by the repository version rules.

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

Invoice items use a DynamoDB-specific physical envelope containing keys, entity discriminator,
owner scope, GSI attributes, and the fields from `StoredInvoiceRecord`: invoice ID, lifecycle kind,
schema version, canonical `SerializedInvoice`, opaque version, timestamps, and denormalized list
metadata. DynamoDB keys and ownership remain outside `StoredInvoiceRecord`.

The adapter serializes runtime invoices at successful write boundaries and parses canonical
payloads through `@invoice/invoice-domain` before returning runtime aggregates. Money, quantities,
and rates remain in their JSON-safe serialized representations and are never converted to floating
point.

## Optimistic concurrency

Each successful mutation receives a new UUID-based opaque version token. Versions have no
numeric meaning, and `updatedAt` is not a version. Draft creation uses an absence condition;
updates, finalization, voiding, and draft discard condition on the expected stored version.
Conditional failures map to the existing storage-neutral repository error model.

## Invoice-number uniqueness

Finalization uses an atomic DynamoDB transaction to update the invoice and conditionally create
an owner-scoped number-reservation item. A verified same-invoice idempotent retry may reuse the
reservation. Voiding retains it permanently, and draft discard does not touch it. The adapter does
not generate or sequence invoice numbers.

## List/query strategy

Task 011B stores GSI1 metadata but does not query it. Task 011C will query GSI1 in descending
updated-time order and encode DynamoDB's
evaluated key as an opaque cursor. Lifecycle filtering may continue bounded reads to fill a page.
Small-dataset invoice-number/customer-name search may use bounded post-filtering. Other sort modes
remain unavailable until an index can provide globally correct pagination. OpenSearch and full-text
search are not introduced.

## Implementation sequence

- 011A: package, public types, throwing factory, tests, documentation, and workspace wiring only.
- 011B: core draft/finalized/voided persistence, reads, discard, validation, concurrency,
  transactions, number reservations, AWS SDK dependencies, and fake-client tests. (Implemented.)
- 011C: durable list/query/cursor behavior if kept separate for review safety.
- 011D: compose the adapter into `apps/api` or confirm that integration remains in the planned HTTP
  API task.

## Non-goals

Task 011B includes no list/query/search/sort/pagination, AWS resource creation, invoice-number
generation, API routes, authentication implementation, UI, migrations, local/browser storage,
deployment, or changes to the in-memory adapter.

## Consequences

AWS-specific persistence has a clear package boundary while repository contracts and business
logic remain portable. Core operations now use consistent reads, conditional writes, and lifecycle
transactions. The deliberately unavailable list method prevents accidental reliance on incomplete
query semantics before Task 011C.
