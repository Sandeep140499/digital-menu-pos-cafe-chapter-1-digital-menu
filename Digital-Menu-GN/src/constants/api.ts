/**
 * API configuration – single source for base URL.
 * In development, "/api" is proxied to the backend (see vite.config proxy).
 * Override via env VITE_API_BASE_URL for production or custom backend.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  // In production we default to "/api" (same-origin) so deployments that reverse-proxy
  // the backend under the same domain work out of the box. Never default to localhost
  // in production because it breaks on customer devices.
  (import.meta.env.DEV ? '/api' : '/api');

function parsePositiveBranchId(value: string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number.parseInt(String(value).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Branch id baked into the build (e.g. Katwaria menu on a separate Vercel project).
 * Set `VITE_PUBLIC_BRANCH_ID` in that project's env to the Prisma `Branch.id`.
 */
export function getCustomerBranchIdFromEnv(): number | null {
  const v = import.meta.env.VITE_PUBLIC_BRANCH_ID;
  if (v == null || v === '') return null;
  return parsePositiveBranchId(String(v));
}

/** Parse `?branch=` or `?branchId=` from a query string (with or without leading `?`). */
export function getCustomerBranchIdFromSearch(search: string): number | null {
  const q = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(q);
  return parsePositiveBranchId(params.get('branch') || params.get('branchId'));
}

/**
 * Which branch the public customer menu should use for contact, ordering, and checkout.
 * URL query wins (useful for testing); then `VITE_PUBLIC_BRANCH_ID`; then null (server default).
 */
export function resolveCustomerPublicBranchId(): number | null {
  if (typeof window !== 'undefined') {
    const fromUrl = getCustomerBranchIdFromSearch(window.location.search);
    if (fromUrl != null) return fromUrl;
  }
  return getCustomerBranchIdFromEnv();
}

/** `?branchId=n` for public config APIs, or empty string when using server default. */
export function publicBranchQuery(publicBranchId: number | null): string {
  return publicBranchId != null ? `?branchId=${publicBranchId}` : '';
}

/** Default request timeout (ms). Prevents UI from hanging when backend is slow. */
export const API_TIMEOUT_MS = 25000;

/**
 * Fetch with timeout. Aborts the request after ms; rejects with DOMException (AbortError) on timeout.
 * Use for dashboard and page loads so slow APIs don't hang the app.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit & { timeout?: number }
): Promise<Response> {
  const timeout = init?.timeout ?? API_TIMEOUT_MS;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(input, {
      ...init,
      signal: init?.signal ?? controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

function isRetryableFetchError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === 'AbortError') return true;
  if (e instanceof Error && e.name === 'AbortError') return true;
  // Chrome/Edge: "Failed to fetch"; Firefox: NetworkError when receiving an empty response
  if (e instanceof TypeError) return true;
  return false;
}

/**
 * Like fetchWithTimeout but retries a few times on timeout / transient network errors.
 * Use for dashboard batch loads where many parallel requests compete for browser connection slots.
 */
export async function fetchWithTimeoutRetry(
  input: RequestInfo | URL,
  init?: RequestInit & { timeout?: number },
  maxAttempts = 3
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetchWithTimeout(input, init);
      // Deployment cold starts / proxy blips often return 502–504 once.
      if (!res.ok && [502, 503, 504].includes(res.status) && attempt < maxAttempts - 1) {
        await new Promise(r => setTimeout(r, 400 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (e) {
      lastError = e;
      if (attempt < maxAttempts - 1 && isRetryableFetchError(e)) {
        await new Promise(r => setTimeout(r, 350 * (attempt + 1)));
        continue;
      }
      throw e;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Request failed after retries');
}

/**
 * User-facing message when fetch throws (timeout, DNS, CORS, wrong API URL) — no Response to parse.
 */
export function describeFetchFailure(error: unknown): string {
  const isAbort =
    (error instanceof DOMException || error instanceof Error) && error.name === 'AbortError';
  if (isAbort) {
    return 'The request timed out. Railway cold starts can take 30–90 seconds — wait a bit and try again, or open your API URL in a new tab once to wake the service.';
  }
  if (error instanceof TypeError) {
    const msg = String(error.message || '');
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return 'Could not reach the API. Confirm VITE_API_BASE_URL in your frontend build matches your Railway URL (ending in /api), then redeploy. If the URL is correct, the backend may be sleeping — retry in a minute.';
    }
    return 'Could not reach the server. Check your connection and API URL, then try again.';
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Network error or server unreachable. If the API is on Railway, wait for it to wake up and try again.';
}

/**
 * Frontend base URL for redirects, email verification links (when built by frontend), etc.
 * Set VITE_FRONTEND_URL in production to your deployed domain (e.g. https://yourdomain.com).
 * Falls back to window.location.origin when available (browser), else dev default.
 */
/**
 * Human-readable message for failed fetch responses (handles 502–504 HTML bodies from Railway).
 */
export async function readApiErrorMessage(res: Response): Promise<string> {
  const st = res.status;
  if (st === 401) {
    return 'Your session expired. Sign in again and retry.';
  }
  if (st === 403) {
    return 'You don’t have permission for this action. Use an admin account or ask the owner.';
  }
  if (st === 503 || st === 502 || st === 504) {
    return 'Server is temporarily unavailable (Railway may be waking up or busy). Wait a minute and try again.';
  }
  const raw = await res.text().catch(() => '');
  const t = raw.trim();
  if (t.startsWith('<!') || /<html[\s>]/i.test(t)) {
    return `Server error (${st}). The app may be restarting — try again in a minute.`;
  }
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const err = JSON.parse(t) as {
        message?: string;
        errors?: Array<{ path?: (string | number)[]; message?: string }>;
      };
      const issues = Array.isArray(err.errors) ? err.errors : [];
      if (issues.length > 0) {
        return issues
          .slice(0, 4)
          .map(i => {
            const p = Array.isArray(i.path) && i.path.length > 0 ? i.path.join('.') : 'field';
            return `${p}: ${i.message || 'Invalid'}`;
          })
          .join(' | ');
      }
      if (typeof err.message === 'string' && err.message.trim()) return err.message.trim();
    } catch {
      // fall through
    }
  }
  if (t.length > 0) return t.slice(0, 280);
  return `Request failed (${st})`;
}

export function getFrontendUrl(): string {
  if (typeof import.meta.env.VITE_FRONTEND_URL === 'string' && import.meta.env.VITE_FRONTEND_URL) {
    return import.meta.env.VITE_FRONTEND_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return import.meta.env.DEV ? 'http://localhost:3000' : '';
}
