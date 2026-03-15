import { useCallback, useMemo, useState } from "react";

const TOKEN_KEY = "dm_auth_token";
const ROLE_KEY = "dm_auth_role";

export type AuthRole = "ADMIN" | "EMPLOYEE";

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(() =>
    typeof window !== "undefined" ? window.sessionStorage.getItem(TOKEN_KEY) : null
  );
  const [role, setRoleState] = useState<AuthRole | null>(() =>
    typeof window !== "undefined"
      ? (window.sessionStorage.getItem(ROLE_KEY) as AuthRole | null)
      : null
  );

  const setAuth = useCallback((newToken: string | null, newRole: AuthRole | null) => {
    if (typeof window === "undefined") return;
    if (newToken) {
      window.sessionStorage.setItem(TOKEN_KEY, newToken);
      if (newRole) window.sessionStorage.setItem(ROLE_KEY, newRole);
    } else {
      window.sessionStorage.removeItem(TOKEN_KEY);
      window.sessionStorage.removeItem(ROLE_KEY);
    }
    setTokenState(newToken);
    setRoleState(newRole);
  }, []);

  const logout = useCallback(() => {
    setAuth(null, null);
    window.location.href = "/login";
  }, [setAuth]);

  const isAdmin = role === "ADMIN";
  const isEmployee = role === "EMPLOYEE";

  return useMemo(
    () => ({
      token,
      role,
      setAuth,
      logout,
      isAdmin,
      isEmployee,
      isAuthenticated: !!token,
    }),
    [token, role, setAuth, logout, isAdmin, isEmployee]
  );
}
