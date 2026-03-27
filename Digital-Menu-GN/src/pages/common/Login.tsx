import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { LoaderButton } from '@/components/shared';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import cafeLogo from '@/assets/logo.png';
import { useGlobalLoading } from '@/components/GlobalLoadingProvider';
import { useAuth } from '@/hooks/useAuth';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { startGlobalLoading, stopGlobalLoading } = useGlobalLoading();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Show global loader so navigation + first dashboard load never shows a white gap
    startGlobalLoading('Signing you in…');
    try {
      const role = await login({ email, password });

      toast({
        title: 'Login successful',
        description: 'Welcome back',
        className: 'border-emerald-500 bg-emerald-50 text-emerald-900 font-medium',
      });

      // Keep global loader active while dashboard bootstraps;
      // the respective dashboard will stop it after first data load.
      navigate(role === 'ADMIN' ? '/admin' : '/employee');
    } catch (error: any) {
      stopGlobalLoading();
      toast({
        title: 'Login failed',
        description: error.message ?? 'Unable to login. Check credentials.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] min-h-screen items-center justify-center bg-gradient-to-br from-olive-50 via-olive-100 to-emerald-100 px-4 py-6 sm:py-8">
      <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white/95 p-5 shadow-xl sm:p-6">
        <div className="mb-3 flex justify-center sm:mb-4">
          <img src={cafeLogo} alt="Cafe Chapter 1" className="h-16 w-auto object-contain sm:h-20" />
        </div>
        <h1 className="mb-1 text-center text-lg leading-tight font-bold text-emerald-900 sm:mb-2 sm:text-2xl">
          Cafe Chapter 1 Restro Private Limited
        </h1>

        <form className="mt-4 space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
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
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="min-h-[44px] pr-10 sm:min-h-0"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                className="text-muted-foreground hover:text-foreground hover:bg-muted/50 absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1.5 focus:ring-2 focus:ring-emerald-500 focus:ring-offset-0 focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <LoaderButton
            type="submit"
            className="min-h-[44px] w-full bg-emerald-700 hover:bg-emerald-800"
            loading={loading}
            loadingLabel="Signing in..."
          >
            Sign in
          </LoaderButton>

          <div className="mt-3 flex flex-col gap-2 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <p className="text-muted-foreground order-2 text-[11px] sm:order-1">
              Customer orders do not require login. This panel is for staff only.
            </p>
            <Link
              to="/reset-password"
              className="order-1 shrink-0 text-[11px] text-emerald-700 hover:underline sm:order-2"
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
