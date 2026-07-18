# Task 022D: DynamoDB Void Persistence Fix

## Status

Implemented locally; ready for review after verification. No deployment or commit was performed by
this task.

## Objective

Fix the Task 022B retry verification failure where deployed `POST /invoices/{id}/void` returned
`503 repository_unavailable` after draft creation, finalization, and a current-version
`GET /invoices/{id}` read had succeeded.

## Root Cause

`saveVoided` validated the finalized invoice and invoice-number reservation, then attempted to write
the voided invoice through a two-item DynamoDB transaction containing:

- a condition check against the invoice-number reservation item;
- a conditional put for the invoice record.

The reservation item is not changed during voiding. In the live dev stack this transaction failed
and surfaced as `repository_unavailable`, blocking void persistence even though the route had the
current invoice version and the reservation remained valid.

## Fix

`saveVoided` now keeps the existing consistent reservation read and validation before the write, then
persists the voided invoice with a single conditional invoice `PutCommand`. The condition still
requires the stored invoice record to match the caller's `expectedVersion` and to still be
`finalized`.

The fix does not release, rewrite, or delete invoice-number reservation records. The reservation
item remains reserved for the original invoice number after voiding.

## Behavior Preserved

- Voiding requires the current expected version.
- Only finalized invoices can be voided.
- Draft invoices still return conflict.
- Already-voided invoices keep the documented idempotent same-payload behavior and conflict on
  differing void payloads.
- Finalized snapshots and totals are preserved; no totals are recalculated or modified.
- Invoice numbers are not released or reused after void.

## Tests

Updated DynamoDB adapter coverage for:

- `createDraft -> saveFinalized -> getById -> saveVoided` using the version returned by `getById`;
- reservation preservation when a finalized invoice is voided;
- duplicate invoice number finalization still returning conflict after the original invoice is
  voided;
- stale-version and draft void conflict behavior;
- already-voided same-payload idempotency and differing-payload conflict behavior;
- unknown DynamoDB `PutCommand` failures during void mapping to `repository_unavailable` without
  changing the invoice or reservation item.

## Scope Boundaries

No deploy was performed in this task. No direct DynamoDB writes or deletes were run. No Cognito
users, routes, domain behavior, production resources, custom domains, VPC/NAT, S3 app buckets,
budgets, secrets, or Task 023 behavior were added.

## Next Step

After review and commit, rerun Task 022B dev deployment verification so the fixed Lambda asset can
be deployed and invoice voiding can be verified end to end in dev.

## Proposed commit message

```text
fix(api): persist voided invoices without reservation transaction
```
