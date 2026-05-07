/**
 * Single source of truth for frontend (dashboard/customer) base URL used in emails/redirects.
 *
 * Prefer `FRONTEND_URL` in production, e.g. FRONTEND_URL=https://cafechapter1.online
 * If you only set `CORS_ORIGIN` for the API, its first origin is also used for email links
 * (so invites are not built with localhost when FRONTEND_URL was omitted by mistake).
 */

function normalizeUrl(raw: string): string {
  return raw
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\/$/, '');
}

function splitCommaOrigins(raw: string): string[] {
  return raw
    .split(',')
    .map(o =>
      o
        .trim()
        .replace(/^['"]|['"]$/g, '')
        .replace(/\/$/, '')
    )
    .filter(Boolean);
}

/** FRONTEND_* first, then first entry from CORS_ORIGIN (same merge idea as server CORS). */
export function pickFrontendBaseUrlFromEnv(): string | null {
  const primary =
    process.env.FRONTEND_URL ||
    process.env.FRONTEND_DASHBOARD_URL ||
    process.env.FRONTEND_CUSTOMER_URL;
  if (primary) {
    const first = splitCommaOrigins(primary)[0];
    if (first) return normalizeUrl(first);
  }

  const cors = process.env.CORS_ORIGIN?.trim();
  if (cors) {
    const first = splitCommaOrigins(cors)[0];
    if (first) return normalizeUrl(first);
  }

  return null;
}

const SUSPICIOUS_INFER_ORIGIN_HOSTS = new Set(
  [
    'mail.google.com',
    'inbox.google.com',
    'outlook.live.com',
    'outlook.office.com',
    'outlook.office365.com',
    'mail.yahoo.com',
    'yahoo.com',
    'proton.me',
    'protonmail.com',
  ].map(h => h.toLowerCase())
);

function isSuspiciousInferHost(hostname: string): boolean {
  const h = hostname.toLowerCase();
  if (SUSPICIOUS_INFER_ORIGIN_HOSTS.has(h)) return true;
  return h.endsWith('.googleusercontent.com');
}

type HeaderGetter = { get(name: string): string | undefined };

/**
 * Infer the SPA origin from the incoming HTTP request (no env).
 * - Uses `Origin` when present (typical for admin dashboard XHR).
 * - Uses `Referer` only when the path looks like our employee verify handoff page
 *   (browser opened /employee/verify-email then redirected to the API).
 * Does not trust arbitrary Referer hosts (e.g. webmail).
 */
export function tryInferFrontendBaseUrlFromRequest(req: HeaderGetter): string | null {
  const originHeader = req.get('origin')?.trim();
  if (originHeader) {
    try {
      const u = new URL(originHeader);
      if (u.protocol === 'http:' || u.protocol === 'https:') {
        if (!isSuspiciousInferHost(u.hostname)) {
          return normalizeUrl(originHeader);
        }
      }
    } catch {
      // ignore
    }
  }

  const referer = req.get('referer')?.trim();
  if (referer) {
    try {
      const u = new URL(referer);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      if (isSuspiciousInferHost(u.hostname)) return null;
      const path = u.pathname || '';
      if (path.includes('/employee/verify-email')) {
        return normalizeUrl(`${u.protocol}//${u.host}`);
      }
    } catch {
      // ignore
    }
  }

  return null;
}

export function getFrontendBaseUrl(): string {
  return pickFrontendBaseUrlFromEnv() ?? 'http://localhost:5173';
}

const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';

/**
 * Base URL for links placed in outbound email and public verify redirects.
 * Order: env (FRONTEND_* or first CORS_ORIGIN) → safe inference from request → dev localhost.
 * In production, if nothing is configured and the request cannot be inferred, throws so
 * misconfigured deploys fail loudly instead of emailing http://localhost links.
 */
export function resolveFrontendBaseUrlForEmail(req?: HeaderGetter): string {
  const fromEnv = pickFrontendBaseUrlFromEnv();
  if (fromEnv) return fromEnv;

  if (req) {
    const inferred = tryInferFrontendBaseUrlFromRequest(req);
    if (inferred) return inferred;
  }

  if (isProd) {
    throw new Error(
      'Public frontend URL is not configured: set FRONTEND_URL (recommended) or CORS_ORIGIN ' +
        'to your deployed site origin, e.g. FRONTEND_URL=https://your-domain.com. ' +
        'Otherwise verification and password-reset emails cannot contain valid links.'
    );
  }

  return normalizeUrl('http://localhost:5173');
}
