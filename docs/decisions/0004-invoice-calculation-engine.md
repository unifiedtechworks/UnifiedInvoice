# 0004: Invoice Calculation Engine

## Status

Accepted for Task 004.

## Context

The platform needs a deterministic, platform-independent invoice calculation engine for line totals, discounts, exclusive taxes, applied payments, and balances. The engine uses the Task 002 and Task 003 domain primitives and remains independent of UI frameworks, browser/native APIs, AWS, databases, HTTP frameworks, PDF libraries, and persistence concerns.

Task 004 implements pure calculation only. It does not implement invoice lifecycle transitions, customer/catalog entities, persistence, APIs, PDF generation, payment processing, refunds, currency conversion, exchange rates, or jurisdiction-specific tax compliance.

## Decisions

### Rate representation

Generic reusable rates live in `packages/domain` and use parts-per-million integer units:

```text
RATE_SCALE = 1_000_000n
0 units = 0%
82_500 units = 8.25%
1_000_000 units = 100%
10_000_000 units = 1000%
```

The generic domain `Rate` bound is 0% through 1000%, represented by `MIN_RATE_UNITS = 0n` and `MAX_RATE_UNITS = 10_000_000n`. Invoice calculation applies narrower context rules: line discount rates, invoice discount rates, and line tax rates must be 0% through 100%.

Machine percentage parsing accepts canonical percent strings with up to four decimal places and no percent sign. It rejects whitespace, leading plus signs, negatives, scientific notation, grouping separators, bare decimal forms, trailing decimal points, noncanonical leading zeroes, excessive precision, and out-of-range values.

Rates serialize as:

```ts
type SerializedRate = Readonly<{
  units: string;
  scale: 1_000_000;
}>;
```

`parseSerializedRate` accepts `unknown`, validates exact shape, and rejects extra properties. The reusable `applyRateToMoney` helper uses BigInt-only arithmetic, existing rounding behavior, supports positive and negative `Money`, and returns overflow through the existing `numeric_overflow` error.

### Calculation order

The invoice engine calculates in this order:

1. Runtime-validate input shape, currency definition, rounding mode, tax strategy, line array, line identifiers, positions, and payment array.
2. Copy and sort lines by `position`, then line ID, without mutating caller arrays.
3. Validate line quantity, unit price, discounts, and tax rate context bounds.
4. Calculate gross line amounts from `unitPrice * quantity`.
5. Calculate and validate line discounts.
6. Sum gross totals, line discount totals, and net line subtotal.
7. Calculate and validate invoice-level discount.
8. Allocate invoice discount proportionally to line net amounts.
9. Calculate taxable bases and tax amounts using the selected tax strategy.
10. Calculate line totals, invoice totals, payments, settlement totals, and metadata.

### Line calculation semantics

Calculated lines use the approved public shape with `grossAmount`, `lineDiscountAmount`, `netAmountBeforeInvoiceDiscount`, `invoiceDiscountAllocation`, `netAmountAfterInvoiceDiscount`, `taxableBase`, `taxAmount`, and `totalAmount`.

```text
netAmountAfterInvoiceDiscount = netAmountBeforeInvoiceDiscount - invoiceDiscountAllocation
```

For taxed lines, `taxableBase = netAmountAfterInvoiceDiscount`. For untaxed lines, `taxableBase` and `taxAmount` are zero Money. For every line:

```text
totalAmount = netAmountAfterInvoiceDiscount + taxAmount
```

Untaxed lines still contribute their full discounted charge to `discountedSubtotal` and `grandTotal`.

### Totals semantics

Task 004 avoids ambiguous subtotal names. Totals are:

```text
grossLineTotal = sum of gross line amounts
lineDiscountTotal = sum of line-level discounts
netLineSubtotal = grossLineTotal - lineDiscountTotal
invoiceDiscountTotal = invoice-level fixed or percentage discount
discountedSubtotal = netLineSubtotal - invoiceDiscountTotal
taxableBaseTotal = sum of taxableBase for taxed lines only
taxTotal = sum of exclusive tax amounts
grandTotal = discountedSubtotal + taxTotal
```

