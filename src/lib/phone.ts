import { PHONE_COUNTRY_CODES } from '@/constants/countries';

/**
 * Turns a phone number as people save it ("+91 98765-43210", "098765 43210", "0091 9876543210", "9876543210") into
 * the digits-with-country-code form the server stores, or null when it can't tell. Numbers without a country code
 * are assumed to be in `defaultCode`.
 */
export function normalizePhone(raw: string, defaultCode = '91'): string | null {
  const trimmed = raw.trim();
  let digits = trimmed.replace(/\D/g, '');
  let international = trimmed.startsWith('+');
  if (!international && digits.startsWith('00')) {
    digits = digits.slice(2);
    international = true;
  }
  const valid = (value: string) => (/^\d{11,15}$/.test(value) ? value : null);
  if (international) return valid(digits);
  if (digits.length === 10) return valid(`${defaultCode}${digits}`);
  // A leading trunk zero, as in 098765 43210.
  if (digits.length === 11 && digits.startsWith('0')) return valid(`${defaultCode}${digits.slice(1)}`);
  // Already has the default code but no plus, as in 919876543210.
  if (digits.startsWith(defaultCode) && digits.length - defaultCode.length === 10) return valid(digits);
  return null;
}

// Longest codes first, so 971 wins over 9 style prefixes and 880 over 88.
const CODES = PHONE_COUNTRY_CODES.map((c) => c.code).sort((a, b) => b.length - a.length);

/** Splits a normalized number into a country code the app offers and the rest; null when the code isn't offered. */
export function splitPhone(phone: string): { countryCode: string; national: string } | null {
  const code = CODES.find((c) => phone.startsWith(c) && phone.length - c.length >= 6);
  return code ? { countryCode: code, national: phone.slice(code.length) } : null;
}

/** "+91 98765 43210" for display; other codes keep the national part unspaced. */
export function formatPhone(phone: string): string {
  const split = splitPhone(phone);
  if (!split) return `+${phone}`;
  const { countryCode, national } = split;
  return national.length === 10 ? `+${countryCode} ${national.slice(0, 5)} ${national.slice(5)}` : `+${countryCode} ${national}`;
}

/** First and last name from a contact, which may only have a single "full name". */
export function splitName(given?: string | null, family?: string | null, full?: string | null) {
  const first = given?.trim();
  const last = family?.trim();
  if (first || last) return { fname: (first ?? '').slice(0, 52), lname: (last ?? '').slice(0, 52) };
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean);
  return { fname: (parts[0] ?? '').slice(0, 52), lname: parts.slice(1).join(' ').slice(0, 52) };
}
