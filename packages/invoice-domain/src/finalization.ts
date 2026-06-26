import {
  err,
  isInvoiceNumber,
  isUtcTimestamp,
  makeDomainError,
  ok,
  type DomainError,
  type DomainResult,
} from '@invoice/domain';
import {
  calculateInvoice,
  type InvoiceCalculationInput,
  type InvoiceCalculationResult,
} from '@invoice/invoice-engine';

import { createPartySnapshot } from './party-snapshot';
import {
  type DraftInvoice,
  type FinalizeInvoiceCommand,
  type FinalizedInvoice,
  type FinalizedInvoiceLine,
} from './types';

const invalidInvoice = (message: string, path?: string): DomainError =>
  makeDomainError('invalid_invoice', message, path);

const missing = (message: string, path?: string): DomainError =>
  makeDomainError('missing_required_field', message, path);

const invariant = (message: string): DomainError => makeDomainError('invariant_violation', message);

const compareCanonical = (left: string, right: string): -1 | 0 | 1 => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

export const toInvoiceCalculationInput = (
  draft: DraftInvoice,
): DomainResult<InvoiceCalculationInput> =>
  ok(
    Object.freeze({
      currency: draft.currency,
      lines: Object.freeze(
        draft.lines.map((line) =>
          Object.freeze({
            id: line.id,
            position: line.position,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            ...(line.discount === undefined ? {} : { discount: line.discount }),
            ...(line.tax === undefined ? {} : { tax: line.tax }),
          }),
        ),
      ),
      ...(draft.invoiceDiscount === undefined ? {} : { invoiceDiscount: draft.invoiceDiscount }),
      roundingMode: draft.roundingMode,
      taxRoundingStrategy: draft.taxRoundingStrategy,
    }),
  );

export const calculateDraftInvoice = (
  draft: DraftInvoice,
): DomainResult<InvoiceCalculationResult> => {
  const input = toInvoiceCalculationInput(draft);
  if (!input.ok) return err(input.error);
  return calculateInvoice(input.value);
};

const requireFinalizableDraft = (draft: DraftInvoice): DomainResult<void> => {
  if (typeof draft !== 'object' || draft === null || Array.isArray(draft)) {
    return err(invalidInvoice('Invoice must be an object.'));
  }
  if (draft.kind !== 'draft') return err(invalidInvoice('Invoice must be a draft.', 'kind'));
  if (draft.business === undefined)
    return err(missing('Business snapshot is required.', 'business'));
  if (draft.customer === undefined)
    return err(missing('Customer snapshot is required.', 'customer'));
  if (draft.issueDate === undefined) return err(missing('Issue date is required.', 'issueDate'));
  if (draft.dueDate === undefined) return err(missing('Due date is required.', 'dueDate'));
  if (draft.lines.length === 0)
    return err(missing('At least one invoice line is required.', 'lines'));
  if (compareCanonical(draft.dueDate, draft.issueDate) < 0) {
    return err(invalidInvoice('Due date must not precede issue date.', 'dueDate'));
  }
  return ok(undefined);
};

const requireMatchingCalculatedLines = (
  draft: DraftInvoice,
  calculation: InvoiceCalculationResult,
): DomainResult<void> => {
  if (draft.lines.length !== calculation.lines.length) {
    return err(invariant('Calculated line count must match draft line count.'));
  }

  for (const line of draft.lines) {
    if (!calculation.lines.some((calculated) => calculated.id === line.id)) {
      return err(invariant('Calculated line IDs must match draft line IDs.'));
    }
  }

  return ok(undefined);
};

export const finalizeInvoice = (
  draft: DraftInvoice,
  command: FinalizeInvoiceCommand,
): DomainResult<FinalizedInvoice> => {
  const valid = requireFinalizableDraft(draft);
  if (!valid.ok) return err(valid.error);

  if (!isInvoiceNumber(command.invoiceNumber)) {
    return err(
      makeDomainError('invalid_invoice_number', 'Invoice number is invalid.', 'invoiceNumber'),
    );
  }

  if (!isUtcTimestamp(command.finalizedAt)) {
    return err(
      makeDomainError('invalid_timestamp', 'Finalized timestamp is invalid.', 'finalizedAt'),
    );
  }

  const businessSnapshot = draft.business;
  const customerSnapshot = draft.customer;
  const issueDate = draft.issueDate;
  const dueDate = draft.dueDate;

  if (
    businessSnapshot === undefined ||
    customerSnapshot === undefined ||
    issueDate === undefined ||
    dueDate === undefined
  ) {
    return err(invariant('Finalizable draft validation must require parties and dates.'));
  }

  if (compareCanonical(command.finalizedAt, draft.createdAt) < 0) {
    return err(
      invalidInvoice('Finalized timestamp must not precede created timestamp.', 'finalizedAt'),
    );
  }

  const business = createPartySnapshot(businessSnapshot);
  if (!business.ok) return err(business.error);
  const customer = createPartySnapshot(customerSnapshot);
  if (!customer.ok) return err(customer.error);

  const calculation = calculateDraftInvoice(draft);
  if (!calculation.ok) return err(calculation.error);
  const lineMatch = requireMatchingCalculatedLines(draft, calculation.value);
  if (!lineMatch.ok) return err(lineMatch.error);

  const calculatedById = new Map(calculation.value.lines.map((line) => [line.id, line]));
  if (calculatedById.size !== calculation.value.lines.length) {
    return err(invariant('Calculated line IDs must be unique.'));
  }
  for (const calculated of calculation.value.lines) {
    if (!draft.lines.some((line) => line.id === calculated.id)) {
      return err(invariant('Calculated line IDs must not contain unknown IDs.'));
    }
  }
  const finalizedLines: FinalizedInvoiceLine[] = [];

  for (const line of draft.lines) {
    const calculated = calculatedById.get(line.id);
    if (calculated === undefined)
      return err(invariant('Calculated line must exist for each draft line.'));
    finalizedLines.push(
      Object.freeze({
        id: line.id,
        position: line.position,
        description: line.description,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        ...(line.discount === undefined ? {} : { discount: line.discount }),
        ...(line.tax === undefined ? {} : { tax: line.tax }),
        grossAmount: calculated.grossAmount,
        lineDiscountAmount: calculated.lineDiscountAmount,
        netAmountBeforeInvoiceDiscount: calculated.netAmountBeforeInvoiceDiscount,
        invoiceDiscountAllocation: calculated.invoiceDiscountAllocation,
        netAmountAfterInvoiceDiscount: calculated.netAmountAfterInvoiceDiscount,
        taxableBase: calculated.taxableBase,
        taxAmount: calculated.taxAmount,
        totalAmount: calculated.totalAmount,
      }),
    );
  }

  return ok(
    Object.freeze({
      kind: 'finalized',
      id: draft.id,
      invoiceNumber: command.invoiceNumber,
      business: business.value,
      customer: customer.value,
      issueDate,
      dueDate,
      currency: draft.currency,
      lines: Object.freeze(finalizedLines),
      ...(draft.invoiceDiscount === undefined ? {} : { invoiceDiscount: draft.invoiceDiscount }),
      totals: calculation.value.totals,
      calculationMetadata: calculation.value.metadata,
      ...(draft.notes === undefined ? {} : { notes: draft.notes }),
      ...(draft.terms === undefined ? {} : { terms: draft.terms }),
      createdAt: draft.createdAt,
      updatedAt: command.finalizedAt,
      finalizedAt: command.finalizedAt,
    }),
  );
};
