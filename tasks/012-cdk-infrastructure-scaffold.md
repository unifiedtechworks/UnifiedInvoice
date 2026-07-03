# Task 012: CDK Infrastructure Scaffold

## Status

Implemented locally in Task 012A; ready for review after verification. No deployment was
performed.

## Objective

Replace the active AWS SAM infrastructure scaffold with a TypeScript AWS CDK scaffold while
preserving the existing health-only backend boundary.

## Scope implemented

- Added `infra/cdk` as private workspace package `@invoice/infra-cdk`.
- Added CDK app, stack, package scripts, local README, and focused CDK assertion tests.
- Added root CDK convenience scripts and included the CDK package in workspace/build wiring.
- Defined the existing `apps/api` health handler as a Node.js 22 Lambda asset from the API build
  output.
- Added an API Gateway HTTP API route for `GET /health`.
- Configured low-cost Lambda settings: 128 MB memory, five-second timeout, and 14-day log
  retention.
- Added `Project=UnifiedInvoice`, `ManagedBy=CDK`, and `Environment=<environment>` tags.
- Supported a default `dev` environment name with CDK context override and environment-specific
  stack/resource names.
- Removed the active Task 010 SAM scaffold files.
- Updated architecture, ADR, and task documentation to state that CDK is now the active
  infrastructure direction.

## Intentionally deferred

DynamoDB tables, Cognito/User Pools, invoice API routes, custom domains, S3 deploy buckets,
budgets, VPC/NAT, production configuration, real AWS account IDs, secrets, deployment, and
invoice-number generation remain deferred. The CDK stack does not create real AWS resources unless
a later task explicitly runs deployment.

## Verification

Run focused CDK checks, API checks, repository-wide checks, generated-output cleanup, lockfile
inspection, and final Git inspection listed in the Task 012A completion request. Generated
`cdk.out`, `dist`, and package-local `node_modules` output should not remain in the final status.
