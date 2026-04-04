import crypto from 'node:crypto';
import type { Response, Request } from 'express';
import { jwtConfig, authCookieConfig } from '../config/auth.js';

export type AuthRole = 'ADMIN' | 'EMPLOYEE';

export function sha256Base64Url(input: string) {
  return crypto.createHash('sha256').update(input).digest('base64url');
}

export function hashRefreshToken(rawToken: string) {
  return sha256Base64Url(`${jwtConfig.refreshTokenSalt}:${rawToken}`);
}

export function generateOpaqueToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function generateCsrfToken() {
  return crypto.randomBytes(24).toString('base64url');
}

export function isProduction() {
  return (process.env.NODE_ENV || 'development') === 'production';
}

export function getCookieSecureFlag(req?: Request) {
  // In production we enforce Secure. In dev, allow http on localhost.
  if (isProduction()) return true;
  // If behind proxy and request is https, still allow Secure cookies.
  const proto = (req?.headers['x-forwarded-proto'] as string | undefined) || '';
  return proto.includes('https');
}

export function setAuthCookies(
  req: Request,
  res: Response,
  opts: { refreshToken: string; csrfToken: string; refreshExpiresAt: Date }
) {
  const secure = getCookieSecureFlag(req);
  const sameSite =
    secure && authCookieConfig.sameSite === 'none' ? 'none' : authCookieConfig.sameSite;

  // Refresh token: HttpOnly so JS can't read it.
  res.cookie('rt', opts.refreshToken, {
    httpOnly: true,
    secure,
    sameSite,
    domain: authCookieConfig.domain,
    path: '/api/auth',
    expires: opts.refreshExpiresAt,
  });

  // CSRF token: readable by JS (double-submit).
  // IMPORTANT: cookie `path` also affects visibility via `document.cookie` in the browser.
  // If we scope CSRF to `/api/auth`, pages like `/admin` won't be able to read it, and
  // silent refresh will fail forever (leading to logouts when access tokens expire).
  res.cookie('csrf', opts.csrfToken, {
    httpOnly: false,
    secure,
    sameSite,
    domain: authCookieConfig.domain,
    path: '/',
    expires: opts.refreshExpiresAt,
  });
}

export function clearAuthCookies(req: Request, res: Response) {
  const secure = getCookieSecureFlag(req);
  const sameSite =
    secure && authCookieConfig.sameSite === 'none' ? 'none' : authCookieConfig.sameSite;

  const base = {
    secure,
    sameSite,
    domain: authCookieConfig.domain,
    path: '/api/auth',
  } as const;

  res.clearCookie('rt', base);
  // Clear CSRF on `/` (see setAuthCookies path notes).
  res.clearCookie('csrf', {
    secure,
    sameSite,
    domain: authCookieConfig.domain,
    path: '/',
  } as any);
}

export function requireCsrfDoubleSubmit(req: Request) {
  const csrfCookie = (req as any).cookies?.csrf as string | undefined;
  const csrfHeader = (req.headers['x-csrf-token'] as string | undefined) || '';
  if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
    return false;
  }
  return true;
}
