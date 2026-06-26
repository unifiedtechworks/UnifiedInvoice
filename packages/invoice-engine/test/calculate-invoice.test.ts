import { describe, expect, it } from 'vitest';

import {
  assertCurrencyCode,
  assertInvoiceLineItemId,
  assertMoney,
  assertMonetaryInteger,
  assertPaymentId,
  createCurrencyDefinition,
  MAX_MONETARY_MINOR_UNITS,
  parseMoneyFromDecimal,
  parseQuantity,
  parseRateFromDecimalPercent,
  type CurrencyDefinition,
  type Money,
  type Quantity,
  type Rate,
} from '@invoice/domain';

import {
  calculateInvoice,
  INVOICE_CALCULATION_VERSION,
  type InvoiceCalculationInput,
  type InvoiceCalculationLineInput,
} from '../src/index';

const currency = (code = 'USD', minorUnitDigits: 0 | 1 | 2 | 3 | 4 = 2): CurrencyDefinition => {
  const result = createCurrencyDefinition(assertCurrencyCode(code), minorUnitDigits);
  if (!result.ok) throw new Error('Expected currency fixture.');
  return result.value;
};

const USD = currency();

const money = (value: string, definition = USD): Money => {
  const result = parseMoneyFromDecimal(value, definition);
  if (!result.ok) throw new Error(`Expected money ${value}.`);
  return result.value;
};

const rawMoney = (minorUnits: string, definition = USD): Money =>
  assertMoney(definition.code, assertMonetaryInteger(minorUnits));

const quantity = (value: string): Quantity => {
  const result = parseQuantity(value);
  if (!result.ok) throw new Error(`Expected quantity ${value}.`);
  return result.value;
};

const rate = (value: string): Rate => {
  const result = parseRateFromDecimalPercent(value);
  if (!result.ok) throw new Error(`Expected rate ${value}.`);
  return result.value;
};

const line = (
  id: string,
  position: number,
  price: string,
  qty = '1',
  overrides: Partial<InvoiceCalculationLineInput> = {},
): InvoiceCalculationLineInput => ({
  id: assertInvoiceLineItemId(id),
  position,
  quantity: quantity(qty),
  unitPrice: money(price),
  ...overrides,
});

const calculate = (
  input: Partial<InvoiceCalculationInput> & Pick<InvoiceCalculationInput, 'lines'>,
) => calculateInvoice({ currency: USD, ...input });

