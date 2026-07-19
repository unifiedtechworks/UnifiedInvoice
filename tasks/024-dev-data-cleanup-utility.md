# Task 024: Dev DynamoDB Data Cleanup Utility

## Status

Implemented and verified locally. No deployment, live cleanup, direct live DynamoDB delete, or
commit was performed by this task.

## Objective

Add a local/admin-only cleanup utility for inspecting and optionally deleting dev verification
records from one owner partition in the UnifiedInvoice dev DynamoDB invoice table.

## Utility

Created `@invoice/dev-cleanup` under `tools/dev-cleanup`.

The tool:

- targets only `environment=dev`;
- requires one `--owner-id`;
- defaults to dry-run;
- requires `--confirm-delete` for deletion;
- refuses production-looking table names;
- queries only one owner partition;
- includes both invoice records and invoice-number reservation records;
- is not exposed through the public API, Lambda, scheduled job, or web app.

## Commands

Dry-run:

```powershell
pnpm --filter @invoice/dev-cleanup start -- --environment dev --owner-id "<owner-id>" --dry-run
```

Confirmed deletion for a future reviewed cleanup operation:

```powershell
pnpm --filter @invoice/dev-cleanup start -- --environment dev --owner-id "<owner-id>" --confirm-delete
```

Confirmed deletion was not run in this task.

## Owner ID Discovery

The cleanup tool requires `--owner-id`; it does not discover owners itself. For the current
Cognito-backed dev stack, the owner ID can be found from Cognito user attributes or an ID token
claim. A read-only Cognito query shape:

```powershell
aws cognito-idp list-users `
  --user-pool-id "<UserPoolId>" `
  --region us-west-2 `
  --query "Users[].{Username:Username,Email:Attributes[?Name=='email']|[0].Value,Sub:Attributes[?Name=='sub']|[0].Value}"
```

Use the returned `Sub` value as `--owner-id`.

## Safety Notes

The cleanup utility uses DynamoDB `Query`, not table-wide `Scan`, with key conditions scoped to:

```text
PK = OWNER#<ownerId>
SK begins_with INVOICE#
SK begins_with INVOICE_NUMBER#
```

The implementation batches deletes for discovered records only after `--confirm-delete`. Dry-run
prints counts and performs no delete calls. Passing both `--dry-run` and `--confirm-delete` keeps
dry-run mode.

## Tests

Added local tests with a fake command-level DynamoDB client. Tests do not call AWS and cover:

- dry-run default behavior;
- non-dev environment rejection;
- missing owner ID rejection;
- production-looking table name rejection;
- owner-partition `Query` usage;
- dry-run count without delete calls;
- confirmed deletion of invoice and reservation records;
- batched deletion for larger owner partitions;
- dry-run winning when both dry-run and confirm-delete are present.

## Verification

Local verification passed for the cleanup package, focused API/repository/infra tests, and the
standard repo checks. The lockfile change is limited to the new `tools/dev-cleanup` importer block.
Generated build output was removed after verification.

## Proposed commit message

```text
feat(tools): add dev invoice cleanup utility
```
