import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
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
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (role && currentRole !== role) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
