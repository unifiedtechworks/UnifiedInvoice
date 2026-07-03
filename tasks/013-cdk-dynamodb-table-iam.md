# Task 013: CDK DynamoDB Table and IAM Wiring

## Status

Implemented locally; not deployed and not committed.

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
