import { invoiceDomainFoundation } from '@invoice/domain';

export const invoiceEngineFoundation = {
  name: 'Invoice Engine',
  domainStatus: invoiceDomainFoundation.status,
  status: 'foundation-ready',
} as const;
