import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type {
  InvoiceListResult,
  InvoiceListQuery,
  InvoiceRecordVersion,
  InvoiceRepository,
  InvoiceRepositoryResult,
  StoredInvoiceRecord,
} from '@invoice/invoice-repository';

import {
  createDynamoDbInvoiceRepository,
  type DynamoDbInvoiceRepositoryOptions,
  type DynamoDbInvoiceRepositoryTableNames,
} from '../src';

declare const client: DynamoDBDocumentClient;
declare const generatedVersion: InvoiceRecordVersion;
declare const storedRecord: StoredInvoiceRecord;

const tableNames: DynamoDbInvoiceRepositoryTableNames = {
  invoicesTableName: 'unified-invoice-test-invoices',
};
const options: DynamoDbInvoiceRepositoryOptions = {
  tableNames,
  ownerId: 'test-owner',
  client,
  generateVersion: () => generatedVersion,
};
const factory: (options: DynamoDbInvoiceRepositoryOptions) => InvoiceRepository =
  createDynamoDbInvoiceRepository;
const repository: InvoiceRepository = createDynamoDbInvoiceRepository(options);
const validListQuery: InvoiceListQuery = {
  kind: 'finalized',
  search: 'INV-1001',
  sortBy: 'invoiceNumber',
  sortDirection: 'asc',
  pageSize: 25,
  cursor: 'offset:25',
};
const listResult: Promise<InvoiceRepositoryResult<InvoiceListResult>> =
  repository.list(validListQuery);

// @ts-expect-error list rejects invalid lifecycle kinds
const invalidListKind = repository.list({ kind: 'paid' });
// @ts-expect-error list rejects unsupported sort fields
const invalidListSortBy = repository.list({ sortBy: 'total' });
// @ts-expect-error list rejects unsupported sort directions
const invalidListSortDirection = repository.list({ sortDirection: 'ascending' });

// @ts-expect-error client is required
const missingClient: DynamoDbInvoiceRepositoryOptions = { tableNames, ownerId: 'test-owner' };
// @ts-expect-error ownerId is required
const missingOwnerId: DynamoDbInvoiceRepositoryOptions = { tableNames, client };
// @ts-expect-error tableNames is required
const missingTableNames: DynamoDbInvoiceRepositoryOptions = { ownerId: 'test-owner', client };
// @ts-expect-error invoicesTableName is required
const missingInvoicesTableName: DynamoDbInvoiceRepositoryTableNames = {};
// @ts-expect-error raw StoredInvoiceRecord writes are not part of InvoiceRepository
repository.putRecord(storedRecord);

void options;
void factory;
void repository;
void validListQuery;
void listResult;
void invalidListKind;
void invalidListSortBy;
void invalidListSortDirection;
void missingClient;
void missingOwnerId;
void missingTableNames;
void missingInvoicesTableName;
