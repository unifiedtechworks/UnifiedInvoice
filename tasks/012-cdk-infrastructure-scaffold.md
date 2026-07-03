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

## Task 012B dev deployment

Task 012B deployed the health-only CDK stack to the dev environment in `us-west-2`.

- AWS account recorded for review as `9064****2082`.
- CDK bootstrap already existed in `us-west-2` with bootstrap version 28; bootstrap was not rerun.
- Deployed stack name: `unified-invoice-dev-api`.
- Deployed resources were limited to the health Lambda, HTTP API, `GET /health` route/integration,
  Lambda invoke permission for API Gateway, Lambda execution role for basic logging, explicit log
  group with 14-day retention, CDK metadata, and stack outputs.
- Stack outputs captured `HealthApiUrl` and `HealthFunctionName`.
- The deployed `HealthApiUrl` endpoint returned `{"ok":true,"service":"unified-invoice-api"}`.
- No DynamoDB table, Cognito User Pool, invoice API route, VPC/NAT, custom domain, app S3 bucket,
  budget, secret, or production resource was deployed.
- The live endpoint URL is intentionally not committed; use the `HealthApiUrl` stack output when
  verifying the deployed health endpoint.

## Follow-on Task 013 boundary

Task 013 is the follow-on infrastructure task that adds the dev DynamoDB invoice table, Lambda table
environment variables, and least-privilege table IAM wiring. It does not add invoice API handlers,
invoice routes, Cognito, VPC/NAT, custom domains, app S3 buckets, budgets, secrets, production
configuration, or deployment automation. `/health` remains the only API route.
