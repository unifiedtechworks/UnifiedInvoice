# 0012: CDK Infrastructure Direction

## Status

Accepted and implemented as the local Task 012A infrastructure scaffold, deployed to dev in Task
012B, extended with the Task 013 dev DynamoDB table/IAM wiring, extended with the Task 014 Cognito
auth scaffold, and extended locally in Task 015 with authenticated invoice route wiring pending CDK
diff review and explicit deploy approval.

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

The active CDK stack keeps the health endpoint public and adds the first protected invoice API
surface:

- packages the existing `apps/api/dist` Lambda artifact;
- uses the `index.apiHandler` export so the same Lambda can route health and invoice API requests;
- creates a Node.js 22 Lambda with 128 MB memory and a five-second timeout;
- creates an API Gateway HTTP API route for `GET /health`;
- creates authenticated invoice routes for list/get and future mutation operations;
- creates a CloudWatch log group with 14-day retention;
- creates the environment-scoped DynamoDB invoice table used by the API repository composition;
- creates the environment-scoped Cognito User Pool and User Pool Client used by the invoice route
  JWT authorizer;
- attaches the HTTP API JWT authorizer to invoice routes without attaching it to `/health`;
- passes non-secret table/auth resource identifiers to the Lambda;
- grants only the table-scoped DynamoDB actions required by the repository adapter;
- tags resources with `Project=UnifiedInvoice`, `ManagedBy=CDK`, and the configured
  `Environment`;
- defaults the environment name to `dev` and allows a CDK context override; and
- remains account/region agnostic for local synthesis.

Synthesis is local and builds the API package first. Deployment is explicit and production
configuration is deferred.

## Deferred

Task 015 adds local authenticated invoice route scaffolding and read-only repository-backed
handlers, but deployment still requires a reviewed CDK diff and explicit approval. User
creation/passwords, hosted UI domains, custom domains, S3 deploy buckets, budget resources,
VPC/NAT, production stack configuration, real AWS account IDs, secrets, deployment automation,
invoice-number generation, mutation behavior, and web integration remain later concerns.

## Consequences

CDK infrastructure now follows the repository's TypeScript, pnpm, ESLint, Vitest, and typecheck
conventions. CDK dependencies are isolated to `infra/cdk`, and application/domain packages do not
depend on infrastructure code. The repository has one active infrastructure path, which avoids
keeping SAM and CDK as competing deployment options.
