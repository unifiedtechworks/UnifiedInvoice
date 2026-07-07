# AWS CDK infrastructure scaffold

`@invoice/infra-cdk` is the active infrastructure-as-code package for Unified Invoice. Task 012A
superseded and removed the Task 010 SAM scaffold so there is one active infrastructure path.

The current dev stack contains:

- the existing `apps/api` Lambda artifact;
- an API Gateway HTTP API with public `GET /health` and authenticated invoice route scaffolding;
- a 128 MB, five-second Node.js 22 Lambda;
- a DynamoDB invoice repository table named `unified-invoice-<environment>-invoices`;
- a Cognito User Pool, User Pool Client, and HTTP API JWT authorizer attached to invoice routes;
  and
- an explicit CloudWatch log group with 14-day retention.

It creates no VPC/NAT, custom domain, S3 bucket, budget, secret, real user, password, hosted UI
domain, or account-specific configuration. No deployment is performed by repository scripts.

## Local commands

```powershell
pnpm --filter @invoice/infra-cdk test
pnpm --filter @invoice/infra-cdk typecheck
pnpm --filter @invoice/infra-cdk lint
pnpm --filter @invoice/infra-cdk build
pnpm --filter @invoice/infra-cdk synth
```

The `synth` script builds `apps/api` first because the Lambda asset is `apps/api/dist` and the
handler is `index.apiHandler`. The default environment is `dev`; override it locally with
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

The JWT authorizer is attached to invoice routes and intentionally not attached to `/health`.
`/health` remains public. The Lambda receives non-secret `COGNITO_USER_POOL_ID` and
`COGNITO_USER_POOL_CLIENT_ID` environment variables for handler composition. CDK does not create
users, passwords, hosted UI domains, callback URLs, logout URLs, app S3 buckets, custom domains,
budgets, or secrets. Production should revisit MFA, account recovery, custom domains, auth UX, and
removal policy before real users are onboarded.

## Authenticated invoice route scaffold

Task 015 adds these JWT-protected HTTP API routes:

- `GET /invoices`
- `GET /invoices/{id}`
- `POST /invoices/drafts`
- `PUT /invoices/drafts/{id}`
- `POST /invoices/{id}/finalize`
- `POST /invoices/{id}/void`
- `DELETE /invoices/drafts/{id}`

`GET /invoices` and `GET /invoices/{id}` are wired to the DynamoDB repository adapter using the
owner ID resolved from JWT `sub`, with `username` used only as a fallback when `sub` is absent.
Mutation routes are protected but return stable `501 Not Implemented` JSON stubs until mutation
behavior is implemented in a later task. No web app integration, login flow, invoice-number
sequencing service, users, passwords, hosted UI/domain, VPC/NAT, app S3 bucket, custom domain,
budget, secret, or production deployment is included.

## Dev deployment

Task 012B deployed the health-only dev stack in `us-west-2` for masked account `9064****2082`.
Task 013B deployed the DynamoDB table/IAM wiring to the same dev stack. Task 014B deployed the
Cognito auth scaffold. The CDK bootstrap stack already existed and was not rerun.

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
`HealthApiUrl`, `HealthFunctionName`, `InvoicesTableName`, `UserPoolId`, and `UserPoolClientId`.
Verify the deployed endpoint with the `HealthApiUrl` stack output:

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

Task 014B verification confirmed the Cognito User Pool and User Pool Client outputs exist, the User
Pool exists with public self-registration disabled and MFA `OFF` for dev, no client secret was
returned for the User Pool Client, and the Lambda has non-secret `COGNITO_USER_POOL_ID` and
`COGNITO_USER_POOL_CLIENT_ID` environment variables. `/health` remained public and returned the
expected JSON response. No invoice routes, users, passwords, hosted UI domain, VPC/NAT, app S3
bucket, custom domain, budget, secret, or production resource was deployed.

Task 015B deployed the authenticated invoice route scaffold to the same dev stack in `us-west-2`
for masked account `9064****2082`. The deployment added the protected invoice HTTP API routes,
kept `/health` public, and adjusted the API Lambda bundle so runtime workspace and AWS SDK
dependencies are included in the Lambda artifact. Post-deploy verification confirmed `GET /health`
returned `{"ok":true,"service":"unified-invoice-api"}` and unauthenticated requests to
`GET /invoices`, `GET /invoices/{id}`, and `POST /invoices/drafts` returned `401 Unauthorized`.
No users, passwords, test invoice data, web integration, hosted UI/domain, VPC/NAT, app S3 bucket,
custom domain, budget, secret, production resource, or Task 016 work was created.
