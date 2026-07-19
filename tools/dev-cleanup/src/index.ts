import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cleanupDevInvoices, defaultDevTableName } from './cleanup-dev-invoices';

type ParsedArgs = Readonly<{
  environment?: string;
  ownerId?: string;
  tableName?: string;
  confirmDelete: boolean;
  dryRun: boolean;
}>;

const readValue = (args: readonly string[], index: number, flag: string): string => {
  const value = args[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`);
  }
  return value;
};

export const parseArgs = (args: readonly string[]): ParsedArgs => {
  const parsed: {
    environment?: string;
    ownerId?: string;
    tableName?: string;
    confirmDelete: boolean;
    dryRun: boolean;
  } = { confirmDelete: false, dryRun: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--environment':
        parsed.environment = readValue(args, index, arg);
        index += 1;
        break;
      case '--owner-id':
        parsed.ownerId = readValue(args, index, arg);
        index += 1;
        break;
      case '--table-name':
        parsed.tableName = readValue(args, index, arg);
        index += 1;
        break;
      case '--confirm-delete':
        parsed.confirmDelete = true;
        break;
      case '--dry-run':
        parsed.dryRun = true;
        break;
      default:
        throw new Error(`Unsupported argument: ${String(arg)}`);
    }
  }

  return parsed;
};

export const run = async (args: readonly string[] = process.argv.slice(2)): Promise<void> => {
  const parsed = parseArgs(args);
  const environment = parsed.environment ?? 'dev';
  const tableName = parsed.tableName ?? defaultDevTableName;
  const ownerId = parsed.ownerId;
  if (ownerId === undefined) throw new Error('--owner-id is required.');

  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const result = await cleanupDevInvoices({
    client,
    environment,
    ownerId,
    tableName,
    confirmDelete: parsed.confirmDelete,
    dryRun: parsed.dryRun,
  });

  console.log(
    JSON.stringify(
      {
        mode: result.mode,
        tableName: result.tableName,
        ownerKey: result.ownerKey,
        count: result.count,
        invoiceCount: result.invoiceCount,
        reservationCount: result.reservationCount,
        deletedCount: result.deletedCount,
      },
      null,
      2,
    ),
  );

  if (result.mode === 'dry-run') {
    console.log('Dry run only. Re-run with --confirm-delete to delete these dev records.');
  }
};

if (fileURLToPath(import.meta.url) === resolve(process.argv[1] ?? '')) {
  run().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export { cleanupDevInvoices } from './cleanup-dev-invoices';
export type { CleanupOptions, CleanupRecord, CleanupResult } from './cleanup-dev-invoices';
