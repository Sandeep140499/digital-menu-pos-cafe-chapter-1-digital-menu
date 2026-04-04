/**
 * Client-side session helpers for staff auth (access JWT in storage + refresh cookie on server).
 * Keeps JWT parsing and “when is it safe to stay logged in?” rules in one testable place.
 */

export const AUTH_TOKEN_KEY = 'dm_auth_token';
export const AUTH_ROLE_KEY = 'dm_auth_role';

/** Treat token as expired this many ms before real exp to avoid edge 401s from clock skew. */
export const ACCESS_TOKEN_CLOCK_SKEW_MS = 15_000;

/** On tab focus, skip proactive refresh if the access token has at least this much life left. */
export const VISIBILITY_REFRESH_MIN_REMAINING_MS = 60_000;

/** Avoid back-to-back focus refreshes when users alt-tab quickly (same in-flight refresh is still deduped). */
export const VISIBILITY_REFRESH_DEBOUNCE_MS = 800;

const JWT_PARTS = 3;

export function readStoredAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_TOKEN_KEY) || window.sessionStorage.getItem(AUTH_TOKEN_KEY);
}

export function readBrowserCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[$()*+./?[\\\]^{|}-]/g, '\\$&')}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function base64UrlToJson(payload: string): unknown {
  const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
  const json = atob(normalized);
  return JSON.parse(json);
}

/** Unix expiry in ms, or null if missing / unparsable. */
export function readAccessTokenExpiryMs(token: string | null): number | null {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== JWT_PARTS || !parts[1]) return null;
  try {
    const body = base64UrlToJson(parts[1]) as { exp?: number };
    return typeof body.exp === 'number' ? body.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Whether the access token is still OK to use for API calls.
 * @param minRemainingMs — require at least this much lifetime after skew (e.g. 60s before forcing a refresh on focus).
 */
export function isAccessTokenUsable(token: string | null, minRemainingMs = ACCESS_TOKEN_CLOCK_SKEW_MS): boolean {
  if (!token) return false;
  const expMs = readAccessTokenExpiryMs(token);
  if (expMs == null) return true;
  return expMs > Date.now() + minRemainingMs;
}

/**
 * Proactive refresh interval: ~⅓ of remaining TTL, clamped between 2m and 10m (admin short JWT vs employee longer).
 */
export function computeProactiveRefreshIntervalMs(token: string): number {
  const fallback = 8 * 60_000;
  const expMs = readAccessTokenExpiryMs(token);
  if (expMs == null) return fallback;
  const ttlMs = expMs - Date.now();
  if (ttlMs <= 0) return 60_000;
  const third = Math.floor(ttlMs / 3);
  return Math.min(10 * 60_000, Math.max(2 * 60_000, third));
}
