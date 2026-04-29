import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { API_BASE_URL } from '@/constants';
import {
  AUTH_ROLE_KEY,
  AUTH_TOKEN_KEY,
  computeProactiveRefreshIntervalMs,
  isAccessTokenUsable,
  readBrowserCookie,
  readRoleFromAccessToken,
  readStoredAccessToken,
  VISIBILITY_REFRESH_DEBOUNCE_MS,
  VISIBILITY_REFRESH_MIN_REMAINING_MS,
} from '@/auth/authSession';

export type AuthRole = 'ADMIN' | 'EMPLOYEE';

export type AuthContextValue = {
  token: string | null;
  role: AuthRole | null;
  ready: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  login: (args: {
    email: string;
    password: string;
    loginAs?: 'admin' | 'employee';
  }) => Promise<AuthRole>;
  logout: () => Promise<void>;
  refresh: () => Promise<string | null>;
  setSession: (token: string | null, role: AuthRole | null) => void;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

function extractMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const o = payload as Record<string, unknown>;
  const msg = o.message;
  if (typeof msg === 'string' && msg.trim()) return msg.trim();
  const errors = o.errors;
  if (Array.isArray(errors) && errors.length > 0) {
    const first = errors[0] as { message?: string; path?: unknown };
    if (typeof first?.message === 'string') return first.message;
  }
  return undefined;
}

async function authFetch(path: string, init: RequestInit = {}) {
  const url = path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  const csrf = readBrowserCookie('csrf') || '';
  return fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.headers || {}),
      'Content-Type': 'application/json',
      ...(path.startsWith('/auth/') || path.startsWith('/api/auth/')
        ? csrf
          ? { 'X-CSRF-Token': csrf }
          : {}
        : {}),
    },
  });
}

