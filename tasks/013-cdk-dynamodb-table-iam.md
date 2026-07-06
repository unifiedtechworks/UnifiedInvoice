# Task 013: CDK DynamoDB Table and IAM Wiring

## Status

Implemented and deployed to dev in Task 013B; not committed.

## Objective

Add the DynamoDB table and least-privilege Lambda IAM wiring needed for future
`@invoice/invoice-repository-dynamodb` API composition while keeping the deployed API surface
health-only.

## Scope implemented

- Added one environment-scoped DynamoDB table construct named `InvoicesTable`.
- Used physical table name `unified-invoice-<environment>-invoices`, defaulting to
  `unified-invoice-dev-invoices` for the `dev` environment.
- Configured string partition key `PK` and string sort key `SK` for the adapter's owner-partitioned
  invoice and invoice-number reservation items.
- Used on-demand `PAY_PER_REQUEST` billing for low idle cost.
- Kept dev removal policy as destroy-on-stack-removal. Production should revisit removal policy,
  deletion protection, and point-in-time recovery before real customer data is stored.
- Left streams, global tables, provisioned capacity, autoscaling, and secondary indexes disabled.
- Added `APP_ENV` and `INVOICES_TABLE_NAME` to the existing health/API Lambda environment.
- Granted the Lambda only the DynamoDB actions required by the current repository adapter:
  `GetItem`, `PutItem`, `UpdateItem`, `DeleteItem`, `Query`, and `TransactWriteItems`.
- Scoped DynamoDB permissions to the table ARN and did not grant `Scan` or wildcard DynamoDB
  access.
- Added the `InvoicesTableName` stack output while preserving `HealthApiUrl` and
  `HealthFunctionName`.

## Intentionally deferred

Invoice API handlers, invoice API routes, Cognito/auth integration, owner derivation, web/mobile
integration, invoice-number sequencing, migrations, PDF/email/export behavior, custom domains,
production deployment, VPC/NAT, app S3 buckets, budgets, secrets, and later-task work remain
deferred. `/health` remains the only route.

## Verification

Run the focused CDK checks, API checks, repository-wide checks, generated-output cleanup, read-only
AWS identity check, CDK diff, and final Git inspection listed in the Task 013 request. Deployment is
not automatic and must wait for explicit approval.

## Task 013B dev deployment

Task 013B deployed the DynamoDB table/IAM wiring to the existing dev stack.

- Region: `us-west-2`.
- AWS account recorded for review as `9064****2082`.
- Stack name: `unified-invoice-dev-api`.
- Table name: `unified-invoice-dev-invoices`.
- Stack outputs include `HealthApiUrl`, `HealthFunctionName`, and `InvoicesTableName`.
- DynamoDB verification confirmed the table is `ACTIVE`, uses `PAY_PER_REQUEST` billing, and has
  string keys `PK` and `SK`.
- Lambda configuration verification confirmed `APP_ENV=dev`,
  `INVOICES_TABLE_NAME=unified-invoice-dev-invoices`, timeout `5`, and memory size `128`.
- The health endpoint from `HealthApiUrl` returned `{"ok":true,"service":"unified-invoice-api"}`.
- No test data was written to DynamoDB.
- No invoice API routes, Cognito, VPC/NAT, app S3 bucket, custom domain, budget, secret, production
  resource, or Task 014 work was deployed.

## Follow-on Task 014 boundary

Task 014 adds the dev Cognito User Pool, User Pool Client, and HTTP API JWT authorizer scaffold for
future authenticated invoice routes. It keeps `/health` public and does not add invoice API routes,
real users, passwords, hosted UI domains, VPC/NAT, app S3 buckets, custom domains, budgets, secrets,
production configuration, or deployment automation.
