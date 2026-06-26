import {
  DEFAULT_ROUNDING_MODE,
  err,
  isCurrencyCode,
  isCurrencyMinorUnitDigits,
  isInvoiceId,
  isInvoiceLineItemId,
  isIsoDate,
  isRoundingMode,
  isUtcTimestamp,
  makeDomainError,
  ok,
  parseCurrencyDefinition,
  type DomainError,
  type DomainResult,
  type InvoiceLineItemId,
  type UtcTimestampString,
} from '@invoice/domain';
import { DEFAULT_TAX_ROUNDING_STRATEGY } from '@invoice/invoice-engine';

import { parseInvoiceLineDescription } from './text';
import {
  type CreateDraftInvoiceInput,
  type DraftInvoice,
  type DraftInvoiceLine,
  type DraftInvoiceLineInput,
  type DraftInvoiceLinePatch,
  type PartySnapshot,
} from './types';

const invalidInvoice = (message: string, path?: string): DomainError =>
  makeDomainError('invalid_invoice', message, path);
const invalidLine = (message: string, path?: string): DomainError =>
  makeDomainError('invalid_invoice_line', message, path);
const duplicateIdentifier = (message: string, path?: string): DomainError =>
  makeDomainError('duplicate_identifier', message, path);
const currencyMismatch = (message: string, path?: string): DomainError =>
  makeDomainError('currency_mismatch', message, path);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isNonNegativeSafeInteger = (value: number): boolean =>
  Number.isSafeInteger(value) && value >= 0;
const isTaxRoundingStrategy = (value: unknown): boolean =>
  value === 'per_line' || value === 'invoice_total';

const compareTimestamp = (left: UtcTimestampString, right: UtcTimestampString): -1 | 0 | 1 => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const validateDraftForEdit = (draft: DraftInvoice): DomainResult<void> => {
  if (!isRecord(draft)) return err(invalidInvoice('Draft invoice must be an object.'));
  if (draft.kind !== 'draft') return err(invalidInvoice('Invoice must be a draft.', 'kind'));
  if (!isInvoiceId(draft.id)) return err(invalidInvoice('Invoice ID is invalid.', 'id'));
  if (!isUtcTimestamp(draft.createdAt))
    return err(makeDomainError('invalid_timestamp', 'Created timestamp is invalid.', 'createdAt'));
  if (!isUtcTimestamp(draft.updatedAt))
    return err(makeDomainError('invalid_timestamp', 'Updated timestamp is invalid.', 'updatedAt'));
  if (!Array.isArray(draft.lines))
    return err(invalidInvoice('Draft lines must be an array.', 'lines'));
  if (compareTimestamp(draft.updatedAt, draft.createdAt) < 0)
    return err(
      invalidInvoice('Updated timestamp must not precede created timestamp.', 'updatedAt'),
    );
  return ok(undefined);
};

const validateEditTimestamp = (
  draft: DraftInvoice,
  updatedAt: UtcTimestampString,
): DomainResult<void> => {
  const validDraft = validateDraftForEdit(draft);
  if (!validDraft.ok) return err(validDraft.error);
  if (!isUtcTimestamp(updatedAt))
    return err(makeDomainError('invalid_timestamp', 'Updated timestamp is invalid.', 'updatedAt'));
  if (compareTimestamp(updatedAt, draft.createdAt) < 0)
    return err(
      invalidInvoice('Updated timestamp must not precede created timestamp.', 'updatedAt'),
    );
  if (compareTimestamp(updatedAt, draft.updatedAt) < 0)
    return err(invalidInvoice('Updated timestamp must not move backward.', 'updatedAt'));
  return ok(undefined);
};

const validateCurrency = (
  input: CreateDraftInvoiceInput['currency'],
): DomainResult<CreateDraftInvoiceInput['currency']> => {
  if (
    !isRecord(input) ||
    typeof input.code !== 'string' ||
    !isCurrencyCode(input.code) ||
    !isCurrencyMinorUnitDigits(input.minorUnitDigits)
  ) {
    return err(
      makeDomainError(
        'invalid_currency_definition',
        'Invoice currency definition is invalid.',
        'currency',
      ),
    );
  }
  const parsed = parseCurrencyDefinition(input);
  if (!parsed.ok) return err(parsed.error);
  return ok(parsed.value);
};

