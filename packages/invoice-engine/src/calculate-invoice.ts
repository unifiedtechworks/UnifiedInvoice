import {
  addMoney,
  applyRateToMoney,
  assertMonetaryInteger,
  compareMoney,
  createMoney,
  err,
  isCurrencyCode,
  isCurrencyMinorUnitDigits,
  isInvoiceLineItemId,
  isPaymentId,
  isRoundingMode,
  makeDomainError,
  multiplyMoneyByQuantity,
  parseCurrencyDefinition,
  RATE_SCALE,
  subtractMoney,
  type DomainError,
  type DomainResult,
  type Money,
  type Rate,
  type RoundingMode,
} from '@invoice/domain';

import {
  DEFAULT_TAX_ROUNDING_STRATEGY,
  INVOICE_CALCULATION_VERSION,
  type AppliedPayment,
  type CalculatedInvoiceLine,
  type FixedDiscount,
  type InvoiceCalculationInput,
  type InvoiceCalculationLineInput,
  type InvoiceCalculationMetadata,
  type InvoiceCalculationResult,
  type InvoiceCalculationTotals,
  type InvoiceDiscount,
  type InvoiceSettlementTotals,
  type LineDiscount,
  type TaxRoundingStrategy,
} from './types';

type PricedLine = Readonly<{
  input: InvoiceCalculationLineInput;
  grossAmount: Money;
  lineDiscountAmount: Money;
  netAmountBeforeInvoiceDiscount: Money;
}>;

type DiscountedLine = PricedLine &
  Readonly<{
    invoiceDiscountAllocation: Money;
    netAmountAfterInvoiceDiscount: Money;
    taxableBase: Money;
  }>;

const invalidCalculation = (message: string, path?: string): DomainError =>
  makeDomainError('invalid_invoice_calculation', message, path);

const duplicateIdentifier = (message: string, path?: string): DomainError =>
  makeDomainError('duplicate_identifier', message, path);

const discountExceedsAmount = (message: string, path?: string): DomainError =>
  makeDomainError('discount_exceeds_amount', message, path);

const overpayment = makeDomainError(
  'overpayment',
  'Applied payments must not exceed invoice grand total.',
);

const zeroMoney = (template: Money): Money => {
  const result = createMoney(template.currency, assertMonetaryInteger('0'));

  if (!result.ok) {
    throw new Error('Expected zero money creation to succeed for a valid template currency.');
  }

  return result.value;
};

const compare = (left: Money, right: Money): DomainResult<-1 | 0 | 1> => compareMoney(left, right);

const add = (left: Money, right: Money): DomainResult<Money> => addMoney(left, right);

const subtract = (left: Money, right: Money): DomainResult<Money> => subtractMoney(left, right);

const isNegative = (value: Money): boolean => value.minorUnits < 0n;

const isZero = (value: Money): boolean => value.minorUnits === 0n;

const isPositive = (value: Money): boolean => value.minorUnits > 0n;

const sameCurrency = (left: Money, right: Money): boolean => left.currency === right.currency;

const matchesCurrencyDefinition = (
  money: Money,
  currency: InvoiceCalculationInput['currency'],
): boolean => money.currency === currency.code;

const sumMoney = (values: readonly Money[], zero: Money): DomainResult<Money> => {
  let total = zero;

  for (const value of values) {
    const next = add(total, value);

    if (!next.ok) {
      return next;
    }

    total = next.value;
  }

  return { ok: true, value: total };
};

const validateTaxRoundingStrategy = (value: TaxRoundingStrategy): boolean =>
  value === 'per_line' || value === 'invoice_total';

const isReadonlyRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const validatePosition = (position: number): boolean =>
  Number.isSafeInteger(position) && position >= 0;

const validateCurrencyDefinition = (
  value: InvoiceCalculationInput['currency'],
): DomainResult<InvoiceCalculationInput['currency']> => {
  const parsed = parseCurrencyDefinition(value);

  if (!parsed.ok) {
    return err(parsed.error);
  }

  return { ok: true, value };
};

