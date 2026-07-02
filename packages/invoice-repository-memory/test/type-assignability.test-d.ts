import type { StoredInvoiceRecord } from '@invoice/invoice-repository';

import type { InMemoryInvoiceRepositoryOptions } from '../src/index';
import { createInMemoryInvoiceRepository } from '../src/index';

declare const initialRecords: StoredInvoiceRecord[];

const options: InMemoryInvoiceRepositoryOptions = {
  initialRecords,
};

const readonlyOptions: InMemoryInvoiceRepositoryOptions = {
  initialRecords: initialRecords as readonly StoredInvoiceRecord[],
};

const factory: (options?: InMemoryInvoiceRepositoryOptions) => never =
  createInMemoryInvoiceRepository;

void options;
void readonlyOptions;
void factory;
