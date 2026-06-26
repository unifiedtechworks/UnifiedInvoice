import {
  type CurrencyDefinition,
  type InvoiceLineItemId,
  type Money,
  type PaymentId,
  type Quantity,
  type Rate,
  type RoundingMode,
} from '@invoice/domain';

export const INVOICE_CALCULATION_VERSION = '1' as const;
export const taxRoundingStrategies = ['per_line', 'invoice_total'] as const;
export const DEFAULT_TAX_ROUNDING_STRATEGY = 'per_line' as const;

export type TaxRoundingStrategy = (typeof taxRoundingStrategies)[number];

export type FixedDiscount = Readonly<{
  kind: 'fixed';
  amount: Money;
}>;

export type PercentageDiscount = Readonly<{
  kind: 'percentage';
  rate: Rate;
}>;

export type LineDiscount = FixedDiscount | PercentageDiscount;
export type InvoiceDiscount = FixedDiscount | PercentageDiscount;

export type LineTax = Readonly<{
  rate: Rate;
}>;

export type AppliedPayment = Readonly<{
  paymentId: PaymentId;
  amount: Money;
}>;

export type InvoiceCalculationLineInput = Readonly<{
  id: InvoiceLineItemId;
  position: number;
  quantity: Quantity;
  unitPrice: Money;
  discount?: LineDiscount;
  tax?: LineTax;
}>;

export type InvoiceCalculationInput = Readonly<{
  currency: CurrencyDefinition;
  lines: readonly InvoiceCalculationLineInput[];
  invoiceDiscount?: InvoiceDiscount;
  payments?: readonly AppliedPayment[];
  roundingMode?: RoundingMode;
  taxRoundingStrategy?: TaxRoundingStrategy;
}>;

export type CalculatedInvoiceLine = Readonly<{
  id: InvoiceLineItemId;
  position: number;
  grossAmount: Money;
  lineDiscountAmount: Money;
  netAmountBeforeInvoiceDiscount: Money;
  invoiceDiscountAllocation: Money;
  netAmountAfterInvoiceDiscount: Money;
  taxableBase: Money;
  taxAmount: Money;
  totalAmount: Money;
}>;

export type InvoiceCalculationTotals = Readonly<{
  grossLineTotal: Money;
  lineDiscountTotal: Money;
  netLineSubtotal: Money;
  invoiceDiscountTotal: Money;
  discountedSubtotal: Money;
  taxableBaseTotal: Money;
  taxTotal: Money;
  grandTotal: Money;
}>;

export type InvoiceSettlementTotals = Readonly<{
  amountPaid: Money;
  balanceDue: Money;
}>;

export type InvoiceCalculationMetadata = Readonly<{
  calculationVersion: typeof INVOICE_CALCULATION_VERSION;
  roundingMode: RoundingMode;
  taxRoundingStrategy: TaxRoundingStrategy;
  currency: CurrencyDefinition;
}>;

export type InvoiceCalculationResult = Readonly<{
  lines: readonly CalculatedInvoiceLine[];
  totals: InvoiceCalculationTotals;
  settlement: InvoiceSettlementTotals;
  metadata: InvoiceCalculationMetadata;
}>;