const validateInputShape = (input: InvoiceCalculationInput): DomainResult<void> => {
  if (!isReadonlyRecord(input)) {
    return err(invalidCalculation('Invoice calculation input must be an object.'));
  }

  if (!Array.isArray(input.lines)) {
    return err(invalidCalculation('Invoice calculation lines must be an array.', 'lines'));
  }

  if (input.payments !== undefined && !Array.isArray(input.payments)) {
    return err(invalidCalculation('Applied payments must be an array.', 'payments'));
  }

  if (input.roundingMode !== undefined && !isRoundingMode(input.roundingMode)) {
    return err(makeDomainError('invalid_rounding_mode', 'Invalid rounding mode.', 'roundingMode'));
  }

  if (
    !isReadonlyRecord(input.currency) ||
    typeof input.currency.code !== 'string' ||
    !isCurrencyCode(input.currency.code) ||
    !isCurrencyMinorUnitDigits(input.currency.minorUnitDigits)
  ) {
    return err(
      makeDomainError(
        'invalid_currency_definition',
        'Currency definition must include a valid currency code and minor unit digits from 0 through 4.',
        'currency',
      ),
    );
  }

  return { ok: true, value: undefined };
};

const compareBigIntDescending = (left: bigint, right: bigint): -1 | 0 | 1 => {
  if (left > right) {
    return -1;
  }

  if (left < right) {
    return 1;
  }

  return 0;
};

const sortedLines = (
  lines: readonly InvoiceCalculationLineInput[],
): DomainResult<readonly InvoiceCalculationLineInput[]> => {
  if (lines.length === 0) {
    return err(invalidCalculation('Invoice calculation requires at least one line.', 'lines'));
  }

  const seen = new Set<string>();

  for (const [index, line] of lines.entries()) {
    if (!isReadonlyRecord(line)) {
      return err(invalidCalculation('Invoice line must be an object.', `lines.${index}`));
    }

    if (!isInvoiceLineItemId(line.id)) {
      return err(invalidCalculation('Invoice line item ID must be valid.', `lines.${index}.id`));
    }

    if (!validatePosition(line.position)) {
      return err(
        invalidCalculation(
          'Line position must be a non-negative safe integer.',
          `lines.${index}.position`,
        ),
      );
    }

    if (seen.has(line.id)) {
      return err(duplicateIdentifier('Invoice line item IDs must be unique.', `lines.${index}.id`));
    }

    seen.add(line.id);
  }

  return {
    ok: true,
    value: [...lines].sort(
      (left, right) => left.position - right.position || left.id.localeCompare(right.id),
    ),
  };
};

const validateRateForInvoiceContext = (rate: Rate, path: string): DomainResult<Rate> => {
  if (
    !isReadonlyRecord(rate) ||
    typeof rate.units !== 'bigint' ||
    rate.units < 0n ||
    rate.units > RATE_SCALE
  ) {
    return err(
      invalidCalculation('Invoice discount and tax rates must be between 0% and 100%.', path),
    );
  }

  return { ok: true, value: rate };
};

const validateFixedDiscount = (
  discount: FixedDiscount,
  template: Money,
  path: string,
): DomainResult<FixedDiscount> => {
  if (!isReadonlyRecord(discount.amount) || typeof discount.amount.minorUnits !== 'bigint') {
    return err(invalidCalculation('Fixed discount amount must be valid Money.', `${path}.amount`));
  }

  if (!sameCurrency(discount.amount, template)) {
    return err(
      makeDomainError(
        'currency_mismatch',
        'Fixed discount currency must match invoice currency.',
        path,
      ),
    );
  }

  if (isNegative(discount.amount)) {
    return err(invalidCalculation('Fixed discounts must be non-negative.', path));
  }

  return { ok: true, value: discount };
};

const calculateDiscount = (
  discount: LineDiscount | InvoiceDiscount | undefined,
  baseAmount: Money,
  roundingMode: RoundingMode,
  path: string,
): DomainResult<Money> => {
  if (discount === undefined) {
    return { ok: true, value: zeroMoney(baseAmount) };
  }

  if (!isReadonlyRecord(discount)) {
    return err(invalidCalculation('Discount must be an object.', path));
  }

  if (discount.kind === 'fixed') {
    const fixed = validateFixedDiscount(discount, baseAmount, path);

    if (!fixed.ok) {
      return err(fixed.error);
    }

    return { ok: true, value: discount.amount };
  }

  if (discount.kind !== 'percentage') {
    return err(invalidCalculation('Discount kind must be fixed or percentage.', `${path}.kind`));
  }

  const rate = validateRateForInvoiceContext(discount.rate, path);

  if (!rate.ok) {
    return err(rate.error);
  }

  return applyRateToMoney(baseAmount, discount.rate, roundingMode);
};