const sameCurrency = (line: DraftInvoiceLine, draft: DraftInvoice): boolean =>
  line.unitPrice.currency === draft.currency.code;

const validateLine = (
  line: DraftInvoiceLine,
  draft: DraftInvoice,
  path = 'line',
): DomainResult<DraftInvoiceLine> => {
  if (!isRecord(line)) return err(invalidLine('Invoice line must be an object.', path));
  if (!isInvoiceLineItemId(line.id))
    return err(invalidLine('Invoice line item ID must be valid.', `${path}.id`));
  if (typeof line.description !== 'string' || !parseInvoiceLineDescription(line.description).ok)
    return err(invalidLine('Invoice line description must be valid.', `${path}.description`));
  if (!isNonNegativeSafeInteger(line.position))
    return err(
      invalidLine('Line position must be a non-negative safe integer.', `${path}.position`),
    );
  if (
    !isRecord(line.quantity) ||
    typeof line.quantity.units !== 'bigint' ||
    line.quantity.units <= 0n
  )
    return err(invalidLine('Line quantity must be positive.', `${path}.quantity`));
  if (!isRecord(line.unitPrice) || typeof line.unitPrice.minorUnits !== 'bigint')
    return err(invalidLine('Line unit price must be valid Money.', `${path}.unitPrice`));
  if (!sameCurrency(line, draft))
    return err(
      currencyMismatch(
        'Line unit price currency must match invoice currency.',
        `${path}.unitPrice`,
      ),
    );
  if (line.unitPrice.minorUnits < 0n)
    return err(invalidLine('Line unit price must be non-negative.', `${path}.unitPrice`));
  return ok(Object.freeze({ ...line }));
};

const freezeLines = (lines: readonly DraftInvoiceLine[]): readonly DraftInvoiceLine[] =>
  Object.freeze([...lines].map((line) => Object.freeze({ ...line })));
const sortLines = (lines: readonly DraftInvoiceLine[]): readonly DraftInvoiceLine[] =>
  Object.freeze(
    [...lines].sort(
      (left, right) => left.position - right.position || left.id.localeCompare(right.id),
    ),
  );

const validateUniqueLineIds = (lines: readonly DraftInvoiceLine[]): DomainResult<void> => {
  const seen = new Set<string>();
  for (const [index, line] of lines.entries()) {
    if (seen.has(line.id))
      return err(duplicateIdentifier('Invoice line IDs must be unique.', `lines.${index}.id`));
    seen.add(line.id);
  }
  return ok(undefined);
};

type DraftPatch = Partial<{ [K in keyof DraftInvoice]: DraftInvoice[K] | undefined }>;
const rebuildDraft = (draft: DraftInvoice, patch: DraftPatch): DraftInvoice => {
  const next: Record<string, unknown> = { ...draft, ...patch };
  for (const key of [
    'business',
    'customer',
    'issueDate',
    'dueDate',
    'invoiceDiscount',
    'notes',
    'terms',
  ]) {
    if (next[key] === undefined) delete next[key];
  }
  next.lines = patch.lines === undefined ? draft.lines : freezeLines(patch.lines);
  return Object.freeze(next) as DraftInvoice;
};

