# Architecture

This repository is a TypeScript monorepo for an invoice-management platform.

## Current milestone boundaries

- `apps/mobile` contains a bare React Native app with Android as the only native verification target.
- `apps/web` contains a React Native for Web app built with Vite.
- `packages/domain` contains framework-independent domain foundation exports.
- `packages/invoice-engine` is reserved for future invoice calculation logic, but currently only proves workspace resolution.
- `packages/validation` is reserved for shared validation primitives.
- `packages/api-client` is reserved for a future client abstraction and contains no backend implementation.
- `packages/ui` contains React Native primitive-based UI that can be consumed by Android and web.

Business logic must remain independent of React Native and AWS. Financial calculations must not use floating-point currency values, and no final money abstraction or invoice formula is implemented in this milestone.
