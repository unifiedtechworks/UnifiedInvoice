# Task 010: Serverless Backend SAM Scaffold

## Status

Implemented locally; ready for review after verification.

## Objective

Add a minimal TypeScript Lambda/API and AWS SAM scaffold with a testable `GET /health` route. This
task does not add invoice behavior, persistence, DynamoDB, Cognito, authorization, or deployment.

## Scope implemented

- Added `apps/api` as private workspace package `@invoice/api`.
- Added a small JSON response helper and health handler.
- Added focused health response tests.
- Added an ESM tsup build producing `dist/index.mjs` for Lambda packaging.
- Added an AWS SAM template with a Node.js 22 HTTP API/Lambda, low runtime limits, tags, and 14-day
  log retention.
- Added example SAM configuration and local/deployment-readiness documentation.
- Added root API scripts and root build participation.
- Updated architecture documentation for the health-only scaffold.
- Clarified ADR 0009's Task 010 summary so the DynamoDB table remains deferred to Task 011.

## Intentionally deferred

DynamoDB tables and repository behavior, Cognito and authorization, invoice routes, S3, PDF/export,
VPC/NAT, deployment automation, AWS Budget notification resources, secrets, account-specific
configuration, and Task 011 are deferred. ADR 0009's $10 and $20 alerts remain required before
production.

## Verification

Run the focused API checks, repository-wide checks, SAM validation when available, and final Git
inspection listed in the Task 010 completion request. No generated `dist`, package-local
`node_modules`, secrets, real account IDs, deployment, or commit should remain.
