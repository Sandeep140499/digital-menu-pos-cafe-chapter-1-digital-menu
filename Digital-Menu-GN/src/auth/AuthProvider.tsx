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

const TOKEN_KEY = 'dm_auth_token';
const ROLE_KEY = 'dm_auth_role';

function readCookie(name: string) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${name.replace(/[$()*+./?[\\\]^{|}-]/g, '\\$&')}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

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
  const csrf = readCookie('csrf') || '';
  return fetch(url, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.headers || {}),
      'Content-Type': 'application/json',
      // Double-submit CSRF for auth cookie endpoints
      ...(path.startsWith('/auth/') || path.startsWith('/api/auth/')
        ? csrf
          ? { 'X-CSRF-Token': csrf }
          : {}
        : {}),
    },
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    // Access tokens are short-lived; we prefer restoring via refresh cookie on boot.
    // Keep a localStorage fallback for legacy deployments and offline reloads.
    return window.localStorage.getItem(TOKEN_KEY) || window.sessionStorage.getItem(TOKEN_KEY);
  });
  const [role, setRole] = useState<AuthRole | null>(() => {
    if (typeof window === 'undefined') return null;
    return (
      (window.localStorage.getItem(ROLE_KEY) as AuthRole | null) ??
      ((window.sessionStorage.getItem(ROLE_KEY) as AuthRole | null) ?? null)
    );
  });
  const [ready, setReady] = useState(false);
  const refreshing = useRef<Promise<string | null> | null>(null);
  const bootstrapped = useRef(false);
  /** Bumps on each new access-token session so a stale in-flight /auth/refresh cannot wipe a fresh login. */
  const sessionGeneration = useRef(0);

  const setSession = useCallback((t: string | null, r: AuthRole | null) => {
    if (typeof window !== 'undefined') {
      if (t) {
        sessionGeneration.current += 1;
        // Persist across refresh/tab close so UX doesn't depend on sessionStorage lifetime.
        window.localStorage.setItem(TOKEN_KEY, t);
        window.sessionStorage.setItem(TOKEN_KEY, t);
        if (r) {
          window.localStorage.setItem(ROLE_KEY, r);
          window.sessionStorage.setItem(ROLE_KEY, r);
        }
      } else {
        window.localStorage.removeItem(TOKEN_KEY);
        window.localStorage.removeItem(ROLE_KEY);
        window.sessionStorage.removeItem(TOKEN_KEY);
        window.sessionStorage.removeItem(ROLE_KEY);
      }
    }
    setToken(t);
    setRole(r);
    // Critical: bootstrap effect only runs once; if the user logs in before the first
    // /auth/refresh finishes, `ready` can stay false → RequireAuth renders null and
    // dashboards never mount (global login spinner never cleared).
    if (t) setReady(true);
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (refreshing.current) return refreshing.current;
    refreshing.current = (async () => {
      const genAtStart = sessionGeneration.current;
      // If we don't have a readable CSRF cookie yet, don't even attempt refresh.
      // (Backend enforces double-submit CSRF and will return 403.)
      if (!readCookie('csrf')) {
        // Cookies cleared (or another tab / domain issue) but access JWT still in storage —
        // without CSRF we cannot refresh; keeping the old token makes /login redirect away
        // and dashboards look "broken".
        if (typeof window !== 'undefined') {
          const hasStoredAccess =
            !!(window.localStorage.getItem(TOKEN_KEY) || window.sessionStorage.getItem(TOKEN_KEY));
          if (hasStoredAccess && genAtStart === sessionGeneration.current) setSession(null, null);
        }
        return null;
      }
      const res = await authFetch('/auth/refresh', { method: 'POST' });
      if (!res.ok) {
        // Invalid refresh or CSRF mismatch: drop client session so login works again.
        if (res.status === 401 || res.status === 403) {
          if (genAtStart === sessionGeneration.current) setSession(null, null);
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
  }, [setSession]);

  const login = useCallback(
    async (args: { email: string; password: string; loginAs?: 'admin' | 'employee' }) => {
      const doLogin = async (payload: typeof args) => {
        return authFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      };

      let res = await doLogin(args);
      // Some deployments still require explicitly specifying the role.
      // To keep the UI simple (no role picker), retry once as employee on 401.
      if (res.status === 401 && !args.loginAs) {
        res = await doLogin({ ...args, loginAs: 'employee' });
      }
      if (!res.ok) {
        const data: unknown = await res.json().catch(() => ({}));
        const msg =
          res.status === 403
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

  // Bootstrap once on mount: try refresh cookie; do not depend on `token` so logging in
  // does not re-trigger this effect (bootstrapped guard made those runs no-ops anyway).
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    // Do not set `ready` early just because a token exists — refresh may clear a stale
    // session; otherwise /login immediately redirects with a dead JWT.
    void refresh().catch(() => setReady(true));
  }, [refresh]);

  /**
   * Keep access token fresh while the app is open (especially staff taking orders).
   * Without this, short JWTs expire → API 401 and Socket.IO stops joining branch rooms.
   */
  useEffect(() => {
    if (!token || !ready) return;
    const intervalMs = (() => {
      try {
        const part = token.split('.')[1];
        if (!part) return 8 * 60_000;
        const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
        const exp = (JSON.parse(json) as { exp?: number }).exp;
        if (typeof exp !== 'number') return 8 * 60_000;
        const ttlMs = exp * 1000 - Date.now();
        if (ttlMs <= 0) return 60_000;
        // Refresh at ~1/3 of remaining lifetime, between 2m and 10m.
        const third = Math.floor(ttlMs / 3);
        return Math.min(10 * 60_000, Math.max(2 * 60_000, third));
      } catch {
        return 8 * 60_000;
      }
    })();
    const id = window.setInterval(() => {
      void refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [token, ready, refresh]);

  // When returning to the tab, refresh once so a stale token is fixed before the next order action.
  useEffect(() => {
    if (!token || !ready) return;
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      void refresh();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [token, ready, refresh]);

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
