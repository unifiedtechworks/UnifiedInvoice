# AWS CDK infrastructure scaffold

`@invoice/infra-cdk` is the active infrastructure-as-code package for Unified Invoice. Task 012A
superseded and removed the Task 010 SAM scaffold so there is one active infrastructure path.

The current dev stack contains:

- the existing `apps/api` Lambda artifact;
- an API Gateway HTTP API with `GET /health`;
- a 128 MB, five-second Node.js 22 Lambda;
- a DynamoDB invoice repository table named `unified-invoice-<environment>-invoices`; and
- a Cognito User Pool, User Pool Client, and HTTP API JWT authorizer for future invoice routes; and
- an explicit CloudWatch log group with 14-day retention.

It creates no VPC/NAT, custom domain, S3 bucket, budget, invoice route, secret, real user, password,
or account-specific configuration. No deployment is performed by repository scripts.

## Local commands

```powershell
pnpm --filter @invoice/infra-cdk test
pnpm --filter @invoice/infra-cdk typecheck
pnpm --filter @invoice/infra-cdk lint
pnpm --filter @invoice/infra-cdk build
pnpm --filter @invoice/infra-cdk synth
```

The `synth` script builds `apps/api` first because the Lambda asset is `apps/api/dist` and the
handler remains `index.healthHandler`. The default environment is `dev`; override it locally with
CDK context, for example `pnpm cdk:synth -- --context environment=test`. Synthesis is local and
does not deploy resources. Remove generated `cdk.out` and API `dist` output after verification.

## DynamoDB invoice table

Task 013 adds the DynamoDB table that future invoice API handlers will use through
`@invoice/invoice-repository-dynamodb`. The table uses:

- physical name `unified-invoice-<environment>-invoices`;
- partition key `PK` and sort key `SK`, both strings;
- on-demand `PAY_PER_REQUEST` billing;
- no streams, global tables, autoscaling, provisioned capacity, or secondary indexes yet; and
- dev-focused destroy-on-stack-removal behavior.

The health Lambda receives `APP_ENV` and `INVOICES_TABLE_NAME` environment variables so future API
composition can wire the repository adapter without hardcoded resource names. Its IAM policy is
scoped to the table ARN and limited to:

```text
dynamodb:GetItem
dynamodb:PutItem
dynamodb:UpdateItem
dynamodb:DeleteItem
dynamodb:Query
dynamodb:TransactWriteItems
```

`dynamodb:Scan` and wildcard DynamoDB permissions are intentionally not granted. Production should
revisit table removal policy, deletion protection, and point-in-time recovery before storing real
customer data.

## Cognito auth scaffold

Task 014 adds the Cognito auth resources that future invoice routes will use:

- User Pool named `unified-invoice-<environment>-users`;
- public self-registration disabled;
- email sign-in enabled;
- strong password policy with 12-character minimum, uppercase, lowercase, number, and symbol
  requirements;
- account recovery by verified email;
- MFA off for dev;
- dev-focused destroy-on-stack-removal behavior;
- User Pool Client named `unified-invoice-<environment>-web-client`;
- no client secret; and
- HTTP API JWT authorizer named `unified-invoice-<environment>-jwt-authorizer`.

The JWT authorizer is intentionally prepared but not attached to any route yet. `/health` remains
public, and no invoice API routes exist. The Lambda receives non-secret `COGNITO_USER_POOL_ID` and
`COGNITO_USER_POOL_CLIENT_ID` environment variables for future handler composition. CDK does not
create users, passwords, hosted UI domains, callback URLs, logout URLs, app S3 buckets, custom
domains, budgets, or secrets. Production should revisit MFA, account recovery, custom domains,
auth UX, and removal policy before real users are onboarded.

## Dev deployment

Task 012B deployed the health-only dev stack in `us-west-2` for masked account `9064****2082`.
Task 013B deployed the DynamoDB table/IAM wiring to the same dev stack. The CDK bootstrap stack
already existed and was not rerun.

Use temporary region settings instead of changing global AWS configuration:

```powershell
$env:AWS_REGION = "us-west-2"
$env:AWS_DEFAULT_REGION = "us-west-2"
```

Useful commands:

```powershell
pnpm --filter @invoice/infra-cdk synth
pnpm --filter @invoice/infra-cdk exec cdk diff -c environment=dev
pnpm --filter @invoice/infra-cdk exec cdk deploy -c environment=dev
```

The deployed dev stack is `unified-invoice-dev-api`. Its deployment outputs include
`HealthApiUrl`, `HealthFunctionName`, and `InvoicesTableName`. Verify the deployed endpoint with
the `HealthApiUrl` stack output:

```powershell
Invoke-RestMethod -Uri "<HealthApiUrl>"
```

Expected response:

```json
{
  "ok": true,
  "service": "unified-invoice-api"
}
```

Destroy is intentionally a manual operation and was not run during Task 012B:

```powershell
pnpm --filter @invoice/infra-cdk exec cdk destroy -c environment=dev
```

Task 013B verification confirmed `unified-invoice-dev-invoices` is `ACTIVE`, uses on-demand
`PAY_PER_REQUEST` billing, and has string keys `PK` and `SK`. Lambda verification confirmed
`APP_ENV=dev`, `INVOICES_TABLE_NAME=unified-invoice-dev-invoices`, timeout `5`, and memory `128`.
No invoice routes, Cognito, VPC/NAT, app S3 bucket, custom domain, budget, secret, or production
resource was deployed.
