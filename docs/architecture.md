# Architecture

This repository is a TypeScript monorepo for an invoice-management platform.

## Current milestone boundaries

- `apps/mobile` contains a bare React Native app with Android as the only native verification target.
- `apps/web` contains a React Native for Web app built with Vite.
- `packages/domain` contains framework-independent reusable primitives, identifiers, dates, money, quantity, rates, invoice numbers, and shared result/error types.
- `packages/invoice-engine` contains deterministic financial invoice calculation only.
- `packages/invoice-domain` contains framework-independent draft invoice, finalization, immutable finalized snapshot, voiding behavior, and canonical JSON-safe invoice aggregate serialization. It depends on `packages/domain` and `packages/invoice-engine` and prevents a `domain -> invoice-engine` dependency cycle.
- `packages/invoice-repository` contains storage-neutral invoice repository ports, repository-local results/errors, opaque record version tokens, and adapter-facing record/list/query contracts. It depends on `packages/domain` and `packages/invoice-domain`; it does not implement storage drivers.
- `packages/invoice-repository-memory` is an in-memory adapter scaffold for the invoice repository contracts. It depends on `packages/domain`, `packages/invoice-domain`, and `packages/invoice-repository`, but actual adapter behavior is deferred to later tasks and it does not persist outside process memory yet.
- `packages/validation` is reserved for shared validation primitives.
- `packages/api-client` is reserved for a future client abstraction and contains no backend implementation.
- `packages/ui` contains React Native primitive-based UI that can be consumed by Android and web.

Business logic must remain independent of React Native and AWS. Financial calculations must not use floating-point currency values. Invoice document lifecycle is separate from settlement, delivery, persistence, APIs, UI, PDF, email, and AWS concerns.
