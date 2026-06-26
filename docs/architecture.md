# Architecture

This repository is a TypeScript monorepo for an invoice-management platform.

## Current milestone boundaries

- `apps/mobile` contains a bare React Native app with Android as the only native verification target.
- `apps/web` contains a React Native for Web app built with Vite.
- `packages/domain` contains framework-independent reusable primitives, identifiers, dates, money, quantity, rates, invoice numbers, and shared result/error types.
- `packages/invoice-engine` contains deterministic financial invoice calculation only.
- `packages/invoice-domain` contains framework-independent draft invoice, finalization, immutable finalized snapshot, voiding behavior, and canonical JSON-safe invoice aggregate serialization. It depends on `packages/domain` and `packages/invoice-engine` and prevents a `domain -> invoice-engine` dependency cycle.
- `packages/validation` is reserved for shared validation primitives.
- `packages/api-client` is reserved for a future client abstraction and contains no backend implementation.
- `packages/ui` contains React Native primitive-based UI that can be consumed by Android and web.

Business logic must remain independent of React Native and AWS. Financial calculations must not use floating-point currency values. Invoice document lifecycle is separate from settlement, delivery, persistence, APIs, UI, PDF, email, and AWS concerns.
