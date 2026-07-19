# Dev Cleanup Utility

`@invoice/dev-cleanup` is a local/admin-only tool for inspecting and, after explicit confirmation,
deleting UnifiedInvoice dev verification records for one owner partition in the dev DynamoDB table.

It is not exposed through the public API, Lambda, or web app.

## Safety

- Only `--environment dev` is accepted.
- The table name must match the dev naming pattern.
- `--owner-id` is required.
- Dry-run is the default.
- Actual deletion requires `--confirm-delete`.
- If `--dry-run` and `--confirm-delete` are both supplied, dry-run wins.
- The tool uses DynamoDB `Query` by owner partition and never table-wide `Scan`.
- Production-looking table names are refused.

## Dry Run

```powershell
pnpm --filter @invoice/dev-cleanup start -- --environment dev --owner-id "<owner-id>" --dry-run
```

## Confirmed Delete

Run this only after review and explicit approval:

```powershell
pnpm --filter @invoice/dev-cleanup start -- --environment dev --owner-id "<owner-id>" --confirm-delete
```

## Owner ID Discovery

The owner ID is the trusted owner partition suffix used by the API repository. For the current
Cognito-backed dev stack, find it from Cognito user attributes or an ID token claim. A read-only
Cognito example:

```powershell
aws cognito-idp list-users `
  --user-pool-id "<UserPoolId>" `
  --region us-west-2 `
  --query "Users[].{Username:Username,Email:Attributes[?Name=='email']|[0].Value,Sub:Attributes[?Name=='sub']|[0].Value}"
```

Use the `Sub` value as `--owner-id`.
