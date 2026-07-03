import { describe, expect, it } from 'vitest';

import { createDynamoDbInvoiceRepository, type DynamoDbInvoiceRepositoryOptions } from '../src';

describe('createDynamoDbInvoiceRepository scaffold', () => {
  it('exports a factory that clearly defers all DynamoDB behavior to Task 011B', () => {
    const options: DynamoDbInvoiceRepositoryOptions = {
      tableNames: { invoicesTableName: 'unified-invoice-test-invoices' },
      ownerId: 'test-owner',
    };

    expect(createDynamoDbInvoiceRepository).toBeTypeOf('function');
    expect(() => createDynamoDbInvoiceRepository(options)).toThrow(
      'createDynamoDbInvoiceRepository is scaffolded but not implemented. Task 011B will add DynamoDB persistence behavior.',
    );
  });
});
