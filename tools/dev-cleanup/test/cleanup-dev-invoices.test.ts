import { BatchWriteCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { describe, expect, it } from 'vitest';

import { cleanupDevInvoices, parseArgs } from '../src';

type Item = Record<string, unknown>;

const keyOf = (item: Item): string => `${String(item.PK)}|${String(item.SK)}`;
const clone = <T>(value: T): T => structuredClone(value);

class FakeDocumentClient {
  readonly commands: unknown[] = [];
  private items = new Map<string, Item>();

  constructor(items: readonly Item[] = []) {
    for (const item of items) this.items.set(keyOf(item), clone(item));
  }

  get count(): number {
    return this.items.size;
  }

  async send(command: unknown): Promise<Record<string, unknown>> {
    this.commands.push(command);

    if (command instanceof QueryCommand) {
      const ownerKey = command.input.ExpressionAttributeValues?.[':ownerKey'];
      const prefix = command.input.ExpressionAttributeValues?.[':prefix'];
      const items = [...this.items.values()].filter(
        (item) =>
          item.PK === ownerKey &&
          typeof item.SK === 'string' &&
          typeof prefix === 'string' &&
          item.SK.startsWith(prefix),
      );
      return { Items: clone(items) };
    }

    if (command instanceof BatchWriteCommand) {
      for (const requests of Object.values(command.input.RequestItems ?? {})) {
        for (const request of requests) {
          const key = request.DeleteRequest?.Key;
          if (key !== undefined) this.items.delete(keyOf(key));
        }
      }
      return {};
    }

    throw new Error('Unexpected command.');
  }
}

const records = [
  { PK: 'OWNER#owner-a', SK: 'INVOICE#draft-1' },
  { PK: 'OWNER#owner-a', SK: 'INVOICE#voided-1' },
  { PK: 'OWNER#owner-a', SK: 'INVOICE_NUMBER#INV-001' },
  { PK: 'OWNER#owner-b', SK: 'INVOICE#other-owner' },
  { PK: 'OWNER#owner-a', SK: 'OTHER#ignored' },
];

describe('dev cleanup utility', () => {
  it('parses dry-run by default without requiring delete confirmation', () => {
    expect(parseArgs(['--environment', 'dev', '--owner-id', 'owner-a'])).toEqual({
      environment: 'dev',
      ownerId: 'owner-a',
      confirmDelete: false,
      dryRun: false,
    });
  });

  it('rejects non-dev environments', async () => {
    await expect(
      cleanupDevInvoices({
        client: new FakeDocumentClient() as never,
        environment: 'prod',
        ownerId: 'owner-a',
      }),
    ).rejects.toThrow('environment=dev');
  });

  it('rejects missing owner IDs', async () => {
    await expect(
      cleanupDevInvoices({
        client: new FakeDocumentClient() as never,
        environment: 'dev',
        ownerId: ' ',
      }),
    ).rejects.toThrow('ownerId is required');
  });

  it('rejects production-looking table names', async () => {
    await expect(
      cleanupDevInvoices({
        client: new FakeDocumentClient() as never,
        environment: 'dev',
        ownerId: 'owner-a',
        tableName: 'unified-invoice-production-invoices',
      }),
    ).rejects.toThrow('dev naming pattern');
  });

  it('queries owner partition prefixes without table scans', async () => {
    const fake = new FakeDocumentClient(records);

    await cleanupDevInvoices({
      client: fake as never,
      environment: 'dev',
      ownerId: 'owner-a',
    });

    expect(fake.commands).toHaveLength(2);
    expect(fake.commands.every((command) => command instanceof QueryCommand)).toBe(true);
    for (const command of fake.commands) {
      if (!(command instanceof QueryCommand)) throw new Error('Expected query command.');
      expect(command.input.KeyConditionExpression).toContain('#pk = :ownerKey');
      expect(command.input.KeyConditionExpression).toContain('begins_with(#sk, :prefix)');
    }
  });

  it('dry-runs by default and returns matching counts without deletes', async () => {
    const fake = new FakeDocumentClient(records);

    const result = await cleanupDevInvoices({
      client: fake as never,
      environment: 'dev',
      ownerId: 'owner-a',
    });

    expect(result).toMatchObject({
      mode: 'dry-run',
      count: 3,
      invoiceCount: 2,
      reservationCount: 1,
      deletedCount: 0,
    });
    expect(fake.count).toBe(records.length);
    expect(fake.commands.some((command) => command instanceof BatchWriteCommand)).toBe(false);
  });

  it('confirmed delete removes invoice and reservation records for one owner', async () => {
    const fake = new FakeDocumentClient(records);

    const result = await cleanupDevInvoices({
      client: fake as never,
      environment: 'dev',
      ownerId: 'owner-a',
      confirmDelete: true,
    });

    expect(result).toMatchObject({ mode: 'delete', count: 3, deletedCount: 3 });
    expect(fake.count).toBe(2);
    expect(fake.commands.some((command) => command instanceof BatchWriteCommand)).toBe(true);
  });

  it('batches deletes for larger owner partitions', async () => {
    const many = Array.from({ length: 27 }, (_, index) => ({
      PK: 'OWNER#owner-a',
      SK: `INVOICE#${String(index).padStart(2, '0')}`,
    }));
    const fake = new FakeDocumentClient(many);

    const result = await cleanupDevInvoices({
      client: fake as never,
      environment: 'dev',
      ownerId: 'owner-a',
      confirmDelete: true,
    });

    const batches = fake.commands.filter((command) => command instanceof BatchWriteCommand);
    expect(result.deletedCount).toBe(27);
    expect(batches).toHaveLength(2);
    expect(fake.count).toBe(0);
  });

  it('keeps dry-run mode when dry-run and confirm-delete are both present', async () => {
    const fake = new FakeDocumentClient(records);

    const result = await cleanupDevInvoices({
      client: fake as never,
      environment: 'dev',
      ownerId: 'owner-a',
      dryRun: true,
      confirmDelete: true,
    });

    expect(result.mode).toBe('dry-run');
    expect(fake.count).toBe(records.length);
  });
});
