export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'dev-secret',
  /** Short-lived access token (default). Used for ADMIN logins. */
  accessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
  /**
   * Longer access token for EMPLOYEE so staff can work a full shift without
   * repeated logins. Refresh cookie (7d) still rotates for security.
   */
  employeeAccessExpiresIn: process.env.JWT_EMPLOYEE_ACCESS_EXPIRES_IN || '12h',
  refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  refreshTokenSalt: process.env.REFRESH_TOKEN_SALT || 'dev-refresh-salt',
};

export const authCookieConfig = {
  // For cross-site SPA (frontend + backend on different domains), you typically need SameSite=None + Secure.
  // Keep this configurable so local dev works over http.
  sameSite: (process.env.AUTH_COOKIE_SAMESITE || 'lax') as 'lax' | 'strict' | 'none',
  domain: process.env.AUTH_COOKIE_DOMAIN || undefined,
};
