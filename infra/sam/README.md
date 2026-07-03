# AWS SAM scaffold

This directory defines a low-cost, health-only AWS SAM stack:

- one API Gateway HTTP API;
- one 128 MB, five-second Node.js 22 Lambda on `x86_64`;
- `GET /health` only; and
- a CloudWatch log group with 14-day retention.

`x86_64` is chosen for the simplest local Docker/SAM compatibility. At this traffic level the cost
difference from Arm is immaterial; revisit architecture only with measurements.

## Local validation

```powershell
pnpm api:build
sam validate --template-file infra/sam/template.yaml
sam local start-api --template-file infra/sam/template.yaml
```

The template expects `apps/api/dist/index.mjs`; run the API build first. Copy
`samconfig.example.toml` to an untracked personal config only when deployment work is authorized,
then replace placeholders. `resolve_s3 = true` asks SAM to manage deployment artifact storage; the
example contains no account ID, secret, or personal bucket.

Do not deploy this scaffold as a production invoice API. Cognito, authorization, DynamoDB,
repository behavior, invoice routes, S3, VPC/NAT, deployment automation, and the ADR 0009 AWS
Budget notification resources are deferred to later tasks. The $10 and $20 budget alerts remain
required before production. Only `/health` is public and it returns no invoice or user data.