const validateLine = (
  line: InvoiceCalculationLineInput,
  template: Money,
  path: string,
): DomainResult<void> => {
  if (!isReadonlyRecord(line.quantity) || typeof line.quantity.units !== 'bigint') {
    return err(invalidCalculation('Line quantity must be valid.', `${path}.quantity`));
  }

  if (line.quantity.units <= 0n) {
    return err(invalidCalculation('Line quantity must be greater than zero.', `${path}.quantity`));
  }

  if (!isReadonlyRecord(line.unitPrice) || typeof line.unitPrice.minorUnits !== 'bigint') {
    return err(invalidCalculation('Line unit price must be valid Money.', `${path}.unitPrice`));
  }

  if (!sameCurrency(line.unitPrice, template)) {
    return err(
      makeDomainError(
        'currency_mismatch',
        'Line unit price currency must match invoice currency.',
        `${path}.unitPrice`,
      ),
    );
  }

  if (isNegative(line.unitPrice)) {
    return err(invalidCalculation('Line unit price must be non-negative.', `${path}.unitPrice`));
  }

  if (line.tax !== undefined) {
    if (!isReadonlyRecord(line.tax)) {
      return err(invalidCalculation('Line tax must be an object.', `${path}.tax`));
    }

    const rate = validateRateForInvoiceContext(line.tax.rate, `${path}.tax.rate`);

    if (!rate.ok) {
      return err(rate.error);
    }
  }

  return { ok: true, value: undefined };
};

const validateLineAgainstCurrencyDefinition = (
  line: InvoiceCalculationLineInput,
  currency: InvoiceCalculationInput['currency'],
  path: string,
): DomainResult<void> => {
  if (!isReadonlyRecord(line.unitPrice) || typeof line.unitPrice.currency !== 'string') {
    return err(invalidCalculation('Line unit price must be valid Money.', `${path}.unitPrice`));
  }

  if (!matchesCurrencyDefinition(line.unitPrice, currency)) {
    return err(
      makeDomainError(
        'currency_mismatch',
        'Line unit price currency must match invoice currency.',
        `${path}.unitPrice`,
      ),
    );
  }

  return { ok: true, value: undefined };
};

const priceLine = (
  line: InvoiceCalculationLineInput,
  template: Money,
  roundingMode: RoundingMode,
  path: string,
): DomainResult<PricedLine> => {
  const valid = validateLine(line, template, path);

  if (!valid.ok) {
    return err(valid.error);
  }

  const gross = multiplyMoneyByQuantity(line.unitPrice, line.quantity, roundingMode);

  if (!gross.ok) {
    return gross;
  }

  const discount = calculateDiscount(line.discount, gross.value, roundingMode, `${path}.discount`);

  if (!discount.ok) {
    return discount;
  }

  const discountComparison = compare(discount.value, gross.value);

  if (!discountComparison.ok) {
    return err(discountComparison.error);
  }

  if (discountComparison.value > 0) {
    return err(
      discountExceedsAmount('Line discount must not exceed gross line amount.', `${path}.discount`),
    );
  }

  const net = subtract(gross.value, discount.value);

  if (!net.ok) {
    return net;
  }

  return {
    ok: true,
    value: Object.freeze({
      input: line,
      grossAmount: gross.value,
      lineDiscountAmount: discount.value,
      netAmountBeforeInvoiceDiscount: net.value,
    }),
  };
};

type AllocationInput = Readonly<{
  id: string;
  position: number;
  amount: Money;
}>;