describe('calculateInvoice basic totals', () => {
  it('calculates one whole-unit line and metadata', () => {
    const result = calculate({ lines: [line('line-1', 0, '12.34', '2')] });

    expect(result).toMatchObject({
      ok: true,
      value: {
        totals: {
          grossLineTotal: { minorUnits: 2468n },
          discountedSubtotal: { minorUnits: 2468n },
          taxableBaseTotal: { minorUnits: 0n },
          taxTotal: { minorUnits: 0n },
          grandTotal: { minorUnits: 2468n },
        },
        settlement: { amountPaid: { minorUnits: 0n }, balanceDue: { minorUnits: 2468n } },
        metadata: {
          calculationVersion: INVOICE_CALCULATION_VERSION,
          taxRoundingStrategy: 'per_line',
        },
      },
    });
  });

  it('supports fractional quantities and zero-price lines', () => {
    const result = calculate({
      lines: [line('line-1', 0, '10.00', '1.5'), line('line-2', 1, '0.00')],
    });
    expect(result).toMatchObject({
      ok: true,
      value: { totals: { grandTotal: { minorUnits: 1500n } } },
    });
  });

  it('calculates multiple lines and all pricing total formulas', () => {
    const result = calculate({
      lines: [line('line-1', 0, '10.00', '2'), line('line-2', 1, '5.50', '1.5')],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        totals: {
          grossLineTotal: { minorUnits: 2825n },
          lineDiscountTotal: { minorUnits: 0n },
          netLineSubtotal: { minorUnits: 2825n },
          invoiceDiscountTotal: { minorUnits: 0n },
          discountedSubtotal: { minorUnits: 2825n },
          taxableBaseTotal: { minorUnits: 0n },
          taxTotal: { minorUnits: 0n },
          grandTotal: { minorUnits: 2825n },
        },
        settlement: { amountPaid: { minorUnits: 0n }, balanceDue: { minorUnits: 2825n } },
      },
    });
  });

  it('handles a large valid calculation and rejects overflow', () => {
    expect(calculate({ lines: [line('line-1', 0, '99999999999999.99')] })).toMatchObject({
      ok: true,
      value: { totals: { grandTotal: { minorUnits: 9_999_999_999_999_999n } } },
    });

    expect(
      calculate({
        lines: [
          {
            id: assertInvoiceLineItemId('line-1'),
            position: 0,
            quantity: quantity('2'),
            unitPrice: rawMoney(MAX_MONETARY_MINOR_UNITS.toString()),
          },
        ],
      }),
    ).toMatchObject({ ok: false, error: { code: 'numeric_overflow' } });
  });

  it('sorts by position then id without mutating caller input', () => {
    const lines = [line('line-b', 0, '1.00'), line('line-a', 0, '2.00')];
    const originalOrder = lines.map((item) => item.id);
    const result = calculate({ lines });

    expect(lines.map((item) => item.id)).toEqual(originalOrder);
    expect(result.ok && result.value.lines.map((item) => item.id)).toEqual(['line-a', 'line-b']);
  });

  it('rejects all invalid position forms and allows duplicate positions sorted by id', () => {
    for (const position of [
      -1,
      0.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
    ]) {
      expect(calculate({ lines: [line('line-1', position, '1.00')] })).toMatchObject({
        ok: false,
        error: { code: 'invalid_invoice_calculation' },
      });
    }

    const result = calculate({ lines: [line('b', 0, '1.00'), line('a', 0, '1.00')] });
    expect(result.ok && result.value.lines.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('freezes output objects', () => {
    const result = calculate({ lines: [line('line-1', 0, '1.00')] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.isFrozen(result.value)).toBe(true);
      expect(Object.isFrozen(result.value.lines)).toBe(true);
      expect(Object.isFrozen(result.value.lines[0])).toBe(true);
      expect(Object.isFrozen(result.value.totals)).toBe(true);
      expect(Object.isFrozen(result.value.settlement)).toBe(true);
      expect(Object.isFrozen(result.value.metadata)).toBe(true);
    }
  });
});

describe('discounts and taxable bases', () => {
  it('calculates fixed and percentage line discounts', () => {
    const result = calculate({
      lines: [
        line('line-1', 0, '100.00', '1', { discount: { kind: 'fixed', amount: money('25.00') } }),
        line('line-2', 1, '100.00', '1', { discount: { kind: 'percentage', rate: rate('10') } }),
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        totals: {
          grossLineTotal: { minorUnits: 20000n },
          lineDiscountTotal: { minorUnits: 3500n },
          netLineSubtotal: { minorUnits: 16500n },
          grandTotal: { minorUnits: 16500n },
        },
      },
    });
  });

  it('calculates fixed, percentage, zero, and 100 percent invoice discounts', () => {
    expect(
      calculate({
        lines: [line('line-1', 0, '100.00')],
        invoiceDiscount: { kind: 'fixed', amount: money('12.34') },
      }),
    ).toMatchObject({
      ok: true,
      value: {
        totals: { invoiceDiscountTotal: { minorUnits: 1234n }, grandTotal: { minorUnits: 8766n } },
      },
    });

    expect(
      calculate({
        lines: [line('line-1', 0, '100.00')],
        invoiceDiscount: { kind: 'percentage', rate: rate('12.5') },
      }),
    ).toMatchObject({
      ok: true,
      value: {
        totals: { invoiceDiscountTotal: { minorUnits: 1250n }, grandTotal: { minorUnits: 8750n } },
      },
    });

    expect(
      calculate({
        lines: [line('line-1', 0, '100.00')],
        invoiceDiscount: { kind: 'percentage', rate: rate('0') },
      }),
    ).toMatchObject({
      ok: true,
      value: {
        totals: { invoiceDiscountTotal: { minorUnits: 0n }, grandTotal: { minorUnits: 10000n } },
      },
    });

    expect(
      calculate({
        lines: [line('line-1', 0, '100.00')],
        invoiceDiscount: { kind: 'percentage', rate: rate('100') },
      }),
    ).toMatchObject({
      ok: true,
      value: {
        totals: { invoiceDiscountTotal: { minorUnits: 10000n }, grandTotal: { minorUnits: 0n } },
      },
    });
  });

  it('rejects excessive line discounts and mixed discount currencies', () => {
    const eur = currency('EUR');

    expect(
      calculate({
        lines: [
          line('line-1', 0, '1.00', '1', { discount: { kind: 'fixed', amount: money('2.00') } }),
        ],
      }),
    ).toMatchObject({ ok: false, error: { code: 'discount_exceeds_amount' } });

    expect(
      calculate({
        lines: [
          line('line-1', 0, '1.00', '1', {
            discount: { kind: 'fixed', amount: money('0.50', eur) },
          }),
        ],
      }),
    ).toMatchObject({ ok: false, error: { code: 'currency_mismatch' } });

    expect(
      calculate({
        lines: [line('line-1', 0, '1.00')],
        invoiceDiscount: { kind: 'fixed', amount: money('0.50', eur) },
      }),
    ).toMatchObject({ ok: false, error: { code: 'currency_mismatch' } });
  });

  it('allocates invoice-level discount across taxed and untaxed lines and keeps untaxed lines in grand total', () => {
    const result = calculate({
      lines: [
        line('taxed', 0, '100.00', '1', { tax: { rate: rate('10') } }),
        line('untaxed', 1, '100.00'),
      ],
      invoiceDiscount: { kind: 'fixed', amount: money('20.00') },
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        lines: [
          {
            id: 'taxed',
            invoiceDiscountAllocation: { minorUnits: 1000n },
            netAmountAfterInvoiceDiscount: { minorUnits: 9000n },
            taxableBase: { minorUnits: 9000n },
            taxAmount: { minorUnits: 900n },
            totalAmount: { minorUnits: 9900n },
          },
          {
            id: 'untaxed',
            invoiceDiscountAllocation: { minorUnits: 1000n },
            netAmountAfterInvoiceDiscount: { minorUnits: 9000n },
            taxableBase: { minorUnits: 0n },
            taxAmount: { minorUnits: 0n },
            totalAmount: { minorUnits: 9000n },
          },
        ],
        totals: {
          discountedSubtotal: { minorUnits: 18000n },
          taxableBaseTotal: { minorUnits: 9000n },
          taxTotal: { minorUnits: 900n },
          grandTotal: { minorUnits: 18900n },
        },
      },
    });
  });

  it('uses largest-remainder allocation with position and id tie-breaking', () => {
    const result = calculate({
      lines: [line('b', 0, '0.01'), line('a', 0, '0.01'), line('c', 1, '0.01')],
      invoiceDiscount: { kind: 'fixed', amount: money('0.01') },
    });

    expect(
      result.ok &&
        result.value.lines.map((item) => [item.id, item.invoiceDiscountAllocation.minorUnits]),
    ).toEqual([
      ['a', 1n],
      ['b', 0n],
      ['c', 0n],
    ]);
  });

  it('allocates exact invoice discount sums deterministically across more remaining units than one', () => {
    const result = calculate({
      lines: [line('a', 0, '0.01'), line('b', 1, '0.01'), line('c', 2, '0.01')],
      invoiceDiscount: { kind: 'fixed', amount: money('0.02') },
    });

    expect(
      result.ok && result.value.lines.map((item) => item.invoiceDiscountAllocation.minorUnits),
    ).toEqual([1n, 1n, 0n]);
    expect(
      result.ok &&
        result.value.lines.reduce(
          (sum, item) => sum + item.invoiceDiscountAllocation.minorUnits,
          0n,
        ),
    ).toBe(2n);
  });

  it('rejects excessive discounts and positive invoice discounts against zero subtotal', () => {
    expect(
      calculate({
        lines: [line('line-1', 0, '1.00')],
        invoiceDiscount: { kind: 'fixed', amount: money('2.00') },
      }),
    ).toMatchObject({ ok: false, error: { code: 'discount_exceeds_amount' } });
    expect(
      calculate({
        lines: [line('line-1', 0, '0.00')],
        invoiceDiscount: { kind: 'fixed', amount: money('0.01') },
      }),
    ).toMatchObject({ ok: false, error: { code: 'discount_exceeds_amount' } });
    expect(
      calculate({
        lines: [line('line-1', 0, '0.00')],
        invoiceDiscount: { kind: 'fixed', amount: money('0.00') },
      }),
    ).toMatchObject({ ok: true });
  });
});

describe('tax calculation strategies', () => {
  it('supports no tax, zero-rate tax, and one exclusive tax', () => {
    expect(calculate({ lines: [line('line-1', 0, '1.00')] })).toMatchObject({
      ok: true,
      value: {
        lines: [
          {
            taxableBase: { minorUnits: 0n },
            taxAmount: { minorUnits: 0n },
            totalAmount: { minorUnits: 100n },
          },
        ],
      },
    });

    expect(
      calculate({ lines: [line('line-1', 0, '1.00', '1', { tax: { rate: rate('0') } })] }),
    ).toMatchObject({
      ok: true,
      value: {
        lines: [
          {
            taxableBase: { minorUnits: 100n },
            taxAmount: { minorUnits: 0n },
            totalAmount: { minorUnits: 100n },
          },
        ],
      },
    });

    expect(
      calculate({ lines: [line('line-1', 0, '1.00', '1', { tax: { rate: rate('8.25') } })] }),
    ).toMatchObject({
      ok: true,
      value: {
        lines: [
          {
            taxableBase: { minorUnits: 100n },
            taxAmount: { minorUnits: 8n },
            totalAmount: { minorUnits: 108n },
          },
        ],
      },
    });
  });

  it('supports per-line exclusive tax rounding', () => {
    const result = calculate({
      lines: [
        line('line-1', 0, '0.05', '1', { tax: { rate: rate('10') } }),
        line('line-2', 1, '0.05', '1', { tax: { rate: rate('10') } }),
      ],
      taxRoundingStrategy: 'per_line',
    });
    expect(result).toMatchObject({
      ok: true,
      value: { totals: { taxTotal: { minorUnits: 2n }, grandTotal: { minorUnits: 12n } } },
    });
  });

  it('groups invoice-total tax by distinct rate and allocates back to group lines', () => {
    const result = calculate({
      lines: [
        line('a', 0, '0.05', '1', { tax: { rate: rate('10') } }),
        line('b', 1, '0.05', '1', { tax: { rate: rate('10') } }),
        line('c', 2, '1.00', '1', { tax: { rate: rate('20') } }),
      ],
      taxRoundingStrategy: 'invoice_total',
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        lines: [
          { id: 'a', taxAmount: { minorUnits: 1n } },
          { id: 'b', taxAmount: { minorUnits: 0n } },
          { id: 'c', taxAmount: { minorUnits: 20n } },
        ],
        totals: { taxTotal: { minorUnits: 21n }, grandTotal: { minorUnits: 131n } },
      },
    });
  });

  it('keeps invoice-total tax allocation within each distinct rate group', () => {
    const result = calculate({
      lines: [
        line('a', 0, '0.05', '1', { tax: { rate: rate('10') } }),
        line('b', 1, '0.05', '1', { tax: { rate: rate('10') } }),
        line('c', 2, '0.05', '1', { tax: { rate: rate('20') } }),
        line('d', 3, '0.05', '1', { tax: { rate: rate('20') } }),
      ],
      taxRoundingStrategy: 'invoice_total',
    });

    expect(
      result.ok && result.value.lines.map((item) => [item.id, item.taxAmount.minorUnits]),
    ).toEqual([
      ['a', 1n],
      ['b', 0n],
      ['c', 1n],
      ['d', 1n],
    ]);
  });

  it('discounts reduce taxable base while untaxed lines remain in grand total', () => {
    const result = calculate({
      lines: [
        line('taxed', 0, '10.00', '1', {
          discount: { kind: 'fixed', amount: money('2.00') },
          tax: { rate: rate('10') },
        }),
        line('untaxed', 1, '5.00'),
      ],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        lines: [
          {
            id: 'taxed',
            taxableBase: { minorUnits: 800n },
            taxAmount: { minorUnits: 80n },
            totalAmount: { minorUnits: 880n },
          },
          {
            id: 'untaxed',
            taxableBase: { minorUnits: 0n },
            taxAmount: { minorUnits: 0n },
            totalAmount: { minorUnits: 500n },
          },
        ],
        totals: {
          discountedSubtotal: { minorUnits: 1300n },
          taxableBaseTotal: { minorUnits: 800n },
          taxTotal: { minorUnits: 80n },
          grandTotal: { minorUnits: 1380n },
        },
      },
    });
  });
});

