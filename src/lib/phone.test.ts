// Run with: bun test src/lib
import { describe, expect, test } from 'bun:test';

import { formatPhone, normalizePhone, splitName, splitPhone } from './phone';

describe('normalizePhone', () => {
  test.each([
    ['9876543210', '919876543210'],
    ['98765 43210', '919876543210'],
    ['+91 98765-43210', '919876543210'],
    ['098765 43210', '919876543210'],
    ['0091 98765 43210', '919876543210'],
    ['919876543210', '919876543210'],
    ['+1 (555) 123-4567', '15551234567'],
    ['+971 50 123 4567', '971501234567'],
  ])('%s → %s', (raw, expected) => {
    expect(normalizePhone(raw)).toBe(expected);
  });

  test.each(['', '12345', '+12345', '040 2345 6789 99', '*99#'])('rejects %p', (raw) => {
    expect(normalizePhone(raw)).toBeNull();
  });
});

describe('splitPhone and formatPhone', () => {
  test('picks the longest matching code', () => {
    expect(splitPhone('971501234567')).toEqual({ countryCode: '971', national: '501234567' });
    expect(splitPhone('919876543210')).toEqual({ countryCode: '91', national: '9876543210' });
    expect(splitPhone('15551234567')).toEqual({ countryCode: '1', national: '5551234567' });
  });
  test('formats for display', () => {
    expect(formatPhone('919876543210')).toBe('+91 98765 43210');
    expect(formatPhone('971501234567')).toBe('+971 501234567');
  });
});

describe('splitName', () => {
  test('prefers given and family names', () => {
    expect(splitName('Asha', 'Sharma', 'Dr Asha Sharma')).toEqual({ fname: 'Asha', lname: 'Sharma' });
  });
  test('falls back to the full name', () => {
    expect(splitName(null, null, 'Ravi Kumar Rao')).toEqual({ fname: 'Ravi', lname: 'Kumar Rao' });
    expect(splitName(undefined, undefined, 'Plumber')).toEqual({ fname: 'Plumber', lname: '' });
  });
});
