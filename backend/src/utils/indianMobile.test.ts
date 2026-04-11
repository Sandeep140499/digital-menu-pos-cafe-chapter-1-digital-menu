import { describe, it, expect } from 'vitest';
import { normalizeIndianMobile } from './indianMobile.js';

describe('normalizeIndianMobile', () => {
  it('returns last 10 digits for +91 and spaces', () => {
    expect(normalizeIndianMobile('+91 98765 43210')).toBe('9876543210');
    expect(normalizeIndianMobile('919876543210')).toBe('9876543210');
  });
  it('returns null for invalid or short input', () => {
    expect(normalizeIndianMobile('123')).toBe(null);
    expect(normalizeIndianMobile('5876543210')).toBe(null);
    expect(normalizeIndianMobile('')).toBe(null);
    expect(normalizeIndianMobile(null)).toBe(null);
  });
});
