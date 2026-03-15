import { useCallback } from "react";
import { API_BASE_URL } from "@/constants";

export type ApiOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  token?: string | null;
  headers?: Record<string, string>;
};

/**
 * Centralized API fetch – same base URL and auth header everywhere.
 * Use this for consistent behavior and easy customization.
 */
export function useApi() {
  const fetchApi = useCallback(
    async (path: string, options: ApiOptions = {}) => {
      const { method = "GET", body, token, headers = {} } = options;
      const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
      const reqHeaders: Record<string, string> = {
        ...headers,
        "Content-Type": "application/json",
      };
      if (token) reqHeaders.Authorization = `Bearer ${token}`;

      const res = await fetch(url, {
        method,
        headers: reqHeaders,
        ...(body != null && { body: JSON.stringify(body) }),
      });

      const data = await res.json();
      if (!res.ok) {
        const err = new Error((data as { message?: string }).message || "Request failed");
        (err as Error & { status: number }).status = res.status;
        throw err;
      }
      return data;
    },
    []
  );

  return { fetchApi, apiBase: API_BASE_URL };
}