describe('payments, currencies, and validation', () => {
  it('supports no payments, multiple payments, and exact full payment', () => {
    expect(calculate({ lines: [line('line-1', 0, '10.00')] })).toMatchObject({
      ok: true,
      value: { settlement: { amountPaid: { minorUnits: 0n }, balanceDue: { minorUnits: 1000n } } },
    });

    expect(
      calculate({
        lines: [line('line-1', 0, '10.00')],
        payments: [
          { paymentId: assertPaymentId('payment-1'), amount: money('4.00') },
          { paymentId: assertPaymentId('payment-2'), amount: money('6.00') },
        ],
      }),
    ).toMatchObject({
      ok: true,
      value: { settlement: { amountPaid: { minorUnits: 1000n }, balanceDue: { minorUnits: 0n } } },
    });
  });

  it('separates settlement totals from invoice pricing totals', () => {
    const result = calculate({
      lines: [line('line-1', 0, '10.00')],
      payments: [{ paymentId: assertPaymentId('payment-1'), amount: money('4.00') }],
    });

    expect(result).toMatchObject({
      ok: true,
      value: {
        totals: { grandTotal: { minorUnits: 1000n } },
        settlement: { amountPaid: { minorUnits: 400n }, balanceDue: { minorUnits: 600n } },
      },
    });
  });

  it('rejects overpayments, duplicate payments, and mixed payment currency', () => {
    const eur = currency('EUR');
    expect(
      calculate({
        lines: [line('line-1', 0, '1.00')],
        payments: [{ paymentId: assertPaymentId('payment-1'), amount: money('2.00') }],
      }),
    ).toMatchObject({ ok: false, error: { code: 'overpayment' } });
    expect(
      calculate({
        lines: [line('line-1', 0, '2.00')],
        payments: [
          { paymentId: assertPaymentId('payment-1'), amount: money('1.00') },
          { paymentId: assertPaymentId('payment-1'), amount: money('1.00') },
        ],
      }),
    ).toMatchObject({ ok: false, error: { code: 'duplicate_identifier' } });
    expect(
      calculate({
        lines: [line('line-1', 0, '2.00')],
        payments: [{ paymentId: assertPaymentId('payment-1'), amount: money('1.00', eur) }],
      }),
    ).toMatchObject({ ok: false, error: { code: 'currency_mismatch' } });
  });

  it('rejects empty invoices, duplicate line IDs, invalid positions, non-positive quantities, negative prices, and mixed line currencies', () => {
    const eur = currency('EUR');
    expect(calculate({ lines: [] })).toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice_calculation' },
    });
    expect(
      calculate({ lines: [line('line-1', 0, '1.00'), line('line-1', 1, '1.00')] }),
    ).toMatchObject({ ok: false, error: { code: 'duplicate_identifier' } });
    expect(calculate({ lines: [line('line-1', 0.5, '1.00')] })).toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice_calculation' },
    });
    expect(calculate({ lines: [line('line-1', 0, '1.00', '0')] })).toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice_calculation' },
    });
    expect(calculate({ lines: [line('line-1', 0, '-1.00')] })).toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice_calculation' },
    });
    expect(
      calculate({ lines: [line('line-1', 0, '1.00', '1', { unitPrice: money('1.00', eur) })] }),
    ).toMatchObject({ ok: false, error: { code: 'currency_mismatch' } });
  });

  it('validates runtime options, arrays, currency definitions, and payment amounts', () => {
    expect(calculateInvoice({ currency: USD, lines: 'bad' as never })).toMatchObject({
      ok: false,
      error: { code: 'invalid_invoice_calculation' },
    });
    expect(
      calculateInvoice({
        currency: USD,
        lines: [line('line-1', 0, '1.00')],
        payments: 'bad' as never,
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid_invoice_calculation' } });
    expect(
      calculateInvoice({
        currency: USD,
        lines: [line('line-1', 0, '1.00')],
        roundingMode: 'bad' as never,
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid_rounding_mode' } });
    expect(
      calculateInvoice({
        currency: USD,
        lines: [line('line-1', 0, '1.00')],
        taxRoundingStrategy: 'bad' as never,
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid_invoice_calculation' } });
    expect(
      calculateInvoice({
        currency: { code: 'usd', minorUnitDigits: 2 } as never,
        lines: [line('line-1', 0, '1.00')],
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid_currency_definition' } });
    expect(
      calculate({
        lines: [line('line-1', 0, '1.00')],
        payments: [{ paymentId: assertPaymentId('payment-1'), amount: money('-0.01') }],
      }),
    ).toMatchObject({ ok: false, error: { code: 'invalid_invoice_calculation' } });
  });

  it('rejects invoice-context rates over 100% while the domain rate permits up to 1000%', () => {
    expect(rate('1000').units).toBe(10_000_000n);
    expect(
      calculate({ lines: [line('line-1', 0, '1.00', '1', { tax: { rate: rate('1000') } })] }),
    ).toMatchObject({ ok: false, error: { code: 'invalid_invoice_calculation' } });
  });

  it('repeated calls produce deeply equal deterministic results', () => {
    const input = {
      lines: [line('b', 1, '2.00', '1', { tax: { rate: rate('10') } }), line('a', 0, '1.00')],
      invoiceDiscount: { kind: 'fixed', amount: money('0.03') },
    } satisfies Partial<InvoiceCalculationInput> & Pick<InvoiceCalculationInput, 'lines'>;

    expect(calculate(input)).toEqual(calculate(input));
  });
});
