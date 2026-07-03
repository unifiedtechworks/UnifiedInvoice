# Architecture

This repository is a TypeScript monorepo for an invoice-management platform.

## Current milestone boundaries

- `apps/mobile` contains a bare React Native app with Android as the only native verification target.
- `apps/web` contains a React Native for Web app built with Vite.
- `apps/api` contains the health-only TypeScript Lambda application scaffold. It currently exposes
  no invoice routes and has no dependency on invoice domain or repository packages.
- `packages/domain` contains framework-independent reusable primitives, identifiers, dates, money, quantity, rates, invoice numbers, and shared result/error types.
- `packages/invoice-engine` contains deterministic financial invoice calculation only.
- `packages/invoice-domain` contains framework-independent draft invoice, finalization, immutable finalized snapshot, voiding behavior, and canonical JSON-safe invoice aggregate serialization. It depends on `packages/domain` and `packages/invoice-engine` and prevents a `domain -> invoice-engine` dependency cycle.
- `packages/invoice-repository` contains storage-neutral invoice repository ports, repository-local results/errors, opaque record version tokens, and adapter-facing record/list/query contracts. It depends on `packages/domain` and `packages/invoice-domain`; it does not implement storage drivers.
- `packages/invoice-repository-memory` contains the in-memory invoice repository adapter for tests, development, and local non-durable use. It depends on `packages/domain`, `packages/invoice-domain`, and `packages/invoice-repository`; stores serialized `StoredInvoiceRecord` values in process memory only; enforces repository contracts, optimistic concurrency, invoice-number uniqueness, lifecycle rules, list/query behavior, and serialization/parse boundaries; and does not add durable storage, browser storage, AWS, API, or UI concerns.
- `packages/invoice-repository-dynamodb` is the owner-scoped durable DynamoDB adapter. It is
  separate from the storage-neutral repository contracts and the in-memory adapter. Task 011 is
  complete: the adapter implements draft/finalized/voided persistence, consistent reads,
  conditional writes, invoice-number reservation transactions, and validated owner-partition
  list/query behavior without a table-wide scan. API composition, infrastructure resources,
  authentication, and deployment remain separate later-task concerns.
- `packages/validation` is reserved for shared validation primitives.
- `packages/api-client` is reserved for a future client abstraction and contains no backend implementation.
- `packages/ui` contains React Native primitive-based UI that can be consumed by Android and web.
- `infra/cdk` contains the active AWS CDK infrastructure scaffold for the unauthenticated
  `GET /health` HTTP API and Lambda only. It packages the existing `apps/api` build output,
  defaults to the `dev` environment through CDK context, and creates no DynamoDB, Cognito, S3,
  VPC, NAT, custom domain, budget, invoice route, secret, or account-specific deployment
  configuration. Task 012A superseded and removed the Task 010 SAM scaffold; deployment remains
  deferred.

Business logic must remain independent of React Native and AWS. Financial calculations must not use floating-point currency values. Invoice document lifecycle is separate from settlement, delivery, persistence, APIs, UI, PDF, email, and AWS concerns.
