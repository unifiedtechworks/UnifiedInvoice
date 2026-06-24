import { describe, expect, it } from 'vitest';

import { invoiceDomainFoundation } from '@invoice/domain';
import { invoiceEngineFoundation } from '../src/index';

describe('invoice-engine foundation', () => {
  it('resolves workspace imports without implementing invoice calculations', () => {
    expect(invoiceDomainFoundation.status).toBe('foundation-ready');
    expect(invoiceEngineFoundation.domainStatus).toBe('foundation-ready');
  });
});
