import { useCallback } from "react";
import { API_BASE_URL } from "@/constants";
import { useAuth } from "@/hooks/useAuth";

export type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
};

/**
 * Centralized API fetch – same base URL and auth header everywhere.
 * Use this for consistent behavior and easy customization.
 */
export function useApi() {
  const { token, refresh, setSession } = useAuth();
  const fetchApi = useCallback(
    async <T = unknown>(path: string, options: ApiOptions = {}): Promise<T> => {
      const { method = "GET", body, headers = {} } = options;
      const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
      const doFetch = async (authToken: string | null) => {
        const reqHeaders: Record<string, string> = {
          ...headers,
          "Content-Type": "application/json",
        };
        if (authToken) reqHeaders.Authorization = `Bearer ${authToken}`;
        return fetch(url, {
          method,
          headers: reqHeaders,
          credentials: "include",
          ...(body != null && { body: JSON.stringify(body) }),
        });
      };

      let currentToken = token;
      let res = await doFetch(currentToken);
      if (res.status === 401) {
        // Attempt a single refresh + retry with the freshly issued token.
        currentToken = await refresh();
        res = await doFetch(currentToken);
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(
          (data as { message?: string }).message || "Request failed",
        );
        (err as Error & { status: number }).status = res.status;
        if (res.status === 401) {
          setSession(null, null);
        }
        throw err;
      }
      return data as T;
    },
    [refresh, setSession, token],
  );

  return { fetchApi, apiBase: API_BASE_URL };
}
