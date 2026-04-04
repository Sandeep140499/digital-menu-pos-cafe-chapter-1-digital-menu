import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export function RequireAuth({
  children,
  role,
}: {
  children: ReactNode;
  role?: 'ADMIN' | 'EMPLOYEE';
}) {
  const { isAuthenticated, role: currentRole, ready } = useAuth();

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
