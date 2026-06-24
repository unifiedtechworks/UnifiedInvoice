# 0001: Monorepo Foundation

## Status

Accepted

## Decision

Use a pnpm workspace TypeScript monorepo with application code under `apps/*`, shared packages under `packages/*`, and documentation-only placeholders for future services and infrastructure.

## Rationale

- pnpm workspaces provide deterministic package linking for shared TypeScript packages.
- Business logic remains independent from React Native and AWS.
- React Native Android and React Native for Web can consume the same shared domain and UI exports.
- Services and infrastructure are intentionally deferred to avoid fake backend or deployable AWS resources in the foundation milestone.