`grandTotal` is not derived from taxable bases because untaxed lines must remain included.

### Discount allocation

Invoice-level discounts are allocated proportionally by each line's `netAmountBeforeInvoiceDiscount`. Taxed and untaxed nonzero lines participate. Allocation uses exact BigInt arithmetic and largest fractional remainder. Ties are resolved by lower `position`, then lexicographic line ID.

The allocation helper allocates exactly the requested total, rejects positive totals with zero allocation basis, preserves currency, detects monetary overflow, and verifies no allocated discount exceeds a line basis. For valid non-negative discounts where the total does not exceed the basis total, the largest-remainder remainder count is bounded by the number of eligible lines, so one deterministic pass over sorted candidates distributes all remaining minor units.

### Tax strategy

Task 004 supports exclusive tax only. Omitted tax means an untaxed line. Zero-rate tax is allowed. Each line may have zero or one tax rate.

Tax rounding strategies:

- `per_line`: calculate and round tax for each taxed line.
- `invoice_total`: group lines by canonical rate units, sum taxable bases per distinct rate, apply and round tax once per rate group, then allocate the rounded group tax back only across that group's lines using largest fractional remainder with position/ID tie-breaking.

Different tax rates are never combined into one aggregate tax calculation.

### Payments and settlement

Settlement is separate from invoice pricing totals:

```text
amountPaid = sum of applied payments
balanceDue = grandTotal - amountPaid
```

Payments are optional. Payment IDs must be unique, amounts must be non-negative, currencies must match the invoice currency, and overpayments are rejected because credit-balance workflows are deferred.

### Validation and errors

The engine is fail-fast and returns `DomainResult<InvoiceCalculationResult>`.

New error codes added for concrete public paths:

- `invalid_rate`
- `invalid_invoice_calculation`
- `duplicate_identifier`
- `discount_exceeds_amount`
- `overpayment`

Existing domain errors are reused for `currency_mismatch`, `numeric_overflow`, `invalid_currency_definition`, `invalid_rounding_mode`, and `invariant_violation`. Speculative errors such as `negative_total` and `invalid_tax_configuration` are intentionally not added.

### Calculation versioning and metadata

Results include `export const INVOICE_CALCULATION_VERSION = '1' as const;`.

Metadata includes the calculation version, rounding mode, tax rounding strategy, and validated frozen currency definition. Changing calculation order, allocation rules, or rounding boundaries may require a calculation-version increment so finalized invoice snapshots remain reproducible.

### Immutability

The engine does not sort or mutate caller line or payment arrays in place. Calculated line objects, the calculated lines array, totals, settlement, metadata, and the top-level result are frozen. Currency metadata in result metadata is the validated frozen `CurrencyDefinition` returned by the domain parser.

## Rejected alternatives

- Floating-point rates or money calculations: rejected to preserve deterministic financial arithmetic.
- A generic exported ratio API: rejected because Task 004 only needs a domain `Rate` primitive and `applyRateToMoney`.
- Combining all taxable bases regardless of tax rate for invoice-total tax: rejected because distinct tax rates must remain isolated.
- Deriving grand total from taxable bases: rejected because untaxed lines would be excluded.
- Allowing overpayment credit balances: rejected for Task 004 because credit workflows are deferred.

## Deferred features

- Invoice lifecycle transitions.
- Finalized invoice entity and snapshot persistence.
- Customer/catalog models and descriptive line snapshots.
- Adjustments as a separate concept from line items.
- Negative lines, credits, refunds, and overpayment workflows.
- Inclusive, compound, jurisdiction-specific, and multi-component taxes.
- Payment processing or cross-invoice allocation.
- Currency conversion and exchange rates.
- APIs, DynamoDB, Lambda, PDF generation, email, UI, and offline synchronization.