/**
 * Session policy (high level):
 * - Access JWT in storage drives “logged in” for the SPA; refresh cookie + CSRF renew it.
 * - Failed /auth/refresh does NOT log the user out while the access JWT is still usable
 *   (multi-tab refresh rotation, transient CSRF, or focus-related timing).
 * - We only clear the client session when refresh failed and the access token is no longer usable,
 *   or when there is no CSRF and the access token is already unusable (cannot recover).
 * - Focus / bfcache: refresh only if the token is near expiry, debounced, to avoid spurious calls.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(AUTH_TOKEN_KEY) || window.sessionStorage.getItem(AUTH_TOKEN_KEY);
  });
  const [role, setRole] = useState<AuthRole | null>(() => {
    if (typeof window === 'undefined') return null;
    const fromLocal = window.localStorage.getItem(AUTH_ROLE_KEY) as AuthRole | null;
    const fromSession = window.sessionStorage.getItem(AUTH_ROLE_KEY) as AuthRole | null;
    const fromStorage = fromLocal ?? fromSession;
    if (fromStorage === 'ADMIN' || fromStorage === 'EMPLOYEE') return fromStorage;
    const tok =
      window.localStorage.getItem(AUTH_TOKEN_KEY) || window.sessionStorage.getItem(AUTH_TOKEN_KEY);
    return readRoleFromAccessToken(tok);
  });
  const [ready, setReady] = useState(false);
  const refreshing = useRef<Promise<string | null> | null>(null);
  const bootstrapped = useRef(false);
  const sessionGeneration = useRef(0);
  const lastFocusRefreshAtRef = useRef(0);
  const last429ErrorAtRef = useRef(0);

  const setSession = useCallback((t: string | null, r: AuthRole | null) => {
    if (typeof window !== 'undefined') {
      if (t) {
        sessionGeneration.current += 1;
        window.localStorage.setItem(AUTH_TOKEN_KEY, t);
        window.sessionStorage.setItem(AUTH_TOKEN_KEY, t);
        const roleToStore = r ?? readRoleFromAccessToken(t);
        if (roleToStore) {
          window.localStorage.setItem(AUTH_ROLE_KEY, roleToStore);
          window.sessionStorage.setItem(AUTH_ROLE_KEY, roleToStore);
        }
      } else {
        window.localStorage.removeItem(AUTH_TOKEN_KEY);
        window.localStorage.removeItem(AUTH_ROLE_KEY);
        window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
        window.sessionStorage.removeItem(AUTH_ROLE_KEY);
      }
    }
    setToken(t);
    setRole(r ?? (t ? readRoleFromAccessToken(t) : null));
    if (t) setReady(true);
  }, []);

  const invalidateSessionIfRefreshCannotRecover = useCallback(
    (genAtStart: number) => {
      const stored = readStoredAccessToken();
      if (stored != null && isAccessTokenUsable(stored)) return;
      if (genAtStart !== sessionGeneration.current) return;
      setSession(null, null);
    },
    [setSession]
  );

  const refresh = useCallback(async (): Promise<string | null> => {
    if (refreshing.current) return refreshing.current;
    refreshing.current = (async () => {
      const genAtStart = sessionGeneration.current;

      // Check if we recently got a 429 error and back off
      const now = Date.now();
      const timeSinceLast429 = now - last429ErrorAtRef.current;
      if (timeSinceLast429 < 60000) { // 1 minute backoff
        console.log(`Backing off refresh due to recent 429 error (${Math.round((60000 - timeSinceLast429) / 1000)}s remaining)`);
        return null;
      }

      if (!readBrowserCookie('csrf')) {
        invalidateSessionIfRefreshCannotRecover(genAtStart);
        return null;
      }

      const res = await authFetch('/auth/refresh', {
        method: 'POST',
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) {
        if (res.status === 429) {
          // Rate limited - don't log out, just back off
          last429ErrorAtRef.current = now;
          console.warn('Rate limited on refresh (429), backing off for 1 minute');
          return null;
        }
        if (res.status === 401 || res.status === 403) {
          invalidateSessionIfRefreshCannotRecover(genAtStart);
        }
        return null;
      }

      const data = (await res.json()) as { accessToken: string; role: AuthRole };
      setSession(data.accessToken, data.role);
      return data.accessToken;
    })().finally(() => {
      refreshing.current = null;
      setReady(true);
    });
    return refreshing.current;
  }, [invalidateSessionIfRefreshCannotRecover, setSession]);

  const scheduleProactiveRefreshOnFocus = useCallback(() => {
    const t = readStoredAccessToken();
    if (!t) return;
    if (isAccessTokenUsable(t, VISIBILITY_REFRESH_MIN_REMAINING_MS)) return;
    const now = Date.now();
    if (now - lastFocusRefreshAtRef.current < VISIBILITY_REFRESH_DEBOUNCE_MS) return;
    lastFocusRefreshAtRef.current = now;
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (args: { email: string; password: string; loginAs?: 'admin' | 'employee' }) => {
      const doLogin = async (payload: typeof args) => {
        return authFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(45_000),
        });
      };

      let res = await doLogin(args);
      if (res.status === 401 && !args.loginAs) {
        res = await doLogin({ ...args, loginAs: 'employee' });
      }
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const msg =
          res.status === 429
            ? 'Too many login attempts. Please wait a few minutes and try again.'
            : res.status === 403
              ? extractMessage(data) || 'Please verify your email before logging in.'
              : extractMessage(data) || 'Login failed';
        throw new Error(msg);
      }
      const data = (await res.json()) as { accessToken: string; role: AuthRole };
      setSession(data.accessToken, data.role);
      return data.role;
    },
    [setSession]
  );

  const logout = useCallback(async () => {
    try {
      await authFetch('/auth/logout', { method: 'POST' });
    } finally {
      setSession(null, null);
    }
  }, [setSession]);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    void refresh().catch(() => setReady(true));
  }, [refresh]);

  useEffect(() => {
    if (!token || !ready) return;
    const intervalMs = computeProactiveRefreshIntervalMs(token);
    const id = window.setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [token, ready, refresh]);

  useEffect(() => {
    if (!token || !ready) return;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      scheduleProactiveRefreshOnFocus();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) scheduleProactiveRefreshOnFocus();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [token, ready, scheduleProactiveRefreshOnFocus]);

  const value = useMemo<AuthContextValue>(() => {
    const isAdmin = role === 'ADMIN';
    const isEmployee = role === 'EMPLOYEE';
    return {
      token,
      role,
      ready,
      isAuthenticated: !!token,
      isAdmin,
      isEmployee,
      login,
      logout,
      refresh,
      setSession,
    };
  }, [token, role, ready, login, logout, refresh, setSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
