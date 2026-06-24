# Invoice Platform Development Reference

_Architecture, Engineering Principles, Repository Structure, and Flexible Delivery Roadmap_

## 1. Purpose

This document is the working architectural reference for the invoice-management platform. It is intentionally broader than any single implementation task. Its purpose is to keep future development consistent while allowing individual technologies, task boundaries, and delivery order to evolve as the codebase matures.

## 2. Product Vision

- A first-class Android application built with bare React Native.
- A first-class browser application built with React Native for Web.
- A future iOS application using the same shared domain and UI foundations.
- A low-cost, AWS-native backend that can begin at very small usage and scale without a full rewrite.
- A codebase whose financial rules, validation, and domain behavior are independent of any UI framework or cloud provider.

### Initial Scope

- Single owner or very small team at launch.
- Customer records.
- Configurable products and services.
- Draft, finalized, sent, paid, overdue, voided, and related invoice states.
- Invoice line-item calculations using deterministic fixed-point money handling.
- PDF generation and storage.
- Manual payment recording first.
- Email delivery after the core invoice workflow is stable.
- Android and web first; iOS and card payments later.

### Explicit Non-Goals

- Full accounting or bookkeeping replacement.
- General ledger, payroll, bank reconciliation, or tax filing.
- Complex offline multi-device conflict resolution in the first release.
- Card processing implemented directly by this system.
- Premature multi-region infrastructure or enterprise-scale operational complexity.

## 3. Architecture Decisions

| Area                   | Choice                                        | Reason                                                                           |
| ---------------------- | --------------------------------------------- | -------------------------------------------------------------------------------- |
| Mobile client          | Bare React Native with TypeScript             | Native Android first; iOS later without Expo.                                    |
| Web client             | React Native for Web + React DOM + Vite       | Shares domain logic and most UI while allowing web-specific layouts.             |
| Repository             | TypeScript monorepo using pnpm workspaces     | Keeps shared packages versioned and tested together.                             |
| Infrastructure as code | AWS CDK in TypeScript                         | Repeatable, reviewable, source-controlled AWS deployment.                        |
| API                    | API Gateway HTTP API + AWS Lambda             | Low idle cost and automatic horizontal scaling.                                  |
| Primary database       | Amazon DynamoDB                               | On-demand pricing and serverless scaling; model around explicit access patterns. |
| Authentication         | Amazon Cognito                                | Managed identity, password reset, verification, and token issuance.              |
| Files                  | Amazon S3                                     | Stores invoice PDFs, logos, and future attachments.                              |
| Async jobs             | Amazon SQS                                    | Decouples PDF generation and email sending from interactive requests.            |
| PDF generation         | Lambda container or compatible Lambda runtime | Produces one canonical server-generated invoice document.                        |
| Email                  | Amazon SES                                    | Low-cost transactional delivery without operating a mail server.                 |
| Web delivery           | S3 + CloudFront                               | Low-cost static hosting and global caching.                                      |
| DNS and TLS            | Route 53 + ACM                                | Managed DNS and certificates.                                                    |
| Observability          | CloudWatch                                    | Logs, metrics, alarms, and cost visibility.                                      |

## 4. Engineering Principles

### Domain logic is platform independent

Invoice rules, calculations, validation, status transitions, and identifiers must live in shared packages with no dependency on React Native, browser APIs, or AWS SDKs.

### The server is authoritative

Clients may calculate totals for immediate feedback, but the backend must independently validate inputs and recalculate all financial totals before finalization.

### Money is never floating point

Store monetary amounts as integer minor units, such as cents. Fractional quantities should use fixed-point integers or a decimal type with explicit rounding rules.

### Finalized invoices are immutable records

A finalized invoice preserves customer, item, price, tax, address, and business snapshots. Corrections should use voiding, replacement, or credit workflows rather than silent mutation.

### Access patterns drive DynamoDB design

Every query needed by the product should be documented before a table or index is added. Normal application paths must not rely on full-table scans.

### Optimize where it matters

Prefer bounded queries, pagination, memoized row rendering, virtualized lists, and constant-time entity lookup. Do not add complexity merely to change an operation over a small invoice from O(n) to O(log n).

### Async work stays out of request paths

PDF rendering, email delivery, and other slow or failure-prone operations should be queued through SQS where practical.

### Shared does not mean forced sameness

Use shared components when they improve consistency, but allow .web.tsx, .android.tsx, .ios.tsx, or .native.tsx implementations where platform behavior genuinely differs.

### Security is designed in

Use least-privilege IAM, authenticated API routes, tenant-scoped authorization, secure token storage, input validation, rate limiting, and audit-friendly event records.

### Infrastructure is reproducible

AWS resources should be created through CDK rather than undocumented console-only configuration.

### Costs are observable and bounded

Use budgets, alarms, log retention policies, DynamoDB on-demand capacity, and explicit concurrency or throttling controls.

### Tasks stay narrow and verifiable

Each implementation unit should have named files, acceptance criteria, non-goals, verification commands, and a recorded completion summary.

