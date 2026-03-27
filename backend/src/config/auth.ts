export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'dev-secret',
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  refreshTokenSalt: process.env.REFRESH_TOKEN_SALT || 'dev-refresh-salt',
};

export const authCookieConfig = {
  // For cross-site SPA (frontend + backend on different domains), you typically need SameSite=None + Secure.
  // Keep this configurable so local dev works over http.
  sameSite: (process.env.AUTH_COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none',
  domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
};
