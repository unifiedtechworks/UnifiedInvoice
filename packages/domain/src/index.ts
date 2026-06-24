export const invoiceDomainFoundation = {
  name: 'Invoice Domain',
  status: 'foundation-ready',
} as const;

export type InvoiceDomainFoundation = typeof invoiceDomainFoundation;

export const financialCalculationPolicy =
  'Floating-point currency calculations are prohibited. Money and invoice calculation design is deferred.' as const;
