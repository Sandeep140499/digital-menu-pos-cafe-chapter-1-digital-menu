import { useEffect, useRef, useState } from 'react';
import { Loader2, WifiOff, Wifi } from 'lucide-react';
import { toast, useToast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';

export default function NetworkStatusToasts() {
  const { dismiss } = useToast();
  const offlineToastIdRef = useRef<string | null>(null);
  const lastOnlineToastAtRef = useRef<number>(0);
  const wasOfflineRef = useRef<boolean>(false);
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  const showOfflineToast = () => {
    if (offlineToastIdRef.current) return;
    wasOfflineRef.current = true;
    const t = toast({
      duration: 0,
      title: (
        <div className="flex items-center gap-2">
          <WifiOff className="h-4 w-4 text-red-600" />
          <span>🚫 No Internet Connection</span>
        </div>
      ),
      description: (
        <div className="space-y-1">
          <div>Please check your network</div>
          <div className="flex items-center gap-2 text-[11px] opacity-90">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>Connection Lost. Reconnecting…</span>
          </div>
        </div>
      ),
      className: 'border-red-500/60 bg-red-50 text-red-900 [&_[toast-close]]:text-red-900/60',
      action: (
        <ToastAction
          altText="Retry connection"
          onClick={() =>
            setIsBrowserOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
          }
        >
          Retry
        </ToastAction>
      ),
    });
    offlineToastIdRef.current = t.id;
  };

  const dismissOfflineToast = () => {
    if (!offlineToastIdRef.current) return;
    const id = offlineToastIdRef.current;
    offlineToastIdRef.current = null;
    dismiss(id);
  };

  const showBackOnlineToast = () => {
    // Only show when we actually recovered from an offline state.
    if (!wasOfflineRef.current) return;
    wasOfflineRef.current = false;
    const now = Date.now();
    if (now - lastOnlineToastAtRef.current < 2500) return;
    lastOnlineToastAtRef.current = now;
    toast({
      duration: 2500,
      title: (
        <div className="flex items-center gap-2">
          <Wifi className="h-4 w-4 text-emerald-700" />
          <span>✅ Back Online</span>
        </div>
      ),
      description: "You're connected again",
      className: 'border-emerald-500 bg-emerald-50 text-emerald-900 font-medium',
    });
  };

  useEffect(() => {
    const onOffline = () => setIsBrowserOnline(false);
    const onOnline = () => setIsBrowserOnline(true);
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  useEffect(() => {
    if (isBrowserOnline) {
      dismissOfflineToast();
      showBackOnlineToast();
    } else {
      showOfflineToast();
    }
  }, [isBrowserOnline]);

  return null;
}
