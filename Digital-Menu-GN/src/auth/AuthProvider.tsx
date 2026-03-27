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
  const msg = (payload as Record<string, unknown>).message;
  return typeof msg === 'string' ? msg : undefined;
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
    return window.sessionStorage.getItem(TOKEN_KEY);
  });
  const [role, setRole] = useState<AuthRole | null>(() => {
    if (typeof window === 'undefined') return null;
    return (window.sessionStorage.getItem(ROLE_KEY) as AuthRole | null) ?? null;
  });
  const [ready, setReady] = useState(false);
  const refreshing = useRef<Promise<string | null> | null>(null);
  const bootstrapped = useRef(false);

  const setSession = useCallback((t: string | null, r: AuthRole | null) => {
    if (typeof window !== 'undefined') {
      if (t) {
        window.sessionStorage.setItem(TOKEN_KEY, t);
        if (r) window.sessionStorage.setItem(ROLE_KEY, r);
      } else {
        window.sessionStorage.removeItem(TOKEN_KEY);
        window.sessionStorage.removeItem(ROLE_KEY);
      }
    }
    setToken(t);
    setRole(r);
  }, []);

  const refresh = useCallback(async (): Promise<string | null> => {
    if (refreshing.current) return refreshing.current;
    refreshing.current = (async () => {
      // If we don't have a readable CSRF cookie yet, don't even attempt refresh.
      // (Backend enforces double-submit CSRF and will return 403.)
      if (!readCookie('csrf')) return null;
      const res = await authFetch('/auth/refresh', { method: 'POST' });
      if (!res.ok) {
        // Important: if refresh cookies aren't present (or CSRF fails),
        // do NOT wipe an existing access token. That would change legacy behavior.
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

  // Bootstrap: if refresh cookie exists, grab a fresh access token.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    // If we already have a token from sessionStorage, we're "ready" immediately
    // (same UX as before). Refresh can still run in background.
    if (token) setReady(true);
    void refresh().catch(() => setReady(true));
  }, [refresh, token]);

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