const allocateMoney = (
  total: Money,
  bases: readonly AllocationInput[],
): DomainResult<ReadonlyMap<string, Money>> => {
  const zero = zeroMoney(total);
  const initial = new Map<string, Money>();

  for (const base of bases) {
    initial.set(base.id, zero);
  }

  if (isZero(total)) {
    return { ok: true, value: initial };
  }

  const eligible = bases.filter((base) => isPositive(base.amount));

  if (eligible.length === 0) {
    return err(
      discountExceedsAmount('Positive discount cannot be allocated when allocation basis is zero.'),
    );
  }

  const basis = eligible.reduce((sum, base) => sum + base.amount.minorUnits, 0n);
  const shares = eligible.map((base) => {
    const numerator = total.minorUnits * base.amount.minorUnits;
    const quotient = numerator / basis;
    const remainder = numerator % basis;
    return { ...base, quotient, remainder };
  });
  const allocated = shares.reduce((sum, share) => sum + share.quotient, 0n);
  let remaining = total.minorUnits - allocated;
  const ordered = [...shares].sort(
    (left, right) =>
      compareBigIntDescending(left.remainder, right.remainder) ||
      left.position - right.position ||
      left.id.localeCompare(right.id),
  );
  const values = new Map<string, bigint>(shares.map((share) => [share.id, share.quotient]));

  for (const share of ordered) {
    if (remaining <= 0n) {
      break;
    }

    values.set(share.id, (values.get(share.id) ?? 0n) + 1n);
    remaining -= 1n;
  }

  for (const base of bases) {
    const units = values.get(base.id) ?? 0n;

    if (units > base.amount.minorUnits) {
      return err(discountExceedsAmount('Allocated discount must not exceed line net amount.'));
    }

    const money = createMoney(total.currency, assertMonetaryInteger(units.toString()));

    if (!money.ok) {
      return err(money.error);
    }

    initial.set(base.id, money.value);
  }

  return { ok: true, value: initial };
};

const applyInvoiceDiscount = (
  lines: readonly PricedLine[],
  invoiceDiscountTotal: Money,
): DomainResult<readonly DiscountedLine[]> => {
  const allocations = allocateMoney(
    invoiceDiscountTotal,
    lines.map((line) => ({
      id: line.input.id,
      position: line.input.position,
      amount: line.netAmountBeforeInvoiceDiscount,
    })),
  );

  if (!allocations.ok) {
    return err(allocations.error);
  }

  const discounted: DiscountedLine[] = [];

  for (const line of lines) {
    const allocation = allocations.value.get(line.input.id) ?? zeroMoney(invoiceDiscountTotal);
    const net = subtract(line.netAmountBeforeInvoiceDiscount, allocation);

    if (!net.ok) {
      return net;
    }

    discounted.push(
      Object.freeze({
        ...line,
        invoiceDiscountAllocation: allocation,
        netAmountAfterInvoiceDiscount: net.value,
        taxableBase: line.input.tax === undefined ? zeroMoney(net.value) : net.value,
      }),
    );
  }

  return { ok: true, value: Object.freeze(discounted) };
};

const calculateLineTaxes = (
  lines: readonly DiscountedLine[],
  strategy: TaxRoundingStrategy,
  roundingMode: RoundingMode,
): DomainResult<ReadonlyMap<string, Money>> => {
  const taxes = new Map<string, Money>();

  for (const line of lines) {
    taxes.set(line.input.id, zeroMoney(line.netAmountAfterInvoiceDiscount));
  }

  if (strategy === 'per_line') {
    for (const line of lines) {
      if (line.input.tax === undefined) {
        continue;
      }

      const tax = applyRateToMoney(line.taxableBase, line.input.tax.rate, roundingMode);

      if (!tax.ok) {
        return tax;
      }

      taxes.set(line.input.id, tax.value);
    }

    return { ok: true, value: taxes };
  }

  const groups = new Map<string, DiscountedLine[]>();

  for (const line of lines) {
    if (line.input.tax === undefined) {
      continue;
    }

    const key = line.input.tax.rate.units.toString();
    groups.set(key, [...(groups.get(key) ?? []), line]);
  }

  for (const group of groups.values()) {
    const firstLine = group[0];
    const rate = firstLine?.input.tax?.rate;

    if (firstLine === undefined || rate === undefined) {
      return err(makeDomainError('invariant_violation', 'Tax group must include a rate.'));
    }

    const baseTotal = sumMoney(
      group.map((line) => line.taxableBase),
      zeroMoney(firstLine.taxableBase),
    );

    if (!baseTotal.ok) {
      return baseTotal;
    }

    const groupTax = applyRateToMoney(baseTotal.value, rate, roundingMode);

    if (!groupTax.ok) {
      return groupTax;
    }

    const allocated = allocateMoney(
      groupTax.value,
      group.map((line) => ({
        id: line.input.id,
        position: line.input.position,
        amount: line.taxableBase,
      })),
    );

    if (!allocated.ok) {
      return err(allocated.error);
    }

    for (const line of group) {
      taxes.set(line.input.id, allocated.value.get(line.input.id) ?? zeroMoney(groupTax.value));
    }
  }

  return { ok: true, value: taxes };
};