## 5. Proposed Repository Structure

```text
invoice-platform/
├── apps/
│   ├── mobile/
│   │   ├── android/
│   │   ├── ios/
│   │   └── src/
│   └── web/
│       └── src/
├── packages/
│   ├── domain/
│   ├── invoice-engine/
│   ├── validation/
│   ├── api-client/
│   ├── ui/
│   └── config/
├── services/
│   ├── api/
│   ├── pdf-worker/
│   └── email-worker/
├── infrastructure/
│   └── cdk/
├── docs/
├── tasks/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── README.md
```

### Package Responsibilities

| Package or Area           | Responsibility                                                                                             |
| ------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `packages/domain`         | Entities, branded identifiers, enums, status transitions, and domain contracts.                            |
| `packages/invoice-engine` | Pure deterministic subtotal, discount, tax, payment, and balance calculations.                             |
| `packages/validation`     | Shared schemas and validation rules for client and server boundaries.                                      |
| `packages/api-client`     | Typed client requests, response contracts, authentication integration, and errors.                         |
| `packages/ui`             | Reusable cross-platform presentation components with platform-specific variants where needed.              |
| `packages/config`         | Shared lint, TypeScript, test, and build configuration.                                                    |
| `services/api`            | Lambda handlers and application use cases; coordinates validation, authorization, persistence, and events. |
| `services/pdf-worker`     | Consumes queued jobs, renders canonical PDFs, and saves immutable documents to S3.                         |
| `services/email-worker`   | Consumes queued jobs and sends invoice-related email through SES.                                          |
| `infrastructure/cdk`      | AWS stacks, constructs, IAM policies, alarms, deployment configuration, and outputs.                       |

## 6. Development Order

### Phase 0 - Product and architecture baseline

- Record product requirements, initial scope, non-goals, architecture decisions, security assumptions, and data ownership.
- Create task and decision-log conventions before implementation grows.

### Phase 1 - Local repository foundation

- Create the monorepo, bare React Native Android shell, React Native for Web shell, shared package imports, strict TypeScript, linting, formatting, and tests.
- No AWS deployment is required for this phase.

### Phase 2 - Shared domain and invoice engine

- Define identifiers, money and quantity representations, customer and catalog entities, invoice states, and pure invoice calculations.
- Build exhaustive unit tests before adding persistence or UI complexity.

### Phase 3 - Local application workflow

- Build navigation, customer management, catalog management, and an invoice editor using local or mocked persistence.
- Demonstrate the complete draft-to-preview workflow without depending on AWS.

### Phase 4 - AWS foundation

- Bootstrap CDK environments and add account, region, naming, tagging, logging, and budget conventions.
- Deploy minimal development infrastructure only after local workflows are stable.

### Phase 5 - Identity, API, and persistence

- Add Cognito, API Gateway, Lambda handlers, DynamoDB entities and indexes, authorization, and the typed API client.
- Migrate the local workflow to server-authoritative persistence.

### Phase 6 - Documents and delivery

- Add SQS-backed PDF generation, S3 document storage, secure retrieval, SES sending, and delivery/event tracking.

### Phase 7 - Hardening and release

- Add monitoring, alarms, backup/export procedures, rate limits, idempotency, accessibility review, Android release signing, and production deployment.

### Phase 8 - Later capabilities

- Add iOS, payment-provider integration, recurring invoices, estimates, reminders, partial refunds or credits, richer reporting, and carefully scoped offline synchronization.

## 7. Flexible Task Roadmap

This roadmap is intentionally fuzzy. Task numbers and boundaries may change as implementation reveals new constraints, but the dependency order should remain broadly stable.

