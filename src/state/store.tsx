import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { ToastMsg } from "../lib/types";
import { uid } from "../lib/utils";
import { api } from "../server/api";
import { onChange } from "../server/db";

export type SafeUser = ReturnType<typeof api.me>;

interface AppState {
  ready: boolean;
  user: SafeUser;
  setUser: (u: SafeUser) => void;
  refreshUser: () => void;
  balance: number | null;
  unread: number;
  tick: number;
  bump: () => void;
  toasts: ToastMsg[];
  toast: (kind: ToastMsg["kind"], title: string, body?: string) => void;
  dismissToast: (id: string) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SafeUser>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [tick, setTick] = useState(0);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    api.boot().then(() => setReady(true)).catch((e) => { console.error("[boot]", e); setReady(true); });
    return onChange(bump);
  }, [bump]);

  // Live balances / unread / session refresh on any db change.
  useEffect(() => {
    if (!user) { setBalance(null); setUnread(0); return; }
    try {
      setBalance(api.creditSummary().balance);
      setUnread(api.notifications().filter((n) => !n.read).length);
      const fresh = api.me();
      if (fresh && JSON.stringify(fresh) !== JSON.stringify(user)) setUser(fresh);
    } catch { /* boot pending */ }
  }, [tick, user]);

  const toast = useCallback((kind: ToastMsg["kind"], title: string, body?: string) => {
    const id = uid();
    setToasts((ts) => [...ts.slice(-3), { id, kind, title, body }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), kind === "error" ? 7000 : 4500);
  }, []);
  const dismissToast = useCallback((id: string) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const refreshUser = useCallback(() => { try { setUser(api.me()); } catch { /* noop */ } }, []);

  const value = useMemo(
    () => ({ ready, user, setUser, refreshUser, balance, unread, tick, bump, toasts, toast, dismissToast }),
    [ready, user, balance, unread, tick, toasts, bump, toast, dismissToast, refreshUser]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside provider");
  return v;
}

/** Re-render subscribers on any generation event (job worker → UI). */
export function useLiveGenerations() {
  const { bump } = useApp();
  useEffect(() => api.subscribeGenerations(() => bump()), [bump]);
}
