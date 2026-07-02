import type { StoredInvoiceRecord } from '@invoice/invoice-repository';

export type InMemoryInvoiceRepositoryOptions = Readonly<{
  initialRecords?: readonly StoredInvoiceRecord[];
}>;

export const createInMemoryInvoiceRepository = (
  _options: InMemoryInvoiceRepositoryOptions = {},
): never => {
  throw new Error(
    'createInMemoryInvoiceRepository is scaffolded but not implemented. Task 008C will add adapter behavior.',
  );
};
