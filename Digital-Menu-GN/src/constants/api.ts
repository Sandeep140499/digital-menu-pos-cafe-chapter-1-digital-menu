/**
 * API configuration – single source for base URL.
 * In development, "/api" is proxied to the backend (see vite.config proxy).
 * Override via env VITE_API_BASE_URL for production or custom backend.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "http://localhost:4000/api");

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

/**
 * Frontend base URL for redirects, email verification links (when built by frontend), etc.
 * Set VITE_FRONTEND_URL in production to your deployed domain (e.g. https://yourdomain.com).
 * Falls back to window.location.origin when available (browser), else dev default.
 */
export function getFrontendUrl(): string {
  if (
    typeof import.meta.env.VITE_FRONTEND_URL === "string" &&
    import.meta.env.VITE_FRONTEND_URL
  ) {
    return import.meta.env.VITE_FRONTEND_URL.replace(/\/$/, "");
  }
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return import.meta.env.DEV ? "http://localhost:3000" : "";
}
