import {
  BatchWriteCommand,
  QueryCommand,
  type DynamoDBDocumentClient,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';

type DynamoItem = Record<string, unknown>;

export type CleanupMode = 'dry-run' | 'delete';

export type CleanupOptions = Readonly<{
  client: Pick<DynamoDBDocumentClient, 'send'>;
  environment: string;
  ownerId: string;
  tableName?: string;
  confirmDelete?: boolean;
  dryRun?: boolean;
}>;

export type CleanupRecord = Readonly<{
  pk: string;
  sk: string;
  kind: 'invoice' | 'invoiceNumberReservation';
}>;

export type CleanupResult = Readonly<{
  mode: CleanupMode;
  tableName: string;
  ownerKey: string;
  count: number;
  invoiceCount: number;
  reservationCount: number;
  deletedCount: number;
  records: readonly CleanupRecord[];
}>;

const DEFAULT_DEV_TABLE = 'unified-invoice-dev-invoices';
const OWNER_PREFIX = 'OWNER#';
const INVOICE_PREFIX = 'INVOICE#';
const RESERVATION_PREFIX = 'INVOICE_NUMBER#';
const BATCH_WRITE_LIMIT = 25;

const ensureSafeEnvironment = (environment: string): void => {
  if (environment !== 'dev') {
    throw new Error('Cleanup is restricted to environment=dev.');
  }
};

const ensureOwnerId = (ownerId: string): void => {
  if (ownerId.trim().length === 0) {
    throw new Error('ownerId is required.');
  }
};

const ensureSafeDevTable = (tableName: string): void => {
  const normalized = tableName.toLowerCase();
  if (!normalized.includes('-dev-')) {
    throw new Error('Cleanup table name must match the dev naming pattern.');
  }
  if (normalized.includes('prod') || normalized.includes('production')) {
    throw new Error('Cleanup refuses production-looking table names.');
  }
};

const recordKind = (sk: string): CleanupRecord['kind'] | undefined => {
  if (sk.startsWith(RESERVATION_PREFIX)) return 'invoiceNumberReservation';
  if (sk.startsWith(INVOICE_PREFIX)) return 'invoice';
  return undefined;
};

const toCleanupRecord = (item: DynamoItem): CleanupRecord | undefined => {
  if (typeof item.PK !== 'string' || typeof item.SK !== 'string') return undefined;
  const kind = recordKind(item.SK);
  if (kind === undefined) return undefined;
  return Object.freeze({ pk: item.PK, sk: item.SK, kind });
};

const queryPrefix = async (
  client: Pick<DynamoDBDocumentClient, 'send'>,
  tableName: string,
  ownerKey: string,
  prefix: string,
): Promise<CleanupRecord[]> => {
  const records: CleanupRecord[] = [];
  let exclusiveStartKey: QueryCommandInput['ExclusiveStartKey'];

  do {
    const input: QueryCommandInput = {
      TableName: tableName,
      KeyConditionExpression: '#pk = :ownerKey AND begins_with(#sk, :prefix)',
      ExpressionAttributeNames: { '#pk': 'PK', '#sk': 'SK' },
      ExpressionAttributeValues: { ':ownerKey': ownerKey, ':prefix': prefix },
    };
    if (exclusiveStartKey !== undefined) input.ExclusiveStartKey = exclusiveStartKey;

    const output = await client.send(new QueryCommand(input));

    for (const item of output.Items ?? []) {
      const record = toCleanupRecord(item);
      if (record !== undefined) records.push(record);
    }
    exclusiveStartKey = output.LastEvaluatedKey;
  } while (exclusiveStartKey !== undefined);

  return records;
};

const chunk = <T>(items: readonly T[], size: number): readonly (readonly T[])[] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push([...items.slice(index, index + size)]);
  }
  return chunks;
};

const deleteRecords = async (
  client: Pick<DynamoDBDocumentClient, 'send'>,
  tableName: string,
  records: readonly CleanupRecord[],
): Promise<number> => {
  let deleted = 0;
  for (const batch of chunk(records, BATCH_WRITE_LIMIT)) {
    await client.send(
      new BatchWriteCommand({
        RequestItems: {
          [tableName]: batch.map((record) => ({
            DeleteRequest: { Key: { PK: record.pk, SK: record.sk } },
          })),
        },
      }),
    );
    deleted += batch.length;
  }
  return deleted;
};

export const cleanupDevInvoices = async (options: CleanupOptions): Promise<CleanupResult> => {
  ensureSafeEnvironment(options.environment);
  ensureOwnerId(options.ownerId);

  const tableName = options.tableName ?? DEFAULT_DEV_TABLE;
  ensureSafeDevTable(tableName);

  const ownerKey = `${OWNER_PREFIX}${options.ownerId}`;
  const records = [
    ...(await queryPrefix(options.client, tableName, ownerKey, INVOICE_PREFIX)),
    ...(await queryPrefix(options.client, tableName, ownerKey, RESERVATION_PREFIX)),
  ].sort((left, right) => left.sk.localeCompare(right.sk));

  const mode: CleanupMode =
    options.confirmDelete === true && options.dryRun !== true ? 'delete' : 'dry-run';
  const deletedCount =
    mode === 'delete' ? await deleteRecords(options.client, tableName, records) : 0;

  return Object.freeze({
    mode,
    tableName,
    ownerKey,
    count: records.length,
    invoiceCount: records.filter((record) => record.kind === 'invoice').length,
    reservationCount: records.filter((record) => record.kind === 'invoiceNumberReservation').length,
    deletedCount,
    records: Object.freeze(records),
  });
};

export const defaultDevTableName = DEFAULT_DEV_TABLE;
