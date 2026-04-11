/**
 * Canonical Indian mobile for storage and matching: last 10 digits, must start with 6–9.
 * Strips spaces, +91, etc. Use everywhere we persist or compare customerMobile on orders.
 */
export function normalizeIndianMobile(input: string | null | undefined): string | null {
  if (input == null) return null;
  const digits = String(input).replace(/\D/g, '').slice(-10);
  if (digits.length !== 10 || !/^[6-9]/.test(digits)) return null;
  return digits;
}
