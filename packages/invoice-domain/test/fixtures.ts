import {
  assertCurrencyCode,
  assertInvoiceId,
  assertInvoiceLineItemId,
  assertInvoiceNumber,
  assertMoney,
  assertMonetaryInteger,
  assertQuantity,
  assertUtcTimestamp,
  createCurrencyDefinition,
  parseMoneyFromDecimal,
  parseRateFromDecimalPercent,
  type CurrencyDefinition,
  type Money,
  type Rate,
} from '@invoice/domain';
import {
  parseInvoiceLineDescription,
  parsePartyDisplayName,
  parseVoidReason,
  type DraftInvoiceLine,
  type PartySnapshot,
} from '../src/index';

export const USD: CurrencyDefinition = (() => {
  const result = createCurrencyDefinition(assertCurrencyCode('USD'), 2);
  if (!result.ok) throw new Error('Expected USD fixture.');
  return result.value;
})();

export const timestamp = (value: string) => assertUtcTimestamp(value);
export const invoiceId = (value = 'invoice-1') => assertInvoiceId(value);
export const invoiceNumber = (value = 'INV-1001') => assertInvoiceNumber(value);
export const lineId = (value: string) => assertInvoiceLineItemId(value);
export const quantity = (value: string) => assertQuantity(value);
export const minorMoney = (minorUnits: string, currency = USD): Money =>
  assertMoney(currency.code, assertMonetaryInteger(minorUnits));
export const money = (value: string, currency = USD): Money => {
  const result = parseMoneyFromDecimal(value, currency);
  if (!result.ok) throw new Error(`Expected money ${value}.`);
  return result.value;
};
export const rate = (value: string): Rate => {
  const result = parseRateFromDecimalPercent(value);
  if (!result.ok) throw new Error(`Expected rate ${value}.`);
  return result.value;
};
export const description = (value = 'Consulting services') => {
  const result = parseInvoiceLineDescription(value);
  if (!result.ok) throw new Error(`Expected description ${value}.`);
  return result.value;
};
export const partyName = (value: string) => {
  const result = parsePartyDisplayName(value);
  if (!result.ok) throw new Error(`Expected party name ${value}.`);
  return result.value;
};
export const party = (name: string): PartySnapshot =>
  Object.freeze({ displayName: partyName(name) });
export const voidReason = (value = 'Issued in error') => {
  const result = parseVoidReason(value);
  if (!result.ok) throw new Error(`Expected void reason ${value}.`);
  return result.value;
};
export const draftLine = (id = 'line-1', position = 0, price = '10.00'): DraftInvoiceLine =>
  Object.freeze({
    id: lineId(id),
    position,
    description: description(),
    quantity: quantity('1'),
    unitPrice: money(price),
  });
