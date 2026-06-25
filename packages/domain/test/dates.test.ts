import { describe, expect, it } from 'vitest';

import {
  assertIsoDate,
  assertUtcTimestamp,
  DomainValidationError,
  isIsoDate,
  isUtcTimestamp,
  parseIsoDate,
  parseUtcTimestamp,
  type IsoDateString,
  type UtcTimestampString,
} from '../src/index';

describe('calendar dates', () => {
  it('accepts valid YYYY-MM-DD dates', () => {
    expect(parseIsoDate('2026-06-01')).toMatchObject({ ok: true, value: '2026-06-01' });
  });

  it('accepts leap day on a leap year and rejects invalid leap days', () => {
    expect(parseIsoDate('2024-02-29')).toMatchObject({ ok: true, value: '2024-02-29' });
    expect(parseIsoDate('2023-02-29')).toMatchObject({
      ok: false,
      error: { code: 'invalid_date' },
    });
    expect(parseIsoDate('1900-02-29')).toMatchObject({
      ok: false,
      error: { code: 'invalid_date' },
    });
    expect(parseIsoDate('2000-02-29')).toMatchObject({ ok: true, value: '2000-02-29' });
  });

  it.each(['2026-6-1', '2026/06/01', '26-06-01'])('rejects malformed date %s', (value) => {
    expect(parseIsoDate(value)).toMatchObject({ ok: false, error: { code: 'invalid_date' } });
  });

  it.each(['2026-02-30', '2026-00-01', '2026-13-01', '2026-04-31'])(
    'rejects impossible date %s',
    (value) => {
      expect(parseIsoDate(value)).toMatchObject({ ok: false, error: { code: 'invalid_date' } });
    },
  );

  it('rejects date-time strings and whitespace-padded values', () => {
    expect(parseIsoDate('2026-06-01T00:00:00.000Z')).toMatchObject({
      ok: false,
      error: { code: 'invalid_date' },
    });
    expect(parseIsoDate(' 2026-06-01')).toMatchObject({
      ok: false,
      error: { code: 'invalid_date' },
    });
    expect(parseIsoDate('2026-06-01 ')).toMatchObject({
      ok: false,
      error: { code: 'invalid_date' },
    });
  });

  it('asserts and narrows calendar date values', () => {
    const value = '2026-06-01';

    expect(assertIsoDate(value)).toBe(value);
    expect(() => assertIsoDate('2026-02-30')).toThrow(DomainValidationError);
    expect(isIsoDate(value)).toBe(true);
    if (isIsoDate(value)) {
      const date: IsoDateString = value;
      expect(date).toBe(value);
    }
  });
});

describe('UTC timestamps', () => {
  it('accepts canonical UTC timestamps', () => {
    expect(parseUtcTimestamp('2026-01-01T00:00:00.000Z')).toMatchObject({
      ok: true,
      value: '2026-01-01T00:00:00.000Z',
    });
  });

  it('normalizes Z input without milliseconds', () => {
    expect(parseUtcTimestamp('2026-01-01T00:00:00Z')).toMatchObject({
      ok: true,
      value: '2026-01-01T00:00:00.000Z',
    });
  });

  it('normalizes positive and negative explicit offsets', () => {
    expect(parseUtcTimestamp('2026-01-01T01:00:00+01:00')).toMatchObject({
      ok: true,
      value: '2026-01-01T00:00:00.000Z',
    });
    expect(parseUtcTimestamp('2025-12-31T19:00:00-05:00')).toMatchObject({
      ok: true,
      value: '2026-01-01T00:00:00.000Z',
    });
  });

  it.each([
    ['2026-01-01T00:00:00', 'no offset'],
    ['2026-01-01', 'date only'],
    ['2026-02-30T00:00:00Z', 'impossible date'],
    ['2026-01-01T24:00:00Z', 'impossible hour'],
    [' 2026-01-01T00:00:00Z', 'leading whitespace'],
    ['2026-01-01T00:00:00Z ', 'trailing whitespace'],
  ])('rejects timestamp %s with %s', (value) => {
    expect(parseUtcTimestamp(value)).toMatchObject({
      ok: false,
      error: { code: 'invalid_timestamp' },
    });
  });

  it('only treats already-canonical UTC strings as UtcTimestampString type guards', () => {
    const canonical = '2026-01-01T00:00:00.000Z';

    expect(isUtcTimestamp(canonical)).toBe(true);
    if (isUtcTimestamp(canonical)) {
      const timestamp: UtcTimestampString = canonical;
      expect(timestamp).toBe(canonical);
    }

    expect(isUtcTimestamp('2026-01-01T00:00:00Z')).toBe(false);
    expect(isUtcTimestamp('2026-01-01T01:00:00+01:00')).toBe(false);
  });

  it('asserts and normalizes timestamp values', () => {
    expect(assertUtcTimestamp('2026-01-01T01:00:00+01:00')).toBe('2026-01-01T00:00:00.000Z');
    expect(() => assertUtcTimestamp('2026-01-01T00:00:00')).toThrow(DomainValidationError);
  });
});