const calculatePayments = (
  payments: readonly AppliedPayment[] | undefined,
  grandTotal: Money,
): DomainResult<InvoiceSettlementTotals> => {
  const seen = new Set<string>();
  const amounts: Money[] = [];

  for (const [index, payment] of (payments ?? []).entries()) {
    if (!isReadonlyRecord(payment)) {
      return err(invalidCalculation('Applied payment must be an object.', `payments.${index}`));
    }

    if (!isPaymentId(payment.paymentId)) {
      return err(
        invalidCalculation('Applied payment ID must be valid.', `payments.${index}.paymentId`),
      );
    }

    if (seen.has(payment.paymentId)) {
      return err(
        duplicateIdentifier('Applied payment IDs must be unique.', `payments.${index}.paymentId`),
      );
    }

    seen.add(payment.paymentId);

    if (!isReadonlyRecord(payment.amount) || typeof payment.amount.minorUnits !== 'bigint') {
      return err(
        invalidCalculation(
          'Applied payment amount must be valid Money.',
          `payments.${index}.amount`,
        ),
      );
    }

    if (!sameCurrency(payment.amount, grandTotal)) {
      return err(
        makeDomainError(
          'currency_mismatch',
          'Applied payment currency must match invoice currency.',
          `payments.${index}.amount`,
        ),
      );
    }

    if (isNegative(payment.amount)) {
      return err(
        invalidCalculation(
          'Applied payment amounts must be non-negative.',
          `payments.${index}.amount`,
        ),
      );
    }

    amounts.push(payment.amount);
  }

  const amountPaid = sumMoney(amounts, zeroMoney(grandTotal));

  if (!amountPaid.ok) {
    return amountPaid;
  }

  const paidComparison = compare(amountPaid.value, grandTotal);

  if (!paidComparison.ok) {
    return err(paidComparison.error);
  }

  if (paidComparison.value > 0) {
    return err(overpayment);
  }

  const balanceDue = subtract(grandTotal, amountPaid.value);

  if (!balanceDue.ok) {
    return balanceDue;
  }

  return {
    ok: true,
    value: Object.freeze({ amountPaid: amountPaid.value, balanceDue: balanceDue.value }),
  };
};

