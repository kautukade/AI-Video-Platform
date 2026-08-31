import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ToastMsg } from "../lib/types";
import { api, SafeUser } from "../server/api";
import { onChange } from "../server/db";
import { uid } from "../lib/utils";

interface AppState {
  ready: boolean;
  user: SafeUser;
  setUser: (u: SafeUser) => void;
  refreshUser: () => void;
  balance: number | null;
  unread: number;
  toasts: ToastMsg[];
  toast: (kind: ToastMsg["kind"], title: string, body?: string) => void;
  dismissToast: (id: string) => void;
  bump: () => void;
  tick: number;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<SafeUser>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [unread, setUnread] = useState(0);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const [tick, setTick] = useState(0);

  const bump = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    api.boot().then(() => { setReady(true); }).catch((e) => { console.error("[boot]", e); setReady(true); });
    const un = onChange(() => { setTick((t) => t + 1); });
    return un;
  }, []);

  const refreshUser = useCallback(() => {
    try { setUser(api.me()); } catch { setUser(null); }
  }, []);

  // auto local login
  useEffect(() => {
    if (ready && !user) {
      api.autoLocalLogin().then(({ user: u }) => setUser(u)).catch(() => { /* retry next tick */ });
    }
  }, [ready, user]);

  // balance + unread
  useEffect(() => {
    if (!user) { setBalance(null); setUnread(0); return; }
    try { setBalance(api.creditSummary().balance); } catch { setBalance(null); }
    try { setUnread(api.unreadCount()); } catch { setUnread(0); }
  }, [user, tick]);

  const dismissToast = useCallback((id: string) => setToasts((ts) => ts.filter((t) => t.id !== id)), []);
  const toast = useCallback((kind: ToastMsg["kind"], title: string, body?: string) => {
    const id = uid();
    setToasts((ts) => [...ts.slice(-3), { id, kind, title, body }]);
    setTimeout(() => dismissToast(id), kind === "error" ? 6500 : 4200);
  }, [dismissToast]);

  const value = useMemo<AppState>(() => ({
    ready, user, setUser, refreshUser, balance, unread, toasts, toast, dismissToast, bump, tick,
  }), [ready, user, balance, unread, toasts, toast, dismissToast, bump, tick, refreshUser]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}
