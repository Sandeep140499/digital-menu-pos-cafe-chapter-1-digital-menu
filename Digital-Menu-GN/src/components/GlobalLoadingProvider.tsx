import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import cafeLogo from '@/assets/logo.png';

type GlobalLoadingState = {
  isGlobalLoading: boolean;
  message?: string;
};

type GlobalLoadingContextValue = GlobalLoadingState & {
  startGlobalLoading: (message?: string) => void;
  stopGlobalLoading: () => void;
};

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const [{ isGlobalLoading, message }, setState] = useState<GlobalLoadingState>({
    isGlobalLoading: false,
    message: undefined,
  });
  const startedAtRef = useRef<number | null>(null);
  const [canDismiss, setCanDismiss] = useState(false);

  const startGlobalLoading = useCallback((msg?: string) => {
    startedAtRef.current = Date.now();
    setCanDismiss(false);
    setState({ isGlobalLoading: true, message: msg });
  }, []);

  const stopGlobalLoading = useCallback(() => {
    setState(prev =>
      prev.isGlobalLoading ? { isGlobalLoading: false, message: undefined } : prev
    );
  }, []);

  // Fail-safe: never trap the UI behind a full-screen overlay forever.
  // If something hangs (network/proxy/DB), allow dismiss and auto-release after a max time.
  useEffect(() => {
    if (!isGlobalLoading) return;
    const dismissTimer = window.setTimeout(() => setCanDismiss(true), 6000);
    const hardTimeout = window.setTimeout(() => {
      stopGlobalLoading();
    }, 30000);
    return () => {
      window.clearTimeout(dismissTimer);
      window.clearTimeout(hardTimeout);
    };
  }, [isGlobalLoading, stopGlobalLoading]);

  return (
    <GlobalLoadingContext.Provider
      value={{ isGlobalLoading, message, startGlobalLoading, stopGlobalLoading }}
    >
      {children}
      {isGlobalLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="flex max-w-[90vw] min-w-[260px] flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white/95 px-6 py-6 shadow-2xl">
            <img
              src={cafeLogo}
              alt="Cafe Chapter 1"
              className="h-16 w-16 rounded-xl bg-white/40 object-contain p-1.5 shadow"
            />
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
              <div className="flex flex-col">
                <p className="text-sm font-semibold text-slate-800">
                  {message || 'Loading, please wait…'}
                </p>
                <p className="text-xs text-slate-500">
                  {canDismiss
                    ? 'If this takes too long, continue and try again.'
                    : 'Do not refresh or close this tab.'}
                </p>
              </div>
            </div>
            {canDismiss && (
              <button
                type="button"
                onClick={stopGlobalLoading}
                className="mt-1 inline-flex min-h-[40px] items-center justify-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                Continue
              </button>
            )}
          </div>
        </div>
      )}
    </GlobalLoadingContext.Provider>
  );
}

export function useGlobalLoading() {
  const ctx = useContext(GlobalLoadingContext);
  if (!ctx) {
    throw new Error('useGlobalLoading must be used within GlobalLoadingProvider');
  }
  return ctx;
}
