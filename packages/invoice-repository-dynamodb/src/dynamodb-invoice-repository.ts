import { parseInvoiceId, type InvoiceId, type InvoiceNumber } from '@invoice/domain';
import {
  serializeFinalizedInvoice,
  type DraftInvoice,
  type FinalizedInvoice,
  type Invoice,
  type VoidedInvoice,
} from '@invoice/invoice-domain';
import {
  DeleteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  TransactWriteCommand,
  type DynamoDBDocumentClient,
  type QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import {
  isInvoiceRecordVersion,
  makeInvoiceRepositoryError,
  repoErr,
  repoOk,
  type DiscardDraftOptions,
  type DiscardDraftResult,
  type GetInvoiceResult,
  type InvoiceRecordVersion,
  type InvoiceRepository,
  type InvoiceRepositoryResult,
  type InvoiceListItem,
  type InvoiceListQuery,
  type InvoiceListResult,
  type InvoiceListSortBy,
  type SaveFinalizedInvoiceOptions,
  type SaveInvoiceResult,
  type SaveVoidedInvoiceOptions,
  type StoredInvoiceRecord,
  type UpdateInvoiceOptions,
} from '@invoice/invoice-repository';

import {
  canonicalSerializedJson,
  parseStoredInvoiceRecord,
  toStoredDraftInvoiceRecord,
  toStoredFinalizedInvoiceRecord,
  toStoredVoidedInvoiceRecord,
} from './record-mapper';

export type DynamoDbInvoiceRepositoryTableNames = Readonly<{
  invoicesTableName: string;
}>;

export type DynamoDbInvoiceRepositoryOptions = Readonly<{
  tableNames: DynamoDbInvoiceRepositoryTableNames;
  ownerId: string;
  client: DynamoDBDocumentClient;
  generateVersion?: () => InvoiceRecordVersion;
}>;

type InvoiceItem = Readonly<{
  PK: string;
  SK: string;
  entityType: 'invoice';
  ownerId: string;
  invoiceId: string;
  record: StoredInvoiceRecord;
  kind: StoredInvoiceRecord['kind'];
  version: InvoiceRecordVersion;
  createdAt: string;
  updatedAt: string;
  GSI1PK: string;
  GSI1SK: string;
  invoiceNumber?: InvoiceNumber;
  customerDisplayName?: string;
  issueDate?: string;
  dueDate?: string;
  finalizedAt?: string;
  voidedAt?: string;
}>;

type ReservationItem = Readonly<{
  PK: string;
  SK: string;
  entityType: 'invoiceNumberReservation';
  ownerId: string;
  invoiceId: string;
  invoiceNumber: string;
}>;

type LoadedInvoice = Readonly<{
  record: StoredInvoiceRecord;
  invoice: Invoice;
  version: InvoiceRecordVersion;
}>;

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

const invalidInvoiceRecord = (message: string, path?: string) =>
  repoErr(
    makeInvoiceRepositoryError('invalid_invoice_record', message, {
      ...(path === undefined ? {} : { path }),
    }),
  );

const invariantViolation = (message: string, path?: string) =>
  repoErr(
    makeInvoiceRepositoryError('repository_invariant_violation', message, {
      ...(path === undefined ? {} : { path }),
    }),
  );

const invoiceNotFound = (id: InvoiceId) =>
  repoErr(makeInvoiceRepositoryError('invoice_not_found', `Invoice ${String(id)} was not found.`));

const invoiceConflict = (message: string) =>
  repoErr(makeInvoiceRepositoryError('invoice_conflict', message));

const invoiceNumberConflict = (invoiceNumber: InvoiceNumber) =>
  repoErr(
    makeInvoiceRepositoryError(
      'invoice_number_conflict',
      `Invoice number ${String(invoiceNumber)} is already assigned to another invoice.`,
      { path: 'invoiceNumber' },
    ),
  );

const repositoryUnavailable = (error: unknown) =>
  repoErr(
    makeInvoiceRepositoryError(
      'repository_unavailable',
      'The DynamoDB invoice repository operation failed.',
      { detail: error instanceof Error ? error.name : 'UnknownError' },
    ),
  );

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNamedError = (error: unknown, name: string): boolean =>
  isObjectRecord(error) && error.name === name;

const defaultGenerateVersion = (): InvoiceRecordVersion =>
  `v${globalThis.crypto.randomUUID()}` as InvoiceRecordVersion;

const validateNonEmpty = (value: string, name: string): void => {
  if (value.trim().length === 0) throw new TypeError(`${name} must be a non-empty string.`);
};

const parsePageSize = (pageSize: number | undefined): InvoiceRepositoryResult<number> => {
  if (pageSize === undefined) return repoOk(DEFAULT_PAGE_SIZE);
  if (!Number.isSafeInteger(pageSize))
    return invariantViolation('List pageSize must be a safe integer from 1 to 100.', 'pageSize');
  if (pageSize < 1)
    return invariantViolation('List pageSize must be greater than zero.', 'pageSize');
  if (pageSize > MAX_PAGE_SIZE)
    return invariantViolation('List pageSize must be no greater than 100.', 'pageSize');
  return repoOk(pageSize);
};

const parseCursorOffset = (cursor: string | undefined): InvoiceRepositoryResult<number> => {
  if (cursor === undefined) return repoOk(0);
  const match = /^offset:(\d+)$/u.exec(cursor);
  if (match?.[1] === undefined)
    return invariantViolation(
      'List cursor must use offset:<non-negative integer> format.',
      'cursor',
    );
  const offset = Number(match[1]);
  if (!Number.isSafeInteger(offset))
    return invariantViolation('List cursor offset must be a safe integer.', 'cursor');
  return repoOk(offset);
};

const toInvoiceListItem = (record: StoredInvoiceRecord): InvoiceListItem =>
  Object.freeze({
    id: record.id,
    kind: record.kind,
    version: record.version,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    ...(record.invoiceNumber === undefined ? {} : { invoiceNumber: record.invoiceNumber }),
    ...(record.customerDisplayName === undefined
      ? {}
      : { customerDisplayName: record.customerDisplayName }),
    ...(record.issueDate === undefined ? {} : { issueDate: record.issueDate }),
    ...(record.dueDate === undefined ? {} : { dueDate: record.dueDate }),
    ...(record.finalizedAt === undefined ? {} : { finalizedAt: record.finalizedAt }),
    ...(record.voidedAt === undefined ? {} : { voidedAt: record.voidedAt }),
  });

const sortValue = (record: StoredInvoiceRecord, sortBy: InvoiceListSortBy): string | undefined => {
  switch (sortBy) {
    case 'updatedAt':
      return record.updatedAt;
    case 'createdAt':
      return record.createdAt;
    case 'issueDate':
      return record.issueDate;
    case 'invoiceNumber':
      return record.invoiceNumber;
  }
};

const compareRecords = (
  left: StoredInvoiceRecord,
  right: StoredInvoiceRecord,
  query: Required<Pick<InvoiceListQuery, 'sortBy' | 'sortDirection'>>,
): number => {
  const leftValue = sortValue(left, query.sortBy);
  const rightValue = sortValue(right, query.sortBy);
  if (leftValue !== undefined && rightValue === undefined) return -1;
  if (leftValue === undefined && rightValue !== undefined) return 1;
  if (leftValue !== undefined && rightValue !== undefined && leftValue !== rightValue) {
    const primary = leftValue < rightValue ? -1 : 1;
    return query.sortDirection === 'asc' ? primary : -primary;
  }
  const leftId = String(left.id);
  const rightId = String(right.id);
  if (leftId !== rightId) return leftId < rightId ? -1 : 1;
  if (left.version === right.version) return 0;
  return left.version < right.version ? -1 : 1;
};

export const createDynamoDbInvoiceRepository = (
  options: DynamoDbInvoiceRepositoryOptions,
): InvoiceRepository => {
  validateNonEmpty(options.tableNames.invoicesTableName, 'invoicesTableName');
  validateNonEmpty(options.ownerId, 'ownerId');
  if (typeof options.client?.send !== 'function')
    throw new TypeError('client must be a DynamoDBDocumentClient.');

  const tableName = options.tableNames.invoicesTableName;
  const ownerId = options.ownerId;
  const ownerKey = `OWNER#${ownerId}`;
  const generateVersion = options.generateVersion ?? defaultGenerateVersion;
  const invoiceKey = (id: InvoiceId) => ({ PK: ownerKey, SK: `INVOICE#${String(id)}` });
  const reservationKey = (invoiceNumber: InvoiceNumber) => ({
    PK: ownerKey,
    SK: `INVOICE_NUMBER#${String(invoiceNumber)}`,
  });

  const nextVersion = (): InvoiceRepositoryResult<InvoiceRecordVersion> => {
    const version = generateVersion();
    if (!isInvoiceRecordVersion(version))
      return repoErr(
        makeInvoiceRepositoryError(
          'invalid_invoice_record_version',
          'Generated invoice record version is invalid.',
        ),
      );
    return repoOk(version);
  };

  const toInvoiceItem = (record: StoredInvoiceRecord): InvoiceItem =>
    Object.freeze({
      ...invoiceKey(record.id),
      entityType: 'invoice',
      ownerId,
      invoiceId: String(record.id),
      record,
      kind: record.kind,
      version: record.version,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      GSI1PK: ownerKey,
      GSI1SK: `UPDATED#${String(record.updatedAt)}#${String(record.id)}`,
      ...(record.invoiceNumber === undefined ? {} : { invoiceNumber: record.invoiceNumber }),
      ...(record.customerDisplayName === undefined
        ? {}
        : { customerDisplayName: record.customerDisplayName }),
      ...(record.issueDate === undefined ? {} : { issueDate: record.issueDate }),
      ...(record.dueDate === undefined ? {} : { dueDate: record.dueDate }),
      ...(record.finalizedAt === undefined ? {} : { finalizedAt: record.finalizedAt }),
      ...(record.voidedAt === undefined ? {} : { voidedAt: record.voidedAt }),
    });

  const parseInvoiceItem = (
    value: unknown,
    expectedId: InvoiceId,
  ): InvoiceRepositoryResult<LoadedInvoice> => {
    if (!isObjectRecord(value) || value.entityType !== 'invoice' || !isObjectRecord(value.record))
      return invalidInvoiceRecord('DynamoDB invoice item shape is invalid.');
    if (value.PK !== ownerKey || value.SK !== `INVOICE#${String(expectedId)}`)
      return invariantViolation('DynamoDB invoice item key does not match the requested invoice.');
    if (value.ownerId !== ownerId || value.invoiceId !== String(expectedId))
      return invariantViolation('DynamoDB invoice item ownership or ID metadata is inconsistent.');

    const parsed = parseStoredInvoiceRecord(value.record);
    if (!parsed.ok) return parsed;
    const record = parsed.value.record;
    if (record.id !== expectedId)
      return invariantViolation('Stored record ID does not match its DynamoDB key.', 'record.id');
    const metadataKeys = [
      'kind',
      'version',
      'createdAt',
      'updatedAt',
      'invoiceNumber',
      'customerDisplayName',
      'issueDate',
      'dueDate',
      'finalizedAt',
      'voidedAt',
    ] as const;
    for (const key of metadataKeys) {
      if (value[key] !== record[key])
        return invariantViolation(`DynamoDB item ${key} must match its stored record.`, key);
    }
    if (value.GSI1PK !== ownerKey)
      return invariantViolation('DynamoDB item GSI1PK is inconsistent.', 'GSI1PK');
    if (value.GSI1SK !== `UPDATED#${String(record.updatedAt)}#${String(record.id)}`)
      return invariantViolation('DynamoDB item GSI1SK is inconsistent.', 'GSI1SK');
    return repoOk(
      Object.freeze({
        record,
        invoice: parsed.value.invoice,
        version: record.version,
      }),
    );
  };

  const readInvoice = async (id: InvoiceId): Promise<InvoiceRepositoryResult<LoadedInvoice>> => {
    try {
      const output = await options.client.send(
        new GetCommand({ TableName: tableName, Key: invoiceKey(id), ConsistentRead: true }),
      );
      if (output.Item === undefined) return invoiceNotFound(id);
      return parseInvoiceItem(output.Item, id);
    } catch (error) {
      return repositoryUnavailable(error);
    }
  };

  const readReservation = async (
    invoiceNumber: InvoiceNumber,
  ): Promise<InvoiceRepositoryResult<ReservationItem | undefined>> => {
    try {
      const output = await options.client.send(
        new GetCommand({
          TableName: tableName,
          Key: reservationKey(invoiceNumber),
          ConsistentRead: true,
        }),
      );
      if (output.Item === undefined) return repoOk(undefined);
      if (
        !isObjectRecord(output.Item) ||
        output.Item.entityType !== 'invoiceNumberReservation' ||
        output.Item.PK !== ownerKey ||
        output.Item.SK !== `INVOICE_NUMBER#${String(invoiceNumber)}` ||
        output.Item.ownerId !== ownerId ||
        typeof output.Item.invoiceId !== 'string' ||
        output.Item.invoiceNumber !== String(invoiceNumber)
      )
        return invariantViolation('Invoice-number reservation item is invalid.');
      return repoOk(output.Item as unknown as ReservationItem);
    } catch (error) {
      return repositoryUnavailable(error);
    }
  };

  const queryInvoiceRecords = async (): Promise<
    InvoiceRepositoryResult<readonly StoredInvoiceRecord[]>
  > => {
    const records: StoredInvoiceRecord[] = [];
    let exclusiveStartKey: QueryCommandInput['ExclusiveStartKey'];
    try {
      do {
        const output = await options.client.send(
          new QueryCommand({
            TableName: tableName,
            KeyConditionExpression: '#pk = :ownerKey AND begins_with(#sk, :invoicePrefix)',
            ExpressionAttributeNames: { '#pk': 'PK', '#sk': 'SK' },
            ExpressionAttributeValues: { ':ownerKey': ownerKey, ':invoicePrefix': 'INVOICE#' },
            ...(exclusiveStartKey === undefined ? {} : { ExclusiveStartKey: exclusiveStartKey }),
          }),
        );
        for (const item of output.Items ?? []) {
          if (!isObjectRecord(item) || typeof item.invoiceId !== 'string')
            return invalidInvoiceRecord('DynamoDB invoice item shape is invalid.');
          const parsedId = parseInvoiceId(item.invoiceId);
          if (!parsedId.ok)
            return invalidInvoiceRecord('DynamoDB invoice item ID is invalid.', 'invoiceId');
          const parsedItem = parseInvoiceItem(item, parsedId.value);
          if (!parsedItem.ok) return parsedItem;
          records.push(parsedItem.value.record);
        }
        exclusiveStartKey = output.LastEvaluatedKey;
      } while (exclusiveStartKey !== undefined);
      return repoOk(Object.freeze(records));
    } catch (error) {
      return repositoryUnavailable(error);
    }
  };

  const saveResult = (record: StoredInvoiceRecord): InvoiceRepositoryResult<SaveInvoiceResult> => {
    const parsed = parseStoredInvoiceRecord(record);
    if (!parsed.ok) return parsed;
    return repoOk(Object.freeze({ invoice: parsed.value.invoice, version: record.version }));
  };

  return Object.freeze({
    async createDraft(invoice: DraftInvoice): Promise<InvoiceRepositoryResult<SaveInvoiceResult>> {
      if (invoice.kind !== 'draft')
        return invalidInvoiceRecord('createDraft only accepts draft invoices.', 'kind');
      const version = nextVersion();
      if (!version.ok) return version;
      const record = toStoredDraftInvoiceRecord(invoice, version.value);
      const validated = saveResult(record);
      if (!validated.ok) return validated;
      try {
        await options.client.send(
          new PutCommand({
            TableName: tableName,
            Item: toInvoiceItem(record),
            ConditionExpression: 'attribute_not_exists(#pk)',
            ExpressionAttributeNames: { '#pk': 'PK' },
          }),
        );
        return validated;
      } catch (error) {
        if (isNamedError(error, 'ConditionalCheckFailedException'))
          return repoErr(
            makeInvoiceRepositoryError(
              'invoice_already_exists',
              `Invoice ${String(invoice.id)} already exists.`,
            ),
          );
        return repositoryUnavailable(error);
      }
    },

    async updateDraft(
      invoice: DraftInvoice,
      updateOptions: UpdateInvoiceOptions,
    ): Promise<InvoiceRepositoryResult<SaveInvoiceResult>> {
      if (invoice.kind !== 'draft')
        return invalidInvoiceRecord('updateDraft only accepts draft invoices.', 'kind');
      const existing = await readInvoice(invoice.id);
      if (!existing.ok) return existing;
      if (existing.value.record.kind !== 'draft')
        return invoiceConflict('Only draft invoices can be updated.');
      if (existing.value.version !== updateOptions.expectedVersion)
        return invoiceConflict('Invoice record version conflict.');
      const version = nextVersion();
      if (!version.ok) return version;
      const record = toStoredDraftInvoiceRecord(invoice, version.value);
      const validated = saveResult(record);
      if (!validated.ok) return validated;
      try {
        await options.client.send(
          new PutCommand({
            TableName: tableName,
            Item: toInvoiceItem(record),
            ConditionExpression:
              '#record.#version = :expectedVersion AND #record.#kind = :expectedKind',
            ExpressionAttributeNames: {
              '#record': 'record',
              '#version': 'version',
              '#kind': 'kind',
            },
            ExpressionAttributeValues: {
              ':expectedVersion': updateOptions.expectedVersion,
              ':expectedKind': 'draft',
            },
          }),
        );
        return validated;
      } catch (error) {
        if (isNamedError(error, 'ConditionalCheckFailedException'))
          return invoiceConflict('Invoice record version conflict.');
        return repositoryUnavailable(error);
      }
    },

    async saveFinalized(
      invoice: FinalizedInvoice,
      saveOptions: SaveFinalizedInvoiceOptions,
    ): Promise<InvoiceRepositoryResult<SaveInvoiceResult>> {
      if (invoice.kind !== 'finalized')
        return invalidInvoiceRecord('saveFinalized only accepts finalized invoices.', 'kind');
      const existing = await readInvoice(invoice.id);
      if (!existing.ok) return existing;
      if (existing.value.version !== saveOptions.expectedVersion)
        return invoiceConflict('Invoice record version conflict.');
      if (existing.value.record.kind === 'voided')
        return invoiceConflict('Voided invoices cannot be finalized.');
      if (existing.value.record.kind === 'finalized') {
        if (
          canonicalSerializedJson(existing.value.record.invoice) ===
          canonicalSerializedJson(serializeFinalizedInvoice(invoice))
        )
          return repoOk(
            Object.freeze({ invoice: existing.value.invoice, version: existing.value.version }),
          );
        return invoiceConflict('Finalized invoice payload differs from existing record.');
      }

      const reservation = await readReservation(invoice.invoiceNumber);
      if (!reservation.ok) return reservation;
      if (reservation.value !== undefined && reservation.value.invoiceId !== String(invoice.id))
        return invoiceNumberConflict(invoice.invoiceNumber);
      const version = nextVersion();
      if (!version.ok) return version;
      const record = toStoredFinalizedInvoiceRecord(invoice, version.value);
      const validated = saveResult(record);
      if (!validated.ok) return validated;
      const numberItem: ReservationItem = Object.freeze({
        ...reservationKey(invoice.invoiceNumber),
        entityType: 'invoiceNumberReservation',
        ownerId,
        invoiceId: String(invoice.id),
        invoiceNumber: String(invoice.invoiceNumber),
      });
      try {
        await options.client.send(
          new TransactWriteCommand({
            TransactItems: [
              {
                Put: {
                  TableName: tableName,
                  Item: numberItem,
                  ConditionExpression: 'attribute_not_exists(#pk) OR #invoiceId = :invoiceId',
                  ExpressionAttributeNames: { '#pk': 'PK', '#invoiceId': 'invoiceId' },
                  ExpressionAttributeValues: { ':invoiceId': String(invoice.id) },
                },
              },
              {
                Put: {
                  TableName: tableName,
                  Item: toInvoiceItem(record),
                  ConditionExpression:
                    '#record.#version = :expectedVersion AND #record.#kind = :expectedKind',
                  ExpressionAttributeNames: {
                    '#record': 'record',
                    '#version': 'version',
                    '#kind': 'kind',
                  },
                  ExpressionAttributeValues: {
                    ':expectedVersion': saveOptions.expectedVersion,
                    ':expectedKind': 'draft',
                  },
                },
              },
            ],
          }),
        );
        return validated;
      } catch (error) {
        if (isNamedError(error, 'TransactionCanceledException')) {
          const currentReservation = await readReservation(invoice.invoiceNumber);
          if (!currentReservation.ok) return currentReservation;
          if (
            currentReservation.value !== undefined &&
            currentReservation.value.invoiceId !== String(invoice.id)
          )
            return invoiceNumberConflict(invoice.invoiceNumber);
          const currentInvoice = await readInvoice(invoice.id);
          if (!currentInvoice.ok) return currentInvoice;
          if (
            currentInvoice.value.version !== saveOptions.expectedVersion ||
            currentInvoice.value.record.kind !== 'draft'
          )
            return invoiceConflict('Invoice record version conflict.');
          return repositoryUnavailable(error);
        }
        return repositoryUnavailable(error);
      }
    },

    async saveVoided(
      invoice: VoidedInvoice,
      saveOptions: SaveVoidedInvoiceOptions,
    ): Promise<InvoiceRepositoryResult<SaveInvoiceResult>> {
      if (invoice.kind !== 'voided')
        return invalidInvoiceRecord('saveVoided only accepts voided invoices.', 'kind');
      const id = invoice.finalized?.id;
      if (id === undefined)
        return invalidInvoiceRecord(
          'Voided invoices must include finalized snapshot.',
          'finalized',
        );
      const existing = await readInvoice(id);
      if (!existing.ok) return existing;
      if (existing.value.version !== saveOptions.expectedVersion)
        return invoiceConflict('Invoice record version conflict.');
      if (existing.value.record.kind === 'draft')
        return invoiceConflict('Draft invoices cannot be voided.');
      if (existing.value.record.kind === 'voided') {
        if (
          canonicalSerializedJson(existing.value.record.invoice) ===
          canonicalSerializedJson(
            toStoredVoidedInvoiceRecord(invoice, existing.value.version).invoice,
          )
        )
          return repoOk(
            Object.freeze({ invoice: existing.value.invoice, version: existing.value.version }),
          );
        return invoiceConflict('Voided invoice payload differs from existing record.');
      }
      if (
        canonicalSerializedJson(existing.value.record.invoice) !==
        canonicalSerializedJson(serializeFinalizedInvoice(invoice.finalized))
      )
        return invoiceConflict('Voided invoice finalized snapshot differs from existing record.');

      const invoiceNumber = invoice.finalized.invoiceNumber;
      const reservation = await readReservation(invoiceNumber);
      if (!reservation.ok) return reservation;
      if (reservation.value === undefined)
        return invariantViolation(
          'Finalized invoice number must be reserved before voiding.',
          'invoiceNumber',
        );
      if (reservation.value.invoiceId !== String(id)) return invoiceNumberConflict(invoiceNumber);
      const version = nextVersion();
      if (!version.ok) return version;
      const record = toStoredVoidedInvoiceRecord(invoice, version.value);
      const validated = saveResult(record);
      if (!validated.ok) return validated;
      try {
        await options.client.send(
          new PutCommand({
            TableName: tableName,
            Item: toInvoiceItem(record),
            ConditionExpression:
              '#record.#version = :expectedVersion AND #record.#kind = :expectedKind',
            ExpressionAttributeNames: {
              '#record': 'record',
              '#version': 'version',
              '#kind': 'kind',
            },
            ExpressionAttributeValues: {
              ':expectedVersion': saveOptions.expectedVersion,
              ':expectedKind': 'finalized',
            },
          }),
        );
        return validated;
      } catch (error) {
        if (isNamedError(error, 'ConditionalCheckFailedException'))
          return invoiceConflict('Invoice record version conflict.');
        return repositoryUnavailable(error);
      }
    },

    async getById(id: InvoiceId): Promise<InvoiceRepositoryResult<GetInvoiceResult>> {
      const result = await readInvoice(id);
      if (!result.ok) return result;
      return repoOk(
        Object.freeze({ invoice: result.value.invoice, version: result.value.version }),
      );
    },

    async list(query: InvoiceListQuery = {}): Promise<InvoiceRepositoryResult<InvoiceListResult>> {
      const pageSize = parsePageSize(query.pageSize);
      if (!pageSize.ok) return pageSize;
      const cursorOffset = parseCursorOffset(query.cursor);
      if (!cursorOffset.ok) return cursorOffset;
      const queried = await queryInvoiceRecords();
      if (!queried.ok) return queried;

      const normalizedSearch = query.search?.trim().toLowerCase();
      const searchedRecords =
        normalizedSearch === undefined || normalizedSearch === ''
          ? queried.value
          : queried.value.filter((record) =>
              [record.invoiceNumber, record.customerDisplayName].some(
                (candidate) =>
                  candidate !== undefined &&
                  String(candidate).toLowerCase().includes(normalizedSearch),
              ),
            );
      const filteredRecords =
        query.kind === undefined
          ? searchedRecords
          : searchedRecords.filter((record) => record.kind === query.kind);
      const sortQuery = {
        sortBy: query.sortBy ?? 'updatedAt',
        sortDirection: query.sortDirection ?? 'desc',
      } as const;
      const sortedRecords = [...filteredRecords].sort((left, right) =>
        compareRecords(left, right, sortQuery),
      );
      const start = cursorOffset.value;
      const end = start + pageSize.value;
      const items = Object.freeze(sortedRecords.slice(start, end).map(toInvoiceListItem));
      return repoOk(
        Object.freeze({
          items,
          ...(end < sortedRecords.length ? { nextCursor: `offset:${end}` } : {}),
        }),
      );
    },

    async discardDraft(
      id: InvoiceId,
      discardOptions: DiscardDraftOptions,
    ): Promise<InvoiceRepositoryResult<DiscardDraftResult>> {
      const existing = await readInvoice(id);
      if (!existing.ok) return existing;
      if (existing.value.record.kind !== 'draft')
        return invoiceConflict('Only draft invoices can be discarded.');
      if (existing.value.version !== discardOptions.expectedVersion)
        return invoiceConflict('Invoice record version conflict.');
      try {
        await options.client.send(
          new DeleteCommand({
            TableName: tableName,
            Key: invoiceKey(id),
            ConditionExpression:
              '#record.#version = :expectedVersion AND #record.#kind = :expectedKind',
            ExpressionAttributeNames: {
              '#record': 'record',
              '#version': 'version',
              '#kind': 'kind',
            },
            ExpressionAttributeValues: {
              ':expectedVersion': discardOptions.expectedVersion,
              ':expectedKind': 'draft',
            },
          }),
        );
        return repoOk(Object.freeze({ id }));
      } catch (error) {
        if (isNamedError(error, 'ConditionalCheckFailedException'))
          return invoiceConflict('Invoice record version conflict.');
        return repositoryUnavailable(error);
      }
    },
  });
};
