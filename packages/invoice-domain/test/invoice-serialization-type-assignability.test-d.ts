import { type Money, type SerializedMoney } from '@invoice/domain';

import {
  parseSerializedDraftInvoice,
  parseSerializedFinalizedInvoice,
  parseSerializedInvoice,
  parseSerializedVoidedInvoice,
  type DraftInvoice,
  type FinalizedInvoice,
  type SerializedDraftInvoice,
  type SerializedFinalizedInvoice,
  type SerializedInvoice,
  type SerializedInvoiceSchemaVersion,
  type SerializedVoidedInvoice,
  type VoidedInvoice,
} from '../src/index';

declare const draft: DraftInvoice;
declare const finalized: FinalizedInvoice;
declare const voided: VoidedInvoice;
declare const serializedDraft: SerializedDraftInvoice;
declare const serializedFinalized: SerializedFinalizedInvoice;
declare const serializedVoided: SerializedVoidedInvoice;
declare const serializedInvoice: SerializedInvoice;
declare const money: Money;
declare const serializedMoney: SerializedMoney;

const validSchemaVersion: SerializedInvoiceSchemaVersion = 1;
const validSerializedMoney: SerializedMoney = serializedDraft.lines[0]!.unitPrice;

const parsedDraft = parseSerializedDraftInvoice(serializedDraft);
if (parsedDraft.ok) {
  const preciseDraft: DraftInvoice = parsedDraft.value;
  void preciseDraft;
}

const parsedFinalized = parseSerializedFinalizedInvoice(serializedFinalized);
if (parsedFinalized.ok) {
  const preciseFinalized: FinalizedInvoice = parsedFinalized.value;
  void preciseFinalized;
}

const parsedVoided = parseSerializedVoidedInvoice(serializedVoided);
if (parsedVoided.ok) {
  const preciseVoided: VoidedInvoice = parsedVoided.value;
  void preciseVoided;
}

const parsedInvoice = parseSerializedInvoice(serializedInvoice);
if (parsedInvoice.ok && parsedInvoice.value.kind === 'draft') {
  const narrowedDraft: DraftInvoice = parsedInvoice.value;
  void narrowedDraft;
}

// @ts-expect-error Schema version is constrained to numeric literal 1.
const invalidSchemaVersion: SerializedInvoiceSchemaVersion = 2;

// @ts-expect-error String schema versions are not valid.
const invalidStringSchemaVersion: SerializedInvoiceSchemaVersion = '1';

// @ts-expect-error Serialized draft is distinct from runtime draft.
const invalidDraft: DraftInvoice = serializedDraft;

// @ts-expect-error Runtime draft is distinct from serialized draft.
const invalidSerializedDraft: SerializedDraftInvoice = draft;

// @ts-expect-error Serialized finalized is distinct from runtime finalized.
const invalidFinalized: FinalizedInvoice = serializedFinalized;

// @ts-expect-error Runtime finalized is distinct from serialized finalized.
const invalidSerializedFinalized: SerializedFinalizedInvoice = finalized;

// @ts-expect-error Serialized voided is distinct from runtime voided.
const invalidVoided: VoidedInvoice = serializedVoided;

// @ts-expect-error Runtime voided is distinct from serialized voided.
const invalidSerializedVoided: SerializedVoidedInvoice = voided;

// @ts-expect-error Serialized aggregate money is not runtime Money.
const invalidRuntimeMoney: Money = serializedDraft.lines[0]!.unitPrice;

// @ts-expect-error Runtime Money is not serialized Money.
const invalidSerializedMoney: SerializedMoney = money;

// @ts-expect-error Raw bigint cannot appear in serialized money contracts.
const invalidRawBigIntMoney: SerializedMoney = { currency: 'USD', minorUnits: 1n };

void validSchemaVersion;
void validSerializedMoney;
void serializedMoney;
void invalidSchemaVersion;
void invalidStringSchemaVersion;
void invalidDraft;
void invalidSerializedDraft;
void invalidFinalized;
void invalidSerializedFinalized;
void invalidVoided;
void invalidSerializedVoided;
void invalidRuntimeMoney;
void invalidSerializedMoney;
void invalidRawBigIntMoney;
