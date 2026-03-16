import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { API_BASE_URL } from "@/constants";
import cafeLogo from "@/assets/logo.png";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const apiBase = API_BASE_URL;
      const res = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg =
          res.status === 403
            ? data.message || "Please verify your email before logging in."
            : data.message || "Login failed";
        throw new Error(msg);
      }

      const data = await res.json();
      // Use sessionStorage so admin + employee can be logged in different tabs
      window.sessionStorage.setItem("dm_auth_token", data.token);
      window.sessionStorage.setItem("dm_auth_role", data.role);

      toast({
        title: "Login successful",
        description: `Logged in as ${data.role}`,
        className:
          "border-emerald-500 bg-emerald-50 text-emerald-900 font-medium",
      });

      if (data.role === "ADMIN") {
        navigate("/admin");
      } else {
        navigate("/employee");
      }
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message ?? "Unable to login. Check credentials.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen min-h-[100dvh] flex items-center justify-center bg-gradient-to-br from-olive-50 via-olive-100 to-emerald-100 px-4 py-6 sm:py-8">
      <div className="w-full max-w-md rounded-2xl bg-white/95 p-5 sm:p-6 shadow-xl border border-emerald-100">
        <div className="flex justify-center mb-3 sm:mb-4">
          <img
            src={cafeLogo}
            alt="Cafe Chapter 1"
            className="h-16 w-auto object-contain sm:h-20"
          />
        </div>
        <h1 className="text-lg sm:text-2xl font-bold text-emerald-900 mb-1 sm:mb-2 text-center leading-tight">
          Cafe Chapter 1 Restro Private Limited
        </h1>

        <form className="space-y-4 mt-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="min-h-[44px] sm:min-h-0"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="min-h-[44px] sm:min-h-0 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((p) => !p)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0"
                aria-label={showPassword ? "Hide password" : "Show password"}
                tabIndex={-1}
              >
                {showPassword ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full min-h-[44px] bg-emerald-700 hover:bg-emerald-800"
            disabled={loading}
          >
            {loading ? "Signing in..." : "Sign in"}
          </Button>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mt-3 text-center sm:text-left">
            <p className="text-[11px] text-muted-foreground order-2 sm:order-1">
              Customer orders do not require login. This panel is for staff
              only.
            </p>
            <Link
              to="/reset-password"
              className="text-[11px] text-emerald-700 hover:underline order-1 sm:order-2 shrink-0"
            >
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
