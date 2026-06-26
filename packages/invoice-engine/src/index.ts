import { invoiceDomainFoundation } from '@invoice/domain';

export const invoiceEngineFoundation = {
  name: 'Invoice Engine',
  domainStatus: invoiceDomainFoundation.status,
  status: 'foundation-ready',
} as const;

export { calculateInvoice } from './calculate-invoice';
export {
  DEFAULT_TAX_ROUNDING_STRATEGY,
  INVOICE_CALCULATION_VERSION,
  taxRoundingStrategies,
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
  type LineTax,
  type PercentageDiscount,
  type TaxRoundingStrategy,
} from './types';