export const createDraftInvoice = (input: CreateDraftInvoiceInput): DomainResult<DraftInvoice> => {
  if (!isRecord(input)) return err(invalidInvoice('Draft invoice input must be an object.'));
  if (!isInvoiceId(input.id)) return err(invalidInvoice('Invoice ID is invalid.', 'id'));
  if (!isUtcTimestamp(input.createdAt))
    return err(makeDomainError('invalid_timestamp', 'Created timestamp is invalid.', 'createdAt'));
  if (!isUtcTimestamp(input.updatedAt))
    return err(makeDomainError('invalid_timestamp', 'Updated timestamp is invalid.', 'updatedAt'));
  const currency = validateCurrency(input.currency);
  if (!currency.ok) return err(currency.error);
  if (compareTimestamp(input.updatedAt, input.createdAt) < 0)
    return err(
      invalidInvoice('Updated timestamp must not precede created timestamp.', 'updatedAt'),
    );
  if (input.issueDate !== undefined && !isIsoDate(input.issueDate))
    return err(makeDomainError('invalid_date', 'Issue date is invalid.', 'issueDate'));
  if (input.dueDate !== undefined && !isIsoDate(input.dueDate))
    return err(makeDomainError('invalid_date', 'Due date is invalid.', 'dueDate'));
  if (
    input.issueDate !== undefined &&
    input.dueDate !== undefined &&
    input.dueDate < input.issueDate
  )
    return err(invalidInvoice('Due date must not precede issue date.', 'dueDate'));
  if (input.roundingMode !== undefined && !isRoundingMode(input.roundingMode))
    return err(makeDomainError('invalid_rounding_mode', 'Invalid rounding mode.', 'roundingMode'));
  if (input.taxRoundingStrategy !== undefined && !isTaxRoundingStrategy(input.taxRoundingStrategy))
    return err(
      makeDomainError(
        'invalid_invoice_calculation',
        'Invalid tax rounding strategy.',
        'taxRoundingStrategy',
      ),
    );
  return ok(
    Object.freeze({
      kind: 'draft',
      id: input.id,
      ...(input.business === undefined ? {} : { business: input.business }),
      ...(input.customer === undefined ? {} : { customer: input.customer }),
      ...(input.issueDate === undefined ? {} : { issueDate: input.issueDate }),
      ...(input.dueDate === undefined ? {} : { dueDate: input.dueDate }),
      currency: currency.value,
      lines: Object.freeze([]),
      ...(input.invoiceDiscount === undefined ? {} : { invoiceDiscount: input.invoiceDiscount }),
      roundingMode: input.roundingMode ?? DEFAULT_ROUNDING_MODE,
      taxRoundingStrategy: input.taxRoundingStrategy ?? DEFAULT_TAX_ROUNDING_STRATEGY,
      ...(input.notes === undefined ? {} : { notes: input.notes }),
      ...(input.terms === undefined ? {} : { terms: input.terms }),
      createdAt: input.createdAt,
      updatedAt: input.updatedAt,
    }),
  );
};

export const addDraftInvoiceLine = (
  draft: DraftInvoice,
  input: DraftInvoiceLineInput,
  updatedAt: UtcTimestampString,
): DomainResult<DraftInvoice> => {
  const time = validateEditTimestamp(draft, updatedAt);
  if (!time.ok) return err(time.error);
  if (draft.lines.some((line) => line.id === input.id))
    return err(duplicateIdentifier('Invoice line IDs must be unique.', 'line.id'));
  const line = validateLine(input, draft);
  if (!line.ok) return err(line.error);
  return ok(rebuildDraft(draft, { lines: sortLines([...draft.lines, line.value]), updatedAt }));
};

export const updateDraftInvoiceLine = (
  draft: DraftInvoice,
  lineId: InvoiceLineItemId,
  patch: DraftInvoiceLinePatch,
  updatedAt: UtcTimestampString,
): DomainResult<DraftInvoice> => {
  const time = validateEditTimestamp(draft, updatedAt);
  if (!time.ok) return err(time.error);
  let found = false;
  const next = draft.lines.map((line) => {
    if (line.id !== lineId) return line;
    found = true;
    return { ...line, ...patch };
  });
  if (!found) return err(invalidLine('Invoice line was not found.', 'lineId'));
  const valid: DraftInvoiceLine[] = [];
  for (const [index, line] of next.entries()) {
    const result = validateLine(line, draft, `lines.${index}`);
    if (!result.ok) return err(result.error);
    valid.push(result.value);
  }
  return ok(rebuildDraft(draft, { lines: sortLines(valid), updatedAt }));
};

export const removeDraftInvoiceLine = (
  draft: DraftInvoice,
  lineId: InvoiceLineItemId,
  updatedAt: UtcTimestampString,
): DomainResult<DraftInvoice> => {
  const time = validateEditTimestamp(draft, updatedAt);
  if (!time.ok) return err(time.error);
  if (!draft.lines.some((line) => line.id === lineId))
    return err(invalidLine('Invoice line was not found.', 'lineId'));
  return ok(
    rebuildDraft(draft, { lines: draft.lines.filter((line) => line.id !== lineId), updatedAt }),
  );
};

