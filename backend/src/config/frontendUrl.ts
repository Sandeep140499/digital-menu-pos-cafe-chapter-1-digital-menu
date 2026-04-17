function normalizeUrl(raw: string): string {
  return raw
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/$/, '');
}

/**
 * Single source of truth for frontend (dashboard/customer) base URL used in emails/redirects.
 *
 * Set `FRONTEND_URL` in production to your deployed domain, e.g.:
 *   FRONTEND_URL=https://cafechapter1.online
 *
 * Fallback envs are supported for backward compatibility.
 */
export function getFrontendBaseUrl(): string {
  const raw =
    process.env.FRONTEND_URL ||
    process.env.FRONTEND_DASHBOARD_URL ||
    process.env.FRONTEND_CUSTOMER_URL ||
    'http://localhost:5173';
  return normalizeUrl(raw);
}

