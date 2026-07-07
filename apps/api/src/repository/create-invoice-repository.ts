import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { InvoiceRepository } from '@invoice/invoice-repository';
import { createDynamoDbInvoiceRepository } from '@invoice/invoice-repository-dynamodb';

export type InvoiceRepositoryFactory = (ownerId: string) => InvoiceRepository;

declare const process: Readonly<{ env: Readonly<Record<string, string | undefined>> }>;

const dynamoDbClient = new DynamoDBClient({});
const documentClient = DynamoDBDocumentClient.from(dynamoDbClient);

export const createInvoiceRepository: InvoiceRepositoryFactory = (ownerId) => {
  const invoicesTableName = process.env.INVOICES_TABLE_NAME;

  if (invoicesTableName === undefined || invoicesTableName.trim().length === 0) {
    throw new Error('INVOICES_TABLE_NAME must be configured.');
  }

  return createDynamoDbInvoiceRepository({
    client: documentClient,
    ownerId,
    tableNames: { invoicesTableName },
  });
};
