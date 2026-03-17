import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";
import cafeLogo from "@/assets/logo.png";

type GlobalLoadingState = {
  isGlobalLoading: boolean;
  message?: string;
};

type GlobalLoadingContextValue = GlobalLoadingState & {
  startGlobalLoading: (message?: string) => void;
  stopGlobalLoading: () => void;
};

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(
  null,
);

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const [{ isGlobalLoading, message }, setState] =
    useState<GlobalLoadingState>({
      isGlobalLoading: false,
      message: undefined,
    });

  const startGlobalLoading = useCallback((msg?: string) => {
    setState({ isGlobalLoading: true, message: msg });
  }, []);

  const stopGlobalLoading = useCallback(() => {
    setState((prev) =>
      prev.isGlobalLoading ? { isGlobalLoading: false, message: undefined } : prev,
    );
  }, []);

  return (
    <GlobalLoadingContext.Provider
      value={{ isGlobalLoading, message, startGlobalLoading, stopGlobalLoading }}
    >
      {children}
      {isGlobalLoading && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-white/95 px-6 py-6 shadow-2xl border border-slate-200 min-w-[260px] max-w-[90vw]">
            <img
              src={cafeLogo}
              alt="Cafe Chapter 1"
              className="h-16 w-16 object-contain rounded-xl bg-white/40 p-1.5 shadow"
            />
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
              <div className="flex flex-col">
                <p className="text-sm font-semibold text-slate-800">
                  {message || "Loading, please wait…"}
                </p>
                <p className="text-xs text-slate-500">
                  Do not refresh or close this tab.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </GlobalLoadingContext.Provider>
  );
}

export function useGlobalLoading() {
  const ctx = useContext(GlobalLoadingContext);
  if (!ctx) {
    throw new Error("useGlobalLoading must be used within GlobalLoadingProvider");
  }
  return ctx;
}

