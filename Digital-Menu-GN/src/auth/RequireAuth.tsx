import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useGlobalLoading } from '@/components/GlobalLoadingProvider';

export function RequireAuth({
  children,
  role,
}: {
  children: ReactNode;
  role?: 'ADMIN' | 'EMPLOYEE';
}) {
  const { isAuthenticated, role: currentRole, ready } = useAuth();
  const { stopGlobalLoading } = useGlobalLoading();

  // Never let the full-screen global loader "trap" the UI.
  // If auth is not satisfied and we are about to redirect, clear the overlay so buttons work.
  useEffect(() => {
    if (!ready) return;
    if (!isAuthenticated) {
      stopGlobalLoading();
      return;
    }
    if (role && currentRole !== role) {
      stopGlobalLoading();
    }
  }, [ready, isAuthenticated, role, currentRole, stopGlobalLoading]);

  if (!ready) {
    return (
      <div
        className="flex min-h-[100dvh] min-h-screen items-center justify-center bg-slate-50"
        role="status"
        aria-live="polite"
        aria-label="Checking session"
      >
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && currentRole !== role) {
    if (currentRole === 'ADMIN') return <Navigate to="/admin" replace />;
    if (currentRole === 'EMPLOYEE') return <Navigate to="/employee" replace />;
    return <Navigate to="/login" replace />;
  }

  return children;
}
