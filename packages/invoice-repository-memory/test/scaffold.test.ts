import { describe, expect, it } from 'vitest';

import { createInMemoryInvoiceRepository } from '../src/index';

describe('invoice-repository-memory scaffold', () => {
  it('exports the scaffolded factory', () => {
    expect(createInMemoryInvoiceRepository).toBeTypeOf('function');
  });

  it('throws until Task 008C implements adapter behavior', () => {
    expect(() => createInMemoryInvoiceRepository()).toThrow(
      'createInMemoryInvoiceRepository is scaffolded but not implemented. Task 008C will add adapter behavior.',
    );
  });
});