export const reorderDraftInvoiceLines = (
  draft: DraftInvoice,
  order: readonly InvoiceLineItemId[],
  updatedAt: UtcTimestampString,
): DomainResult<DraftInvoice> => {
  const time = validateEditTimestamp(draft, updatedAt);
  if (!time.ok) return err(time.error);
  if (order.length !== draft.lines.length)
    return err(invalidLine('Line reorder must include every line exactly once.'));
  const unique = new Set(order);
  if (unique.size !== order.length)
    return err(duplicateIdentifier('Line reorder IDs must be unique.'));
  const byId = new Map(draft.lines.map((line) => [line.id, line]));
  const lines: DraftInvoiceLine[] = [];
  for (const [position, id] of order.entries()) {
    const line = byId.get(id);
    if (line === undefined) return err(invalidLine('Line reorder contains an unknown line ID.'));
    lines.push(Object.freeze({ ...line, position }));
  }
  return ok(rebuildDraft(draft, { lines, updatedAt }));
};

export const setDraftInvoiceParties = (
  draft: DraftInvoice,
  parties: Readonly<{ business?: PartySnapshot; customer?: PartySnapshot }>,
  updatedAt: UtcTimestampString,
): DomainResult<DraftInvoice> => {
  const time = validateEditTimestamp(draft, updatedAt);
  if (!time.ok) return err(time.error);
  return ok(rebuildDraft(draft, { ...parties, updatedAt }));
};

export const setDraftInvoiceDates = (
  draft: DraftInvoice,
  dates: Readonly<{ issueDate?: DraftInvoice['issueDate']; dueDate?: DraftInvoice['dueDate'] }>,
  updatedAt: UtcTimestampString,
): DomainResult<DraftInvoice> => {
  const time = validateEditTimestamp(draft, updatedAt);
  if (!time.ok) return err(time.error);
  const issueDate = Object.hasOwn(dates, 'issueDate') ? dates.issueDate : draft.issueDate;
  const dueDate = Object.hasOwn(dates, 'dueDate') ? dates.dueDate : draft.dueDate;
  if (issueDate !== undefined && !isIsoDate(issueDate))
    return err(makeDomainError('invalid_date', 'Issue date is invalid.', 'issueDate'));
  if (dueDate !== undefined && !isIsoDate(dueDate))
    return err(makeDomainError('invalid_date', 'Due date is invalid.', 'dueDate'));
  if (issueDate !== undefined && dueDate !== undefined && dueDate < issueDate)
    return err(invalidInvoice('Due date must not precede issue date.', 'dueDate'));
  return ok(rebuildDraft(draft, { ...dates, updatedAt }));
};

export const setDraftInvoiceText = (
  draft: DraftInvoice,
  text: Readonly<{ notes?: DraftInvoice['notes']; terms?: DraftInvoice['terms'] }>,
  updatedAt: UtcTimestampString,
): DomainResult<DraftInvoice> => {
  const time = validateEditTimestamp(draft, updatedAt);
  if (!time.ok) return err(time.error);
  return ok(rebuildDraft(draft, { ...text, updatedAt }));
};

export const setDraftInvoiceDiscount = (
  draft: DraftInvoice,
  invoiceDiscount: DraftInvoice['invoiceDiscount'],
  updatedAt: UtcTimestampString,
): DomainResult<DraftInvoice> => {
  const time = validateEditTimestamp(draft, updatedAt);
  if (!time.ok) return err(time.error);
  if (
    invoiceDiscount?.kind === 'fixed' &&
    invoiceDiscount.amount.currency !== draft.currency.code
  ) {
    return err(
      currencyMismatch('Invoice discount currency must match invoice currency.', 'invoiceDiscount'),
    );
  }
  return ok(rebuildDraft(draft, { invoiceDiscount, updatedAt }));
};

export const setDraftCalculationSettings = (
  draft: DraftInvoice,
  settings: Readonly<Pick<DraftInvoice, 'roundingMode' | 'taxRoundingStrategy'>>,
  updatedAt: UtcTimestampString,
): DomainResult<DraftInvoice> => {
  const time = validateEditTimestamp(draft, updatedAt);
  if (!time.ok) return err(time.error);
  if (!isRoundingMode(settings.roundingMode))
    return err(makeDomainError('invalid_rounding_mode', 'Invalid rounding mode.', 'roundingMode'));
  if (!isTaxRoundingStrategy(settings.taxRoundingStrategy))
    return err(
      makeDomainError(
        'invalid_invoice_calculation',
        'Invalid tax rounding strategy.',
        'taxRoundingStrategy',
      ),
    );
  return ok(rebuildDraft(draft, { ...settings, updatedAt }));
};

export const validateDraftLineSet = (lines: readonly DraftInvoiceLine[]): DomainResult<void> =>
  validateUniqueLineIds(lines);
