# Task 021: Finalizable Draft Fields API

## Status

Implemented locally; ready for review after verification. No deployment or commit was performed by
this task.

## Objective

Extend authenticated draft create/update behavior so clients can prepare drafts that satisfy
invoice finalization preconditions through the API.

## Request body additions

`POST /invoices/drafts` and `PUT /invoices/drafts/{id}` now support the minimal additional draft
fields needed for finalization:

```json
{
  "draft": {
    "business": {
      "displayName": "Unified Techworks"
    },
    "lines": [
      {
        "description": "Service description",
        "quantity": "1",
        "unitPrice": "100.00"
      }
    ]
  }
}
```

The existing `customer`, `issueDate`, `dueDate`, and `notes` fields remain supported.

## Behavior implemented

- Business and customer inputs support only the minimal safe `displayName` subset.
- Line items support `description`, `quantity`, and `unitPrice`.
- API-generated line item IDs are validated through the domain identifier helper.
- Quantity is parsed from a decimal string through `parseQuantity`.
- Unit price is parsed from a decimal string through `parseMoneyFromDecimal` using the draft USD
  currency definition.
- Draft creation applies provided lines through `addDraftInvoiceLine` before persistence.
- Draft update replaces the entire line list when `draft.lines` is provided.
- Omitting `draft.lines` during update preserves existing lines.
- Providing `draft.lines: []` removes all existing lines.

## Scope boundaries

The API still does not accept invoice numbers, finalized totals, payments, or trusted owner IDs in
draft create/update bodies. Owner scope still comes only from JWT claims. The API does not compute
totals during draft create/update; finalization continues to calculate totals through
invoice-domain and invoice-engine behavior.

No new routes, invoice-number generation/sequencing, payment behavior, PDF/email/export behavior,
web integration, login UI, hosted UI/domain, production deployment, custom domain, VPC/NAT, app S3
bucket, budget, secret, deploy, commit, or Task 022 work is included.

## Verification

Final verification results are recorded in the Task 021 completion response.

## Proposed commit message

```text
feat(api): support finalizable draft fields
```
