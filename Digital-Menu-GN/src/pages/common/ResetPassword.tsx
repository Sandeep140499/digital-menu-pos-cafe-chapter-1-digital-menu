import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { API_BASE_URL } from '@/constants';

const useQuery = () => {
  const { search } = useLocation();
  return new URLSearchParams(search);
};

const ResetPassword = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const t = query.get('token');
    if (t) setToken(t);
  }, [query]);

  const handleRequestLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      const msg = (data as { message?: string }).message;
      if (res.ok) {
        toast({
          title: 'If the email exists, a reset link has been sent.',
          description: msg,
        });
      } else {
        toast({
          title: 'Could not send reset link',
          description:
            msg || 'Email may not be configured on the server. Contact the administrator.',
          variant: 'destructive',
        });
      }
    } catch {
      toast({
        title: 'Error sending reset link',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || 'Unable to reset password.');
      }
      toast({
        title: 'Password updated',
        description: 'You can now log in with your new password.',
      });
      navigate('/login');
    } catch (err: any) {
      toast({
        title: 'Reset failed',
        description: err.message ?? 'Unable to reset password.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const hasToken = Boolean(token);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-gradient-to-br from-olive-50 via-olive-100 to-emerald-100 px-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-emerald-100 bg-white/95 p-6 shadow-xl">
        <h1 className="text-center text-xl font-bold text-emerald-900 sm:text-2xl">
          {hasToken ? 'Set a new password' : 'Forgot your password?'}
        </h1>

        {hasToken ? (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">New password</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-emerald-700 hover:bg-emerald-800"
              disabled={submitting}
            >
              {submitting ? 'Updating...' : 'Update password'}
            </Button>
          </form>
        ) : (
          <form onSubmit={handleRequestLink} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Registered email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-emerald-700 hover:bg-emerald-800"
              disabled={submitting}
            >
              {submitting ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