export const calculateInvoice = (
  input: InvoiceCalculationInput,
): DomainResult<InvoiceCalculationResult> => {
  const inputShape = validateInputShape(input);

  if (!inputShape.ok) {
    return err(inputShape.error);
  }

  const currencyDefinition = validateCurrencyDefinition(input.currency);

  if (!currencyDefinition.ok) {
    return err(currencyDefinition.error);
  }

  const roundingMode = input.roundingMode ?? 'half_away_from_zero';
  const taxRoundingStrategy = input.taxRoundingStrategy ?? DEFAULT_TAX_ROUNDING_STRATEGY;

  if (!validateTaxRoundingStrategy(taxRoundingStrategy)) {
    return err(invalidCalculation('Invalid tax rounding strategy.', 'taxRoundingStrategy'));
  }

  const lines = sortedLines(input.lines);

  if (!lines.ok) {
    return err(lines.error);
  }

  const template = createMoney(currencyDefinition.value.code, assertMonetaryInteger('0'));

  if (!template.ok) {
    return err(template.error);
  }

  const priced: PricedLine[] = [];

  for (const [index, line] of lines.value.entries()) {
    const currencyMatch = validateLineAgainstCurrencyDefinition(
      line,
      currencyDefinition.value,
      `lines.${index}`,
    );

    if (!currencyMatch.ok) {
      return err(currencyMatch.error);
    }

    const pricedLine = priceLine(line, template.value, roundingMode, `lines.${index}`);

    if (!pricedLine.ok) {
      return err(pricedLine.error);
    }

    priced.push(pricedLine.value);
  }

  const grossLineTotal = sumMoney(
    priced.map((line) => line.grossAmount),
    template.value,
  );
  const lineDiscountTotal = sumMoney(
    priced.map((line) => line.lineDiscountAmount),
    template.value,
  );
  const netLineSubtotal = sumMoney(
    priced.map((line) => line.netAmountBeforeInvoiceDiscount),
    template.value,
  );

  if (!grossLineTotal.ok) return grossLineTotal;
  if (!lineDiscountTotal.ok) return lineDiscountTotal;
  if (!netLineSubtotal.ok) return netLineSubtotal;

  const invoiceDiscountTotal = calculateDiscount(
    input.invoiceDiscount,
    netLineSubtotal.value,
    roundingMode,
    'invoiceDiscount',
  );

  if (!invoiceDiscountTotal.ok) {
    return invoiceDiscountTotal;
  }

  const invoiceDiscountComparison = compare(invoiceDiscountTotal.value, netLineSubtotal.value);

  if (!invoiceDiscountComparison.ok) {
    return err(invoiceDiscountComparison.error);
  }

  if (invoiceDiscountComparison.value > 0) {
    return err(
      discountExceedsAmount(
        'Invoice discount must not exceed net line subtotal.',
        'invoiceDiscount',
      ),
    );
  }

  const discounted = applyInvoiceDiscount(priced, invoiceDiscountTotal.value);

  if (!discounted.ok) {
    return err(discounted.error);
  }

  const taxes = calculateLineTaxes(discounted.value, taxRoundingStrategy, roundingMode);

  if (!taxes.ok) {
    return err(taxes.error);
  }

  const calculatedLines: CalculatedInvoiceLine[] = [];

  for (const line of discounted.value) {
    const taxAmount =
      taxes.value.get(line.input.id) ?? zeroMoney(line.netAmountAfterInvoiceDiscount);
    const totalAmount = add(line.netAmountAfterInvoiceDiscount, taxAmount);

    if (!totalAmount.ok) {
      return totalAmount;
    }

    calculatedLines.push(
      Object.freeze({
        id: line.input.id,
        position: line.input.position,
        grossAmount: line.grossAmount,
        lineDiscountAmount: line.lineDiscountAmount,
        netAmountBeforeInvoiceDiscount: line.netAmountBeforeInvoiceDiscount,
        invoiceDiscountAllocation: line.invoiceDiscountAllocation,
        netAmountAfterInvoiceDiscount: line.netAmountAfterInvoiceDiscount,
        taxableBase: line.taxableBase,
        taxAmount,
        totalAmount: totalAmount.value,
      }),
    );
  }

  const discountedSubtotal = subtract(netLineSubtotal.value, invoiceDiscountTotal.value);
  if (!discountedSubtotal.ok) return discountedSubtotal;

  const taxableBaseTotal = sumMoney(
    calculatedLines.map((line) => line.taxableBase),
    template.value,
  );
  const taxTotal = sumMoney(
    calculatedLines.map((line) => line.taxAmount),
    template.value,
  );
  if (!taxableBaseTotal.ok) return taxableBaseTotal;
  if (!taxTotal.ok) return taxTotal;

  const grandTotal = add(discountedSubtotal.value, taxTotal.value);
  if (!grandTotal.ok) return grandTotal;

  const settlement = calculatePayments(input.payments, grandTotal.value);
  if (!settlement.ok) return err(settlement.error);

  const totals: InvoiceCalculationTotals = Object.freeze({
    grossLineTotal: grossLineTotal.value,
    lineDiscountTotal: lineDiscountTotal.value,
    netLineSubtotal: netLineSubtotal.value,
    invoiceDiscountTotal: invoiceDiscountTotal.value,
    discountedSubtotal: discountedSubtotal.value,
    taxableBaseTotal: taxableBaseTotal.value,
    taxTotal: taxTotal.value,
    grandTotal: grandTotal.value,
  });
  const metadata: InvoiceCalculationMetadata = Object.freeze({
    calculationVersion: INVOICE_CALCULATION_VERSION,
    roundingMode,
    taxRoundingStrategy,
    currency: currencyDefinition.value,
  });

  return {
    ok: true,
    value: Object.freeze({
      lines: Object.freeze(calculatedLines),
      totals,
      settlement: settlement.value,
      metadata,
    }),
  };
};