| ID     | Task                                 | Intended Outcome                                                                                     |
| ------ | ------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| 001    | Repository foundation                | Monorepo, bare Android shell, web shell, shared imports, strict tooling.                             |
| 002    | Architecture documentation baseline  | Product requirements, ADR format, security model, data ownership, glossary.                          |
| 003    | Domain identifiers and core types    | Branded IDs, timestamps, currency codes, statuses, shared errors.                                    |
| 004    | Money and quantity primitives        | Minor-unit money, fixed-point quantities, rounding and formatting rules.                             |
| 005    | Invoice calculation engine           | Subtotal, discounts, taxes, payments, balances, and deterministic totals.                            |
| 006    | Calculation engine test suite        | Boundary cases, fractional quantities, discounts, taxes, negative-input rejection.                   |
| 007    | Customer and catalog domain models   | Validation, snapshots, archive behavior, and update rules.                                           |
| 008    | Mobile application shell             | Navigation, screen layout, error boundaries, loading states, theme foundation.                       |
| 009    | Responsive web application shell     | Desktop navigation, responsive layout, keyboard and browser behavior.                                |
| 010    | Shared form controls                 | Text, currency, quantity, date, picker, validation, and accessibility behavior.                      |
| 011    | Local customer management            | Create, edit, archive, search, and select customers using local storage or mocks.                    |
| 012    | Local catalog management             | Create, edit, archive, search, default pricing, units, and taxability.                               |
| 013    | Local invoice editor                 | Line-item editing, item lookup, custom lines, totals, notes, dates, and draft state.                 |
| 014    | Invoice lifecycle rules              | Draft, finalized, sent, paid, overdue, voided, replacement, and permissions.                         |
| 015    | Invoice preview                      | Cross-platform preview using a stable invoice view model.                                            |
| 016    | CDK project foundation               | Environment config, stack boundaries, tags, outputs, budgets, and alarms.                            |
| 017    | Cognito authentication               | User pool, app clients, login, logout, refresh, password reset, secure storage.                      |
| 018    | DynamoDB access-pattern design       | Keys, GSIs, tenant boundaries, pagination, conditional writes, migrations.                           |
| 019    | API contract and Lambda foundation   | Typed routes, validation, authorization, errors, tracing, and idempotency.                           |
| 020    | Customer persistence integration     | CRUD, search access patterns, optimistic UI, and authorization tests.                                |
| 021    | Catalog persistence integration      | CRUD, archive behavior, caching, and authorization tests.                                            |
| 022    | Invoice persistence integration      | Draft saves, version checks, finalization transaction, snapshots, immutable state.                   |
| 023    | S3 document storage                  | Private buckets, object naming, retention, encryption, and signed retrieval.                         |
| 024    | PDF worker                           | SQS job, canonical HTML/template, fonts, rendering, retries, and metadata.                           |
| 025    | Email worker                         | SES templates, attachments or links, retries, bounce handling, and event records.                    |
| 026    | Dashboard and reporting queries      | Outstanding, overdue, paid totals, recent invoices, and bounded time windows.                        |
| 027    | Audit and activity history           | Invoice events, user actions, delivery events, and operational traceability.                         |
| 028    | Security hardening                   | Least privilege, rate limits, dependency review, secret handling, and threat review.                 |
| 029    | Observability and cost controls      | Dashboards, alarms, log retention, budgets, throttles, and failure queues.                           |
| 030    | Android production release           | Signing, build variants, secure configuration, release testing, and distribution.                    |
| 031    | Production deployment and operations | Environments, rollback, data export, runbooks, and disaster recovery checks.                         |
| Future | Deferred feature set                 | iOS, card payments, recurring invoices, estimates, reminders, credits, richer reports, offline sync. |

## 8. Task Execution Standard

Each task should contain:

- Objective
- Scope
- Files permitted to change
- Requirements
- Non-goals
- Acceptance criteria
- Verification commands
- Expected output
- Completion summary and unresolved risks

Recommended agent workflow:

1. Inspect the repository and current environment.
2. Propose the implementation plan and exact file list.
3. Identify compatibility, migration, security, and cost risks.
4. Obtain approval when the task explicitly requires a planning stop.
5. Implement only the approved task.
6. Run type checks, linting, tests, builds, and platform-specific verification.
7. Review the diff and update the task record.

## 9. Suggested Project Rules

- Use TypeScript strict mode.
- Do not use Expo or Capacitor.
- Do not introduce Firebase, Supabase, Auth0, Vercel, Netlify, or other hosted platforms without explicit approval.
- Android is the immediate native priority; web remains a first-class target.
- Keep business logic outside React components and cloud handlers.
- Never use JavaScript floating-point arithmetic for currency.
- The server must independently recalculate financial totals.
- Document every DynamoDB access pattern and avoid unbounded scans.
- Do not modify unrelated files.
- Do not suppress TypeScript, lint, or test failures.
- Avoid any; document the reason when it is truly unavoidable.
- Add or update tests for every business-rule change.
- Run all relevant verification commands before completing a task.
- Update the corresponding task record and summarize unresolved risks.

## 10. Architectural Guardrails

- Prefer reversible decisions in early phases.
- Keep AWS-specific code behind service and repository boundaries.
- Treat invoice documents and financial snapshots as records, not mutable views.
- Add indexes only for documented access patterns.
- Use pagination and explicit limits on all list endpoints.
- Use conditional writes or version checks to prevent lost updates.
- Use idempotency keys for invoice finalization, queued jobs, and future payment events.
- Keep development, staging, and production configuration separate.
- Never place secrets in source control or mobile bundles.
- Prefer small, independently testable modules over large framework-coupled abstractions.

## 11. Definition of the First Meaningful Milestone

The first meaningful milestone is complete when the bare Android app and web app both launch, both consume a shared TypeScript invoice engine, and a tested local workflow can create a customer, select configurable catalog items, calculate a draft invoice, and display a stable preview without requiring AWS.

## 12. Decision Review Triggers

- DynamoDB reporting requirements become substantially more relational or ad hoc than anticipated.
- PDF generation cannot meet reliability, startup-time, or package-size requirements in Lambda.
- React Native for Web creates unacceptable desktop usability or accessibility compromises.
- Offline use becomes a hard requirement rather than a convenience.
- The product expands from a private tool into a multi-tenant commercial service.
- Operational cost or AWS service count becomes harder to manage than a small conventional server.
