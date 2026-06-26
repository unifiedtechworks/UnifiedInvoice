import { type InvoiceId, type InvoiceNumber } from '@invoice/domain';

import {
  addDraftInvoiceLine,
  finalizeInvoice,
  type DraftInvoice,
  type DraftInvoiceLine,
  type FinalizedInvoice,
  type FinalizedInvoiceLine,
  type VoidedInvoice,
} from '../src/index';

declare const draft: DraftInvoice;
declare const finalized: FinalizedInvoice;
declare const voided: VoidedInvoice;
declare const invoiceId: InvoiceId;
declare const invoiceNumber: InvoiceNumber;
declare const draftLine: DraftInvoiceLine;
declare const finalizedLine: FinalizedInvoiceLine;

const validInvoiceNumberString: string = invoiceNumber;

// @ts-expect-error InvoiceNumber is distinct from InvoiceId
const invalidNumberFromId: InvoiceNumber = invoiceId;

// @ts-expect-error DraftInvoice cannot be assigned to FinalizedInvoice
const invalidFinalized: FinalizedInvoice = draft;

// @ts-expect-error FinalizedInvoice cannot be assigned to DraftInvoice
const invalidDraft: DraftInvoice = finalized;

// @ts-expect-error VoidedInvoice cannot be finalized
finalizeInvoice(voided, { invoiceNumber, finalizedAt: finalized.finalizedAt });

// @ts-expect-error FinalizedInvoice cannot be edited by draft operation
addDraftInvoiceLine(finalized, draftLine, finalized.finalizedAt);

// @ts-expect-error Draft lines are distinct from finalized lines
const invalidFinalizedLine: FinalizedInvoiceLine = draftLine;

void validInvoiceNumberString;
void invalidNumberFromId;
void invalidFinalized;
void invalidDraft;
void invalidFinalizedLine;
void finalizedLine;
