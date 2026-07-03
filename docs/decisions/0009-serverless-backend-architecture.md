# 0009: Serverless Backend Architecture and Cost Guardrails

## Status

Accepted as the Task 009 implementation plan. No backend code or AWS resources are implemented.

## Context

The repository already separates deterministic domain and invoice logic, canonical serialization,
storage-neutral repository ports, and a complete in-memory adapter. The first production deployment
will likely have one user, so idle cost and operational simplicity are primary constraints.

Known recurring AWS spend is about $1.50/month for three Route 53 hosted zones, annual domain
renewals, and negligible Amplify/S3 use. The former roughly $32/month EBS gp3 cost is gone; recent
checks found no EBS volumes or snapshots in `us-west-2`. The incremental backend target is
$0-$5/month, with an alert at $10 and immediate investigation at $20 or more.

## Backend shape and package ownership

Use this request-priced architecture:

```text
apps/web / apps/mobile
          |
API Gateway HTTP API + Cognito JWT authorizer
          |
apps/api (Lambda handlers and application orchestration)
          |
@invoice/invoice-repository-dynamodb
          |
DynamoDB
```

Create:

- `infra/` for AWS SAM templates, environment parameters, outputs, budgets, and deployment docs.
- `apps/api` for Lambda entry points, HTTP mapping, authentication context, domain orchestration,
  and adapter composition.
- `packages/invoice-repository-dynamodb` for the AWS-specific implementation of the existing
  `InvoiceRepository` port and physical record/key mapping.
- Extend `packages/api-client` only when client integration begins; it owns client transport, not
  backend implementation.

Do not initially create generic `packages/auth` or `packages/backend-contracts` packages. Keep
Cognito claim handling and HTTP DTOs in `apps/api` until multiple consumers justify extraction.

Dependency direction remains:

```text
apps/api -> invoice-domain, invoice-repository, invoice-repository-dynamodb
invoice-repository-dynamodb -> domain, invoice-domain, invoice-repository
```

Domain, calculation, lifecycle, and repository-contract packages remain independent of AWS, HTTP,
React, browser, and native APIs. The memory adapter remains for tests, development, and local
non-durable use. Add private S3 later only for generated PDFs/exports. Do not add EC2, RDS, NAT
Gateway, Lambda VPC attachment, ECS/Fargate, OpenSearch, always-on containers, or unnecessary paid
third-party services.

## Deployment approach

Use AWS SAM. It is AWS-native, produces repeatable CloudFormation, supports a straightforward CLI
workflow, and adds less framework machinery than a broader platform. Explicitly test pnpm workspace
Lambda bundling in CI.

AWS CDK is capable and TypeScript-friendly, but its construct dependencies and bootstrap lifecycle
are unnecessary for the first small stack. SST and Serverless Framework add a third-party release
surface; Amplify Gen 2 couples backend ownership more closely to the frontend; manual console setup
is not reproducible.

Use separate allow-listed `dev` and `prod` stacks/resources named like
`unified-invoice-<environment>-<resource>`. Deploy dev first and avoid persistent preview stacks.

## API boundary

Initial authenticated routes:

```text
GET    /invoices
GET    /invoices/{id}
POST   /invoices/drafts
PUT    /invoices/drafts/{id}
POST   /invoices/{id}/finalize
POST   /invoices/{id}/void
DELETE /invoices/drafts/{id}
```

- List returns repository metadata and an opaque cursor. Initially guarantee `updatedAt desc` and
  reject sort modes that cannot be paginated correctly.
- Get returns the canonical serialized invoice and opaque record version.
- Update, finalize, void, and discard require the caller's expected version.
- Map validation to HTTP 400, authentication/authorization to 401/403, missing records to 404,
  conflicts to 409, and unexpected failures to a non-revealing 500. Mapping belongs in `apps/api`.

### Server-side lifecycle operations

Finalization and voiding happen server-side. The handler loads the current aggregate and version,
invokes existing `finalizeInvoice` or `voidInvoice`, then persists through `saveFinalized` or
`saveVoided`. Clients never submit an authoritative finalized or voided snapshot. Production
lifecycle timestamps are server-authored.

Initially accept an explicit requested invoice number because sequencing policy is not defined.
Enforce uniqueness atomically in persistence and defer automatic sequential allocation to a
dedicated policy task. This keeps deterministic calculation, immutable snapshots, concurrency, and
number uniqueness authoritative on the server while reusing framework-independent domain logic.

## DynamoDB persistence design

### Table and keys

Use one table per environment, such as `unified-invoice-dev-invoices`, in DynamoDB on-demand
(`PAY_PER_REQUEST`) mode. Reconsider provisioned capacity only after measured sustained use.
Enable production point-in-time recovery and deletion protection after restore testing, and retain
the production table on stack deletion.

```text
Invoice item:
  PK = OWNER#<ownerId>
  SK = INVOICE#<invoiceId>

Invoice-number reservation:
  PK = OWNER#<ownerId>
  SK = INVOICE_NUMBER#<canonicalInvoiceNumber>
```

Derive `ownerId` only from trusted Cognito claims and scope each repository instance to it. Never
accept ownership from request data. Keep ownership, DynamoDB keys, and Cognito fields outside
`StoredInvoiceRecord` and domain aggregates so a future account/tenant resolver can replace the
initial Cognito-subject owner.

