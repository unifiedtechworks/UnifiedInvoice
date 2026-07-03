import {
  assertCurrencyCode,
  assertInvoiceId,
  assertInvoiceLineItemId,
  assertInvoiceNumber,
  assertUtcTimestamp,
  createCurrencyDefinition,
  parseMoneyFromDecimal,
  assertQuantity,
} from '@invoice/domain';
import {
  addDraftInvoiceLine,
  createDraftInvoice,
  finalizeInvoice,
  parseInvoiceLineDescription,
  parsePartyDisplayName,
  parseVoidReason,
  setDraftInvoiceDates,
  setDraftInvoiceParties,
  voidInvoice,
  type DraftInvoice,
  type FinalizedInvoice,
  type VoidedInvoice,
} from '@invoice/invoice-domain';

const currencyResult = createCurrencyDefinition(assertCurrencyCode('USD'), 2);
if (!currencyResult.ok) throw new Error('Expected USD fixture.');
const USD = currencyResult.value;

const timestamp = (value: string) => assertUtcTimestamp(value);
const party = (value: string) => {
  const result = parsePartyDisplayName(value);
  if (!result.ok) throw new Error('Expected party fixture.');
  return Object.freeze({ displayName: result.value });
};

export const invoiceId = (value: string) => assertInvoiceId(value);
export const version = (value: string) => value as never;

export const draftInvoice = (id = 'invoice-1'): DraftInvoice => {
  const created = createDraftInvoice({
    id: invoiceId(id),
    currency: USD,
    createdAt: timestamp('2026-01-01T00:00:00.000Z'),
    updatedAt: timestamp('2026-01-01T00:00:00.000Z'),
  });
  if (!created.ok) throw new Error('Expected draft fixture.');
  return created.value;
};

export const finalizableDraft = (id = 'invoice-1'): DraftInvoice => {
  const parties = setDraftInvoiceParties(
    draftInvoice(id),
    { business: party('Seller'), customer: party(`Buyer ${id}`) },
    timestamp('2026-01-01T00:01:00.000Z'),
  );
  if (!parties.ok) throw new Error('Expected parties fixture.');
  const dates = setDraftInvoiceDates(
    parties.value,
    { issueDate: '2026-01-02' as never, dueDate: '2026-02-01' as never },
    timestamp('2026-01-01T00:02:00.000Z'),
  );
  if (!dates.ok) throw new Error('Expected dates fixture.');
  const description = parseInvoiceLineDescription('Consulting services');
  const unitPrice = parseMoneyFromDecimal('100.00', USD);
  if (!description.ok || !unitPrice.ok) throw new Error('Expected line fixture.');
  const line = addDraftInvoiceLine(
    dates.value,
    {
      id: assertInvoiceLineItemId(`line-${id}`),
      position: 0,
      description: description.value,
      quantity: assertQuantity('1'),
      unitPrice: unitPrice.value,
    },
    timestamp('2026-01-01T00:03:00.000Z'),
  );
  if (!line.ok) throw new Error('Expected line fixture.');
  return line.value;
};

export const finalizedInvoice = (id = 'invoice-1', number = 'INV-1001'): FinalizedInvoice => {
  const result = finalizeInvoice(finalizableDraft(id), {
    invoiceNumber: assertInvoiceNumber(number),
    finalizedAt: timestamp('2026-01-01T00:04:00.000Z'),
  });
  if (!result.ok) throw new Error('Expected finalized fixture.');
  return result.value;
};

export const voidedInvoice = (invoice: FinalizedInvoice): VoidedInvoice => {
  const reason = parseVoidReason('Issued in error');
  if (!reason.ok) throw new Error('Expected void reason fixture.');
  const result = voidInvoice(invoice, {
    voidedAt: timestamp('2026-01-01T00:05:00.000Z'),
    reason: reason.value,
  });
  if (!result.ok) throw new Error('Expected voided fixture.');
  return result.value;
};
