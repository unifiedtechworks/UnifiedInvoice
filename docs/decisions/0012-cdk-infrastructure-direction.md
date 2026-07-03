# 0012: CDK Infrastructure Direction

## Status

Accepted and implemented as the local Task 012A infrastructure scaffold. No deployment was
performed.

## Context

Task 010 introduced a minimal AWS SAM scaffold for the unauthenticated health route. That was
enough for one Lambda and one HTTP API route, but the planned backend will grow to include API
Gateway, Lambda, DynamoDB, Cognito, IAM, S3, environments, and cost guardrails. Maintaining that
shape in TypeScript alongside the rest of the pnpm monorepo is preferable to growing a large YAML
template.

## Decision

Use AWS CDK in TypeScript as the active infrastructure direction. The active package is
`@invoice/infra-cdk` under `infra/cdk`, and the Task 010 SAM scaffold is removed as an active
deployment path.

The initial CDK stack intentionally remains health-only:

- packages the existing `apps/api/dist` Lambda artifact;
- uses the existing `index.healthHandler` export;
- creates a Node.js 22 Lambda with 128 MB memory and a five-second timeout;
- creates an API Gateway HTTP API route for `GET /health`;
- creates a CloudWatch log group with 14-day retention;
- tags resources with `Project=UnifiedInvoice`, `ManagedBy=CDK`, and the configured
  `Environment`;
- defaults the environment name to `dev` and allows a CDK context override; and
- remains account/region agnostic for local synthesis.

Synthesis is local and builds the API package first. Bootstrap, deployment, and production
configuration are deferred.

## Deferred

Task 012A does not add DynamoDB tables, Cognito, invoice API routes, custom domains, S3 deploy
buckets, budget resources, VPC/NAT, production stack configuration, real AWS account IDs, secrets,
or deployment automation. Invoice-number generation and API composition remain later concerns.

## Consequences

CDK infrastructure now follows the repository's TypeScript, pnpm, ESLint, Vitest, and typecheck
conventions. CDK dependencies are isolated to `infra/cdk`, and application/domain packages do not
depend on infrastructure code. The repository has one active infrastructure path, which avoids
keeping SAM and CDK as competing deployment options.