### Stored shape and concurrency

Invoice items wrap the existing storage-neutral record fields and canonical `SerializedInvoice`.
They also contain:

```text
GSI1PK = OWNER#<ownerId>
GSI1SK = UPDATED#<updatedAt>#<invoiceId>
```

Use the existing JSON-safe serializers, never convert monetary integer strings to floating point,
and validate stored payloads through invoice-domain parsers before returning runtime aggregates.

Generate a new opaque adapter version, such as a UUID, for each successful mutation. It has no
numeric meaning, and `updatedAt` is not a concurrency token. Create uses `attribute_not_exists`;
update, finalize, void, and discard use condition expressions matching the expected version.
Conditional failures map to storage-neutral repository errors without exposing DynamoDB details.

### Invoice-number uniqueness

Finalization uses `TransactWriteItems` to update the invoice and conditionally create the
owner-scoped number reservation atomically. Permit only a verified same-invoice idempotent retry.
Voiding keeps the reservation, and draft deletion never touches one. Canonicalization must match
`InvoiceNumber` without locale-sensitive transformations.

### List/query strategy

Create only GSI1 initially. Query it in descending order for the default list and encode its
evaluated key in an opaque cursor. Apply lifecycle filters with bounded continued reads when needed
to fill a page. For the small initial dataset, invoice-number/customer-name search may be
post-filtered with a documented read ceiling.

Defer other GSIs. API sorts that cannot provide globally correct pagination remain disabled until a
real UI query and measured volume justify an index. Full-text search and OpenSearch are out of scope.

## Authentication design

Use a Cognito User Pool and API Gateway HTTP API JWT authorizer on every invoice route.

- Disable public self-registration.
- Bootstrap one administrator through an audited CLI/console procedure.
- Require a strong password policy and production MFA.
- Use short-lived access tokens, not ID tokens, for API authorization.
- Validate issuer/audience and derive owner identity only from trusted request-context claims.
- Do not use API keys as authentication, public writes, or browser-shipped IAM credentials.

Hardcoded authentication is acceptable only in non-deployable local tests. IAM-only end-user auth
would complicate browser/mobile credential delivery. Future shared accounts require an explicit
membership model.

## Cost guardrails

- Create an AWS Budget at $10/month with actual and forecast notifications.
- Create a second actual-cost alert at $20/month and investigate any $20+ month immediately.
- Separate existing Route 53 and annual-domain costs from the backend's $0-$5 incremental target.
- Use DynamoDB on-demand, API throttles, short Lambda timeouts, modest measured memory, and a small
  reserved-concurrency cap (start around five and tune from observed use).
- Set CloudWatch log retention to 14 days. Avoid invoice/PII/token logging, paid custom metrics,
  high-cardinality dimensions, production debug logs, and X-Ray until justified.
- Use no VPC/NAT or other forbidden always-on resources and no persistent per-branch stacks.
- Tag supported resources with `Project=UnifiedInvoice`, `Environment=dev|prod`, `ManagedBy=SAM`,
  and an account-appropriate owner/cost-center tag.
- Never share a DynamoDB table or Cognito User Pool between environments.
- If S3 is added, keep it private, block public access, encrypt it, apply lifecycle rules, and issue
  short-lived access only after authorization.

## Security basics

Authenticate every invoice route and scope every persistence operation to the trusted owner without
revealing another owner's record existence. Use least-privilege Lambda roles scoped to the
environment table/index and separate deployment/runtime roles. Validate path, query, content type,
body size, body shape, expected version, and invoice serialization. Restrict production CORS to the
deployed frontend origin; CORS is not authorization.

Never commit credentials, tokens, `.env` secrets, or generated deployment artifacts. Use AWS-
managed DynamoDB encryption initially. Keep future S3 private. Do not log invoice payloads,
addresses, emails, authorization headers, tokens, or secrets.

## Tasks 010-014

- **010 — SAM/backend scaffold:** add `infra/`, `apps/api`, workspace wiring, SAM defaults,
  API/Lambda skeleton, logs, tags, outputs, and docs; add no unauthenticated invoice routes
  and deploy nothing automatically.
- **011 — DynamoDB adapter:** implement and contract-test owner-scoped repository behavior,
  canonical validation, concurrency, GSI listing, lifecycle transactions, and number reservations.
- **012 — Cognito/authorization:** add User Pool/client/JWT authorizer, disabled registration,
  bootstrap docs, owner derivation, CORS, least privilege, and auth/isolation tests.
- **013 — HTTP handlers:** implement the seven routes, request validation, error/cursor mapping,
  server-side lifecycle operations, and handler/integration tests.
- **014 — API client/web:** implement typed `api-client` operations, Cognito session handling, and
  web invoice flows while preserving the boundary for later mobile use.

## Deferred

Automatic invoice-number sequencing, shared accounts/roles, additional GSIs/search, PDF/S3, email,
payments, reporting, audit streams, offline/mobile integration, multi-region, WAF, custom domains,
customer-managed keys, and provisioned capacity are deferred.

## Consequences

The backend can remain near-zero at idle and preserves existing layering. Authentication,
ownership, optimistic concurrency, and invoice-number uniqueness are explicit before production
writes. Listing remains intentionally narrow until measured use justifies additional indexes.
