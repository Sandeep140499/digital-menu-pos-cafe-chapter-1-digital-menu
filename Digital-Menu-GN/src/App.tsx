import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LandingWithSplash from './components/LandingWithSplash';
import NetworkStatusToasts from './components/NetworkStatusToasts';
import Login from './pages/common/Login';
import NotFound from './pages/common/NotFound';
import AdminDashboard from './pages/admin/AdminDashboard';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import EmployeeVerifyEmail from './pages/employee/EmployeeVerifyEmail';
import EmployeeConfirmEmail from './pages/employee/EmployeeConfirmEmail';
import ResetPassword from './pages/common/ResetPassword';
import PrivacyPolicy from './pages/common/PrivacyPolicy';
import { GlobalLoadingProvider } from './components/GlobalLoadingProvider';
import { AuthProvider } from '@/auth/AuthProvider';
import { RequireAuth } from '@/auth/RequireAuth';

import RefundPolicy from './pages/common/RefundPolicy';
import TermsAndConditions from './pages/common/TermsAndConditions';

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <GlobalLoadingProvider>
          <Toaster />
          <NetworkStatusToasts />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<LandingWithSplash />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/admin"
                element={
                  <RequireAuth role="ADMIN">
                    <AdminDashboard />
                  </RequireAuth>
                }
              />
              <Route
                path="/employee"
                element={
                  <RequireAuth role="EMPLOYEE">
                    <EmployeeDashboard />
                  </RequireAuth>
                }
              />
              <Route path="/employee/verify-email" element={<EmployeeVerifyEmail />} />
              <Route path="/employee/confirm-email" element={<EmployeeConfirmEmail />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/refund-policy" element={<RefundPolicy />} />
              <Route path="/terms-and-conditions" element={<TermsAndConditions />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </GlobalLoadingProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
