import { type Money, type Rate } from '@invoice/domain';

import {
  type CalculatedInvoiceLine,
  type InvoiceCalculationLineInput,
  type TaxRoundingStrategy,
} from '../src/index';

declare const inputLine: InvoiceCalculationLineInput;
declare const calculatedLine: CalculatedInvoiceLine;
declare const rate: Rate;

const validTaxRoundingStrategy: TaxRoundingStrategy = 'per_line';

// @ts-expect-error TaxRoundingStrategy is constrained to declared values
const invalidTaxRoundingStrategy: TaxRoundingStrategy = 'combined';

// @ts-expect-error Calculated lines are distinct from input lines
const invalidCalculatedLine: CalculatedInvoiceLine = inputLine;

// @ts-expect-error Input lines are distinct from calculated lines
const invalidInputLine: InvoiceCalculationLineInput = calculatedLine;

// @ts-expect-error Rate is distinct from Money
const invalidMoneyFromRate: Money = rate;

void validTaxRoundingStrategy;
void invalidTaxRoundingStrategy;
void invalidCalculatedLine;
void invalidInputLine;
void invalidMoneyFromRate;
