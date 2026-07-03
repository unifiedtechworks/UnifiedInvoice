# Task 011: DynamoDB Invoice Repository Adapter

## Status

Tasks 011A and 011B are complete. Task 011C list/query behavior is implemented locally and ready for
verification.

## Objective

Deliver the DynamoDB adapter in reviewable phases: establish its package boundary in 011A,
implement core owner-scoped persistence in 011B, and add list/query behavior in 011C.

## Scope implemented in 011A

- Created `packages/invoice-repository-dynamodb` as
  `@invoice/invoice-repository-dynamodb`.
- Added table-name and owner-scoped factory option types.
- Added a factory explicitly typed to return `InvoiceRepository` that always throws the Task 011B
  scaffold error.
- Added runtime export/error coverage and compile-time boundary coverage.
- Added ADR 0011, package documentation, architecture documentation, workspace path/build wiring,
  and the required lockfile importer.
- Added no AWS SDK, DynamoDB call, infrastructure resource, API route, auth, UI, or partial
  repository method.

## Scope implemented in 011B

- Added injected `DynamoDBDocumentClient` and optional deterministic version generation to the
  owner/table-scoped factory options.
- Implemented `createDraft`, `updateDraft`, `getById`, `discardDraft`, `saveFinalized`, and
  `saveVoided` with consistent reads, conditional writes, and lifecycle-aware error mapping.
- Added owner-partitioned invoice items containing canonical `StoredInvoiceRecord` payloads and
  denormalized future-list metadata.
- Added transactional invoice-number reservation during finalization and reservation preservation
  during voiding.
- Added canonical payload parsing, physical metadata validation, opaque UUID versions, idempotent
  finalized/voided saves, and `repository_unavailable` for deferred `list` behavior.
- Added `@aws-sdk/client-dynamodb` and `@aws-sdk/lib-dynamodb` only to this adapter package.
- Added command-aware fake-client tests; no tests contact AWS.

## Scope implemented in 011C

- Implemented `list(query?)` with the same defaults, validation, filtering, search, sorting,
  tie-breaking, optional-field ordering, pagination, and immutable outputs as the memory adapter.
- Queries only the authenticated owner partition with `begins_with(SK, "INVOICE#")`; never scans
  the table, crosses owners, or includes invoice-number reservations.
- Follows DynamoDB `LastEvaluatedKey` pages internally before applying globally correct adapter-
  local ordering and `offset:<n>` pagination.
- Reuses Task 011B envelope and canonical record validation so corrupt items fail the whole list
  instead of leaking metadata or partial results.
- Extended the fake document client with paginated `QueryCommand` behavior and added focused list,
  owner-isolation, validation, corruption, and immutability tests without real AWS calls.
- Added no dependencies and made no API, SAM, Cognito, web, UI, or repository-contract changes.

## Planned sequence

- **011A:** scaffold package only. (This task.)
- **011B:** implement core draft, finalized, voided, read, discard, concurrency, validation,
  transaction, and invoice-number reservation behavior. (Implemented.)
- **011C:** implement durable list/query/cursor behavior. (Implemented.)
- **011D:** integrate with `apps/api` or confirm that composition stays in the planned API task.

## Explicit non-goals

No invoice-number generation, API routes, authentication, UI, migrations, local/browser storage,
AWS resource or GSI creation, DynamoDB table changes, real AWS account configuration, deployment,
commit, or Task 012 work is included.

## Verification

Run the focused package checks, repository-wide checks, API checks, generated-output cleanup, and
final Git inspection from the Task 011A request. Actual results are recorded in the completion
response.
