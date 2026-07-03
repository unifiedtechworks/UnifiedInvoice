import type { InvoiceRepository } from '@invoice/invoice-repository';

export type DynamoDbInvoiceRepositoryTableNames = Readonly<{
  invoicesTableName: string;
}>;

export type DynamoDbInvoiceRepositoryOptions = Readonly<{
  tableNames: DynamoDbInvoiceRepositoryTableNames;
  ownerId: string;
}>;

const scaffoldMessage =
  'createDynamoDbInvoiceRepository is scaffolded but not implemented. Task 011B will add DynamoDB persistence behavior.';

export const createDynamoDbInvoiceRepository = (
  _options: DynamoDbInvoiceRepositoryOptions,
): InvoiceRepository => {
  throw new Error(scaffoldMessage);
};
