import React, { Component, useEffect } from "react";
import { HashRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppProvider, useApp } from "./state/store";
import { api } from "./server/api";
import { AppShell } from "./components/shell";
import { Toaster } from "./components/ui";
import { Landing, Features, About, Onboarding } from "./pages/public";
import Dashboard from "./pages/dashboard";
import CreateImage from "./pages/create-image";
import CreateVideo from "./pages/create-video";
import CreatePoster from "./pages/create-poster";
import CreateCharacter from "./pages/create-character";
import { LibraryPage, HistoryPage, CharactersPage } from "./pages/library-history";
import { ProvidersPage, ModelsPage } from "./pages/providers";
import { CreditsPage, SettingsPage } from "./pages/manage";
import AdminPage from "./pages/admin";
import EnginePage from "./pages/engine";
import ImageEditorPage from "./pages/image-editor";

class ErrorBoundary extends Component<{ children: React.ReactNode }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  render() {
    if (this.state.err)
      return (
        <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6">
          <div className="panel max-w-md p-8 text-center">
            <h1 className="font-display text-[20px] font-bold text-ink-50">Something went wrong</h1>
            <p className="mt-2 text-[13px] text-ink-400">{String(this.state.err?.message ?? this.state.err)}</p>
            <button className="mt-5 rounded-[10px] bg-solar-400 px-5 py-2.5 text-[13px] font-bold text-ink-950" onClick={() => { this.setState({ err: null }); location.reload(); }}>
              Reload app
            </button>
          </div>
        </div>
      );
    return this.props.children;
  }
}

function Splash() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-950 bg-grid">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl border border-solar-500/40 bg-ink-850">
        <svg viewBox="0 0 32 32" className="h-8 w-8"><path d="M9 23V9l7 8 7-8v14" stroke="#FFC14D" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </span>
      <div className="indeterminate w-44" />
      <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-ink-500">booting studio…</p>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { ready, user, setUser } = useApp();
  const loc = useLocation();
  useEffect(() => {
    if (ready && !user) {
      api.autoLocalLogin().then(({ user: u }) => setUser(u as any)).catch(() => { /* retried next tick */ });
    }
  }, [ready, user, setUser]);
  if (!ready) return <Splash />;
  if (!user) return <Splash />;
  if (!user.onboarded && loc.pathname !== "/onboarding") return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  if (!user) return null;
  if (user.role !== "admin")
    return (
      <div className="panel mx-auto mt-16 max-w-md p-8 text-center">
        <h1 className="font-display text-[19px] font-bold text-ink-50">Admin access required</h1>
        <p className="mt-2 text-[13px] text-ink-400">Ye section sirf admin accounts ke liye hai.</p>
        <Link to="/dashboard" className="mt-4 inline-block rounded-[10px] bg-solar-400 px-5 py-2.5 text-[13px] font-bold text-ink-950">Back to dashboard</Link>
      </div>
    );
  return <>{children}</>;
}

function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="font-mono text-[60px] font-bold text-ink-700">404</div>
      <p className="text-[14px] text-ink-400">Ye page nahi mila.</p>
      <Link to="/dashboard" className="mt-4 rounded-[10px] bg-solar-400 px-5 py-2.5 text-[13px] font-bold text-ink-950">Dashboard</Link>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/features" element={<Features />} />
            <Route path="/about" element={<About />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route element={<RequireAuth><AppShell /></RequireAuth>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/create/image" element={<CreateImage />} />
              <Route path="/create/video" element={<CreateVideo />} />
              <Route path="/create/poster" element={<CreatePoster />} />
              <Route path="/create/character" element={<CreateCharacter />} />
              <Route path="/editor" element={<ImageEditorPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/characters" element={<CharactersPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/engine" element={<EnginePage />} />
              <Route path="/providers" element={<ProvidersPage />} />
              <Route path="/models" element={<ModelsPage />} />
              <Route path="/credits" element={<CreditsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
          <Toaster />
        </HashRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}
