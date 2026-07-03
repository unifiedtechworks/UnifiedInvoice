# 0011: DynamoDB Invoice Repository Adapter

## Status

Accepted and implemented through Task 011D. Task 011A created the package scaffold, Task 011B
implemented core single-record persistence, Task 011C implemented list/query behavior, and Task
011D completed final review, documentation, and verification.

## Context

`@invoice/invoice-repository` already owns storage-neutral invoice persistence contracts, and
`@invoice/invoice-repository-memory` implements them for non-durable tests and development. The
serverless plan in ADR 0009 selects DynamoDB for durable storage without allowing AWS concerns to
enter domain, lifecycle, calculation, repository-port, API-client, or UI packages.

## Decision

Create `@invoice/invoice-repository-dynamodb` as a separate adapter package. It depends toward the
storage-neutral repository boundary; no domain or repository package depends back on it. Task 011B
implements create, update, get, discard, finalize-save, and void-save operations. `list` is now an
owner-scoped adapter operation with the same observable query semantics as the memory adapter.

The public options require a `DynamoDBDocumentClient`, invoice table name, and authenticated owner
ID. Client injection prevents global clients and lets tests use a command-aware fake without real
AWS. An optional version generator supports deterministic tests; runtime defaults to a UUID-based
opaque token validated by the repository version rules.

## Intended table model

The adapter maps ADR 0009's owner-partitioned model:

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

Task 011C uses a correct small-dataset strategy before optimizing around an undeployed GSI. It
queries only `PK = OWNER#<ownerId>` with `begins_with(SK, "INVOICE#")`, follows every DynamoDB
`LastEvaluatedKey` internally, and excludes number-reservation items without scanning the table or
crossing owner partitions.

Every queried item passes the Task 011B physical-envelope and canonical-record validation before
output. The adapter then applies optional lifecycle filtering; simple case-insensitive search over
invoice number and customer display name; deterministic sorting by updated time, created time,
issue date, or invoice number; and stable ID/version tie-breaking. Missing optional sort values are
always placed last.

Public pagination uses opaque `offset:<non-negative integer>` cursors, with a default page size of
50 and maximum of 100, matching the memory adapter. DynamoDB keys are not exposed. This requires
reading the owner's invoice set before filtering and sorting, which is accepted for the initial
single-user/small-data workload. GSI-optimized listing or a different opaque cursor encoding remains
future work when measured volume justifies it. OpenSearch and full-text search are not introduced.

## Implementation sequence

- 011A: package, public types, throwing factory, tests, documentation, and workspace wiring only.
- 011B: core draft/finalized/voided persistence, reads, discard, validation, concurrency,
  transactions, number reservations, AWS SDK dependencies, and fake-client tests. (Implemented.)
- 011C: owner-partition Query, validation, filter/search/sort behavior, internal DynamoDB paging,
  and offset cursors. (Implemented.)
- 011D: final package-boundary, runtime/storage behavior, test, and documentation review.
  (Implemented.) API composition remains deferred to the planned HTTP API task.

## Non-goals

Task 011 includes no AWS resource/GSI creation, invoice-number generation, API routes,
authentication implementation, UI, migrations, local/browser storage, deployment, OpenSearch, or
changes to repository contracts or the in-memory adapter.

## Consequences

AWS-specific persistence has a clear package boundary while repository contracts and business
logic remain portable. Core operations now use consistent reads, conditional writes, and lifecycle
transactions. List behavior is correct and adapter-consistent for the initial workload, while its
read-all-owner cost is explicit and can be optimized later without changing the repository port.
