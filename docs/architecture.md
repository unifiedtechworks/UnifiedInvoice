# Architecture

This repository is a TypeScript monorepo for an invoice-management platform.

## Current milestone boundaries

- `apps/mobile` contains a bare React Native app with Android as the only native verification target.
- `apps/web` contains a React Native for Web app built with Vite.
- `packages/domain` contains framework-independent reusable primitives, identifiers, dates, money, quantity, rates, invoice numbers, and shared result/error types.
- `packages/invoice-engine` contains deterministic financial invoice calculation only.
- `packages/invoice-domain` contains framework-independent draft invoice, finalization, immutable finalized snapshot, voiding behavior, and canonical JSON-safe invoice aggregate serialization. It depends on `packages/domain` and `packages/invoice-engine` and prevents a `domain -> invoice-engine` dependency cycle.
- `packages/invoice-repository` contains storage-neutral invoice repository ports, repository-local results/errors, opaque record version tokens, and adapter-facing record/list/query contracts. It depends on `packages/domain` and `packages/invoice-domain`; it does not implement storage drivers.
- `packages/invoice-repository-memory` contains the in-memory invoice repository adapter for tests, development, and local non-durable use. It depends on `packages/domain`, `packages/invoice-domain`, and `packages/invoice-repository`; stores serialized `StoredInvoiceRecord` values in process memory only; enforces repository contracts, optimistic concurrency, invoice-number uniqueness, lifecycle rules, list/query behavior, and serialization/parse boundaries; and does not add durable storage, browser storage, AWS, API, or UI concerns.
- `packages/validation` is reserved for shared validation primitives.
- `packages/api-client` is reserved for a future client abstraction and contains no backend implementation.
- `packages/ui` contains React Native primitive-based UI that can be consumed by Android and web.

Business logic must remain independent of React Native and AWS. Financial calculations must not use floating-point currency values. Invoice document lifecycle is separate from settlement, delivery, persistence, APIs, UI, PDF, email, and AWS concerns.
