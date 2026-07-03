# Task 010: Serverless Backend SAM Scaffold

## Status

Implemented in Task 010, then superseded by Task 012A. The reusable `apps/api` health handler and
build remain, but the active SAM infrastructure files were removed when the project switched to
CDK.

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

## Superseded infrastructure direction

Task 012A replaced the active SAM scaffold with `infra/cdk`, the repository's AWS CDK
infrastructure package. The CDK scaffold now owns the health-only API Gateway HTTP API and Lambda
definition. No deployment was performed during the switch, and DynamoDB, Cognito, invoice routes,
custom domains, budgets, VPC/NAT, real account IDs, and secrets remain deferred.

## Intentionally deferred

DynamoDB tables and repository behavior, Cognito and authorization, invoice routes, S3, PDF/export,
VPC/NAT, deployment automation, AWS Budget notification resources, secrets, account-specific
configuration, and Task 011 are deferred. ADR 0009's $10 and $20 alerts remain required before
production.

## Verification

Run the focused API checks, repository-wide checks, SAM validation when available, and final Git
inspection listed in the Task 010 completion request. No generated `dist`, package-local
`node_modules`, secrets, real account IDs, deployment, or commit should remain.
