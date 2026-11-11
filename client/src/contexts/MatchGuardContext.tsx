import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useLocation } from "wouter";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MatchGuardContextValue {
  setMatchActive: (active: boolean) => void;
  confirmExit: (onConfirm: () => void) => void;
}

const MatchGuardContext = createContext<MatchGuardContextValue>({
  setMatchActive: () => {},
  confirmExit: (cb) => cb(),
});

export function useMatchGuard() {
  return useContext(MatchGuardContext);
}

// Routes that are dedicated active match pages by default
function isDedicatedMatchRoute(pathname: string): boolean {
  return (
    pathname === "/carriere/maratona" ||
    pathname === "/carriere/sfida" ||
    pathname === "/aarons-zurkowski/gioco" ||
    pathname === "/footster/game" ||
    pathname.startsWith("/sfida/")
  );
}

export function MatchGuardProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [location] = useLocation();
  const [explicitActive, setExplicitActive] = useState<boolean | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const bypassRef = useRef(false);

  // Reset explicit override whenever pathname changes
  useEffect(() => {
    setExplicitActive(null);
  }, [location]);

  const isActive =
    explicitActive !== null
      ? explicitActive
      : isDedicatedMatchRoute(window.location.pathname);

  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const setMatchActive = useCallback((active: boolean) => {
    setExplicitActive(active);
    isActiveRef.current = active;
  }, []);

  const confirmExit = useCallback((onConfirm: () => void) => {
    if (!isActiveRef.current) {
      onConfirm();
      return;
    }
    setPendingAction(() => onConfirm);
  }, []);

  // Intercept history.pushState, history.replaceState, popstate, and beforeunload
  useEffect(() => {
    const origPushState = window.history.pushState;
    const origReplaceState = window.history.replaceState;

    const extractPathname = (url?: string | URL | null): string => {
      if (!url) return window.location.pathname;
      try {
        const parsed = new URL(url.toString(), window.location.origin);
        return parsed.pathname;
      } catch {
        return window.location.pathname;
      }
    };

    window.history.pushState = function (
      data: any,
      unused: string,
      url?: string | URL | null
    ) {
      const targetPathname = extractPathname(url);
      const currentPathname = window.location.pathname;

      if (
        !bypassRef.current &&
        isActiveRef.current &&
        targetPathname !== currentPathname
      ) {
        setPendingAction(() => () => {
          bypassRef.current = true;
          isActiveRef.current = false;
          setExplicitActive(false);
          origPushState.call(window.history, data, unused, url);
          window.dispatchEvent(new PopStateEvent("popstate"));
          setTimeout(() => {
            bypassRef.current = false;
          }, 50);
        });
        return;
      }

      return origPushState.call(window.history, data, unused, url);
    };

    window.history.replaceState = function (
      data: any,
      unused: string,
      url?: string | URL | null
    ) {
      const targetPathname = extractPathname(url);
      const currentPathname = window.location.pathname;

      if (
        !bypassRef.current &&
        isActiveRef.current &&
        targetPathname !== currentPathname
      ) {
        setPendingAction(() => () => {
          bypassRef.current = true;
          isActiveRef.current = false;
          setExplicitActive(false);
          origReplaceState.call(window.history, data, unused, url);
          window.dispatchEvent(new PopStateEvent("popstate"));
          setTimeout(() => {
            bypassRef.current = false;
          }, 50);
        });
        return;
      }

      return origReplaceState.call(window.history, data, unused, url);
    };

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isActiveRef.current && !bypassRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.history.pushState = origPushState;
      window.history.replaceState = origReplaceState;
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const handleCancelExit = () => {
    setPendingAction(null);
  };

  const handleConfirmExit = () => {
    const action = pendingAction;
    setPendingAction(null);
    if (action) {
      bypassRef.current = true;
      isActiveRef.current = false;
      setExplicitActive(false);
      action();
      setTimeout(() => {
        bypassRef.current = false;
      }, 50);
    }
  };

  return (
    <MatchGuardContext.Provider value={{ setMatchActive, confirmExit }}>
      {children}

      {/* Modal di Conferma Uscita dal Match */}
      {pendingAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] max-w-md w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-400 border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-6 h-6 text-black" />
              </div>
              <div>
                <h2 className="font-display font-black uppercase text-xl tracking-tight text-black">
                  Uscire dal match in corso?
                </h2>
                <p className="text-xs font-bold uppercase text-muted-foreground">
                  Partita ancora attiva
                </p>
              </div>
            </div>

            <p className="text-sm font-medium text-gray-800 leading-relaxed">
              Sei sicuro di voler abbandonare il match in corso? Uscendo ora, i
              progressi della partita attuale andranno persi.
            </p>

            <div className="flex gap-3 pt-1">
              <Button
                onClick={handleCancelExit}
                className="flex-1 bg-white hover:bg-gray-100 text-black font-bold uppercase border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              >
                Rimani in partita
              </Button>
              <Button
                onClick={handleConfirmExit}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold uppercase border-2 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
              >
                Sì, esci
              </Button>
            </div>
          </div>
        </div>
      )}
    </MatchGuardContext.Provider>
  );
}
