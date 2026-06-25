import { brandString, type Brand } from './brand';
import { DomainValidationError, err, makeDomainError, ok, type DomainResult } from './result';

export type IsoDateString = Brand<string, 'IsoDateString'>;
export type UtcTimestampString = Brand<string, 'UtcTimestampString'>;

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const timestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/;
const canonicalUtcTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const invalidDateError = makeDomainError(
  'invalid_date',
  'Date must be a real Gregorian calendar date in YYYY-MM-DD format.',
);

const invalidTimestampError = makeDomainError(
  'invalid_timestamp',
  'Timestamp must be a valid ISO-8601 instant with Z or an explicit numeric offset.',
);

const toInteger = (value: string): number => Number.parseInt(value, 10);

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const daysInMonth = (year: number, month: number): number => {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return [4, 6, 9, 11].includes(month) ? 30 : 31;
};

const isRealGregorianDate = (year: number, month: number, day: number): boolean => {
  if (month < 1 || month > 12) {
    return false;
  }

  return day >= 1 && day <= daysInMonth(year, month);
};

const getCapture = (match: RegExpExecArray, index: number): string => {
  const value = match[index];

  if (value === undefined) {
    throw new Error('Expected regular expression capture group to be present.');
  }

  return value;
};

export const parseIsoDate = (value: string): DomainResult<IsoDateString> => {
  const match = isoDatePattern.exec(value);

  if (match === null) {
    return err(invalidDateError);
  }

  const year = toInteger(getCapture(match, 1));
  const month = toInteger(getCapture(match, 2));
  const day = toInteger(getCapture(match, 3));

  if (!isRealGregorianDate(year, month, day)) {
    return err(invalidDateError);
  }

  return ok(brandString<'IsoDateString'>(value));
};

export const isIsoDate = (value: string): value is IsoDateString => parseIsoDate(value).ok;

export const assertIsoDate = (value: string): IsoDateString => {
  const result = parseIsoDate(value);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};

const hasValidTimestampParts = (match: RegExpExecArray): boolean => {
  const year = toInteger(getCapture(match, 1));
  const month = toInteger(getCapture(match, 2));
  const day = toInteger(getCapture(match, 3));
  const hour = toInteger(getCapture(match, 4));
  const minute = toInteger(getCapture(match, 5));
  const second = toInteger(getCapture(match, 6));
  const offsetText = getCapture(match, 8);

  if (!isRealGregorianDate(year, month, day)) {
    return false;
  }

  if (hour > 23 || minute > 59 || second > 59) {
    return false;
  }

  if (offsetText !== 'Z') {
    const offsetHour = toInteger(offsetText.slice(1, 3));
    const offsetMinute = toInteger(offsetText.slice(4, 6));

    if (offsetHour > 23 || offsetMinute > 59) {
      return false;
    }
  }

  return true;
};

export const parseUtcTimestamp = (value: string): DomainResult<UtcTimestampString> => {
  const match = timestampPattern.exec(value);

  if (match === null || !hasValidTimestampParts(match)) {
    return err(invalidTimestampError);
  }

  const timestamp = new Date(value);

  if (!Number.isFinite(timestamp.getTime())) {
    return err(invalidTimestampError);
  }

  return ok(brandString<'UtcTimestampString'>(timestamp.toISOString()));
};

export const isUtcTimestamp = (value: string): value is UtcTimestampString => {
  if (!canonicalUtcTimestampPattern.test(value)) {
    return false;
  }

  const result = parseUtcTimestamp(value);
  return result.ok && result.value === value;
};

export const assertUtcTimestamp = (value: string): UtcTimestampString => {
  const result = parseUtcTimestamp(value);

  if (!result.ok) {
    throw new DomainValidationError(result.error);
  }

  return result.value;
};
