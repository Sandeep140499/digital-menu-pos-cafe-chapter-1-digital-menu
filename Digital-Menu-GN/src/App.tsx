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
import ResetPassword from "./pages/common/ResetPassword";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <HotToaster
        position="top-center"
        containerStyle={{
          marginTop: "max(env(safe-area-inset-top, 0px), 52px)",
          zIndex: 99999,
          width: "min(100vw - 24px, 360px)",
        }}
        toastOptions={{
          duration: 5000,
          style: { fontSize: "14px", padding: "14px 16px" },
          className: "toast-mobile-visible",
        }}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingWithSplash />} />
          <Route path="/login" element={<Login />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/employee" element={<EmployeeDashboard />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
