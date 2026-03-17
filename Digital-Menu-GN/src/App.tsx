import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingWithSplash from "./components/LandingWithSplash";
import Login from "./pages/common/Login";
import NotFound from "./pages/common/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import EmployeeDashboard from "./pages/employee/EmployeeDashboard";
import EmployeeVerifyEmail from "./pages/employee/EmployeeVerifyEmail";
import EmployeeConfirmEmail from "./pages/employee/EmployeeConfirmEmail";
import ResetPassword from "./pages/common/ResetPassword";
import { GlobalLoadingProvider } from "./components/GlobalLoadingProvider";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <GlobalLoadingProvider>
        <Toaster />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingWithSplash />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/employee" element={<EmployeeDashboard />} />
            <Route
              path="/employee/verify-email"
              element={<EmployeeVerifyEmail />}
            />
            <Route
              path="/employee/confirm-email"
              element={<EmployeeConfirmEmail />}
            />
            <Route path="/reset-password" element={<ResetPassword />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </GlobalLoadingProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
