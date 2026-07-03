# AWS CDK infrastructure scaffold

`@invoice/infra-cdk` is the active infrastructure-as-code package for Unified Invoice. Task 012A
superseded and removed the Task 010 SAM scaffold so there is one active infrastructure path.

The current stack contains only:

- the existing `apps/api` Lambda artifact;
- an API Gateway HTTP API with `GET /health`;
- a 128 MB, five-second Node.js 22 Lambda; and
- an explicit CloudWatch log group with 14-day retention.

It creates no DynamoDB table, Cognito User Pool, VPC/NAT, custom domain, S3 bucket, budget, invoice
route, secret, or account-specific configuration. No deployment is performed by repository
scripts.

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
