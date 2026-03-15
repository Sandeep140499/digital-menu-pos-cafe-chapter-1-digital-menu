/**
 * API configuration – single source for base URL.
 * In development, "/api" is proxied to the backend (see vite.config proxy).
 * Override via env VITE_API_BASE_URL for production or custom backend.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.DEV ? "/api" : "http://localhost:4000/api");
