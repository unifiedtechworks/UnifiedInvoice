# DynamoDB invoice repository adapter

`@invoice/invoice-repository-dynamodb` is the durable DynamoDB adapter for the storage-neutral
`@invoice/invoice-repository` port.

The completed adapter provides owner-scoped persistence for:

```text
createDraft
updateDraft
getById
list
discardDraft
saveFinalized
saveVoided
```

The factory requires an injected `DynamoDBDocumentClient`, invoice table name, and already-
authenticated owner ID. Tests inject a local command-aware fake; they make no AWS calls. Runtime
versions default to UUID-based opaque tokens, while tests may inject a deterministic generator.

Invoice items use owner-partitioned `OWNER#<ownerId>` / `INVOICE#<invoiceId>` keys. Finalization
transactionally claims `INVOICE_NUMBER#<invoiceNumber>`, and voiding preserves that reservation.
Canonical serialized records are parsed and checked against physical item metadata on reads.

`list` queries every `INVOICE#` item in the authenticated owner partition,
following DynamoDB's internal pages, validating each physical/canonical record, and then applying
kind filtering, simple invoice-number/customer search, deterministic sorting, and `offset:<n>`
pagination. Reservation items and other owners are never queried. The early-production strategy is
correct for small owner datasets; a future measured need may replace it with GSI-optimized access
behind the same opaque cursor contract.

The package creates no AWS resources and does not implement API routes, authentication, or invoice-
number generation.

## Local commands

```powershell
pnpm --filter @invoice/invoice-repository-dynamodb test
pnpm --filter @invoice/invoice-repository-dynamodb typecheck
pnpm --filter @invoice/invoice-repository-dynamodb lint
pnpm --filter @invoice/invoice-repository-dynamodb build
```

Task 011D completed final package, behavior, storage-boundary, test, and documentation review. API
composition remains deferred to the existing API integration task split; no deployment or invoice-
number generation is part of this package.
