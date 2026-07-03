import type { InvoiceRepository, StoredInvoiceRecord } from '@invoice/invoice-repository';

import {
  createDynamoDbInvoiceRepository,
  type DynamoDbInvoiceRepositoryOptions,
  type DynamoDbInvoiceRepositoryTableNames,
} from '../src';

declare const storedRecord: StoredInvoiceRecord;

const tableNames: DynamoDbInvoiceRepositoryTableNames = {
  invoicesTableName: 'unified-invoice-test-invoices',
};

const options: DynamoDbInvoiceRepositoryOptions = {
  tableNames,
  ownerId: 'test-owner',
};

const factory: (options: DynamoDbInvoiceRepositoryOptions) => InvoiceRepository =
  createDynamoDbInvoiceRepository;
const repository: InvoiceRepository = createDynamoDbInvoiceRepository(options);

// @ts-expect-error ownerId is required
const missingOwnerId: DynamoDbInvoiceRepositoryOptions = { tableNames };

// @ts-expect-error tableNames is required
const missingTableNames: DynamoDbInvoiceRepositoryOptions = { ownerId: 'test-owner' };

// @ts-expect-error invoicesTableName is required
const missingInvoicesTableName: DynamoDbInvoiceRepositoryTableNames = {};

// @ts-expect-error ownerId must be a string
const invalidOwnerId: DynamoDbInvoiceRepositoryOptions = { tableNames, ownerId: 123 };

// @ts-expect-error raw StoredInvoiceRecord writes are not part of InvoiceRepository
repository.putRecord(storedRecord);

void tableNames;
void options;
void factory;
void repository;
void missingOwnerId;
void missingTableNames;
void missingInvoicesTableName;
void invalidOwnerId;
