import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "@/constants";

/**
 * Employee confirm-email handler (when account is created with temp password).
 * Link in email points to /employee/confirm-email?token=...
 * We redirect to the backend to confirm and show success HTML.
 */
export default function EmployeeConfirmEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";

  useEffect(() => {
    if (!token) {
      window.location.href = "/login?error=missing-token";
      return;
    }
    const backendUrl = `${API_BASE_URL.replace(/\/$/, "")}/employees/confirm-email?token=${encodeURIComponent(token)}`;
    window.location.href = backendUrl;
  }, [token]);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-slate-100 p-4">
      <div className="text-center">
        <p className="text-slate-600">Confirming your email…</p>
        <p className="mt-2 text-sm text-slate-500">Redirecting you to complete verification.</p>
      </div>
    </div>
  );
}
