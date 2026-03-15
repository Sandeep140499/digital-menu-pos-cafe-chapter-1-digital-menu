import { Toaster } from "@/components/ui/toaster";
import { Toaster as HotToaster } from "react-hot-toast";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <HotToaster
        position="top-center"
        containerStyle={{
          marginTop: "max(env(safe-area-inset-top, 0px), 12px)",
          marginBottom: "env(safe-area-inset-bottom, 0px)",
          zIndex: 99999,
          width: "min(calc(100vw - 24px), 380px)",
          maxWidth: "100%",
        }}
        toastOptions={{
          duration: 4000,
          style: {
            fontSize: "14px",
            padding: "12px 16px",
            borderRadius: "12px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            maxWidth: "min(calc(100vw - 24px), 380px)",
          },
          className: "toast-mobile",
          success: { iconTheme: { primary: "#059669" } },
          error: { iconTheme: { primary: "#dc2626" } },
        }}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingWithSplash />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/employee" element={<EmployeeDashboard />} />
          <Route path="/employee/verify-email" element={<EmployeeVerifyEmail />} />
          <Route path="/employee/confirm-email" element={<EmployeeConfirmEmail />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
