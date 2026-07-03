# Task 011: DynamoDB Invoice Repository Adapter

## Status

Task 011A scaffold implemented locally; ready for review after verification.

## Objective

Establish the isolated DynamoDB adapter package and intended design without implementing any
DynamoDB persistence behavior.

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

## Planned sequence

- **011A:** scaffold package only. (This task.)
- **011B:** implement core draft, finalized, voided, read, discard, concurrency, validation,
  transaction, and invoice-number reservation behavior.
- **011C:** implement durable list/query/cursor behavior if separated for safe review.
- **011D:** integrate with `apps/api` or confirm that composition stays in the planned API task.

## Explicit non-goals

No invoice-number generation, API routes, authentication, UI, migrations, local/browser storage,
AWS resource creation, DynamoDB table changes, real AWS account configuration, deployment, commit,
or Task 011B work is included.

## Verification

Run the focused package checks, repository-wide checks, API checks, generated-output cleanup, and
final Git inspection from the Task 011A request. Actual results are recorded in the completion
response.
