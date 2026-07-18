# Task 022C: Invoice Void Snapshot Fix

## Status

Implemented locally; ready for review after verification. No deployment or commit was performed by
this task.

## Objective

Fix the Task 022B dev verification failure where `POST /invoices/{id}/void` returned
`409 invoice_conflict` after finalizing an invoice and using the current version returned by
`GET /invoices/{id}`.

## Root Cause

The DynamoDB repository compared serialized finalized snapshots with `JSON.stringify`. DynamoDB map
attributes do not provide a reliable object key order when read back, so the stored finalized
payload could be semantically identical to the voided invoice's finalized snapshot while producing
different JSON text. That made `saveVoided` report a finalized snapshot mismatch.

## Fix

`canonicalSerializedJson` now recursively sorts object keys before stringifying serialized invoice
payloads. Array order and primitive values are preserved. This keeps snapshot validation strict
without depending on DynamoDB map key order.

## Tests

Added DynamoDB adapter coverage for:

- `createDraft -> saveFinalized -> getById -> saveVoided` using the version returned by `getById`;
- simulated DynamoDB map key reordering on the stored finalized payload;
- successful void persistence, voided `getById`, finalized snapshot preservation, and invoice-number
  reservation preservation.

## Scope Boundaries

No domain validation was weakened. Voiding still requires the current expected version, keeps the
finalized snapshot and totals, preserves invoice-number reservations, does not release or reuse
invoice numbers, does not add routes, and does not deploy.

## Next Step

Retry Task 022B dev deployment verification after this fix is reviewed and deployed.

## Proposed commit message

```text
fix(api): correct invoice void persistence
```
