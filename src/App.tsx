import { Component, useEffect } from "react";
import { HashRouter, Route, Routes, Navigate } from "react-router-dom";
import { AppProvider, useApp } from "./state/store";
import { Toaster } from "./components/ui";
import { AppShell } from "./components/shell";
import { api } from "./server/api";

import { Landing, Features, About, Onboarding } from "./pages/public";
import Dashboard from "./pages/dashboard";
import CreateImage from "./pages/create-image";
import CreateVideo from "./pages/create-video";
import CreatePoster from "./pages/create-poster";
import CreateCharacter from "./pages/create-character";
import ImageEditorPage from "./pages/image-editor";
import { LibraryPage, HistoryPage, CharactersPage } from "./pages/library-history";
import { ProvidersPage, ModelsPage } from "./pages/providers";
import EnginePage from "./pages/engine";
import { CreditsPage, SettingsPage } from "./pages/manage";
import AdminPage from "./pages/admin";

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error)
      return (
        <div className="flex min-h-screen items-center justify-center bg-ink-950 p-6">
          <div className="panel max-w-md p-8 text-center">
            <h1 className="font-display text-[20px] font-bold text-ink-50">Something went wrong</h1>
            <p className="mt-2 text-[13px] text-ink-400">{this.state.error.message}</p>
            <button onClick={() => { this.setState({ error: null }); window.location.hash = "#/"; }}
              className="mt-5 rounded-[10px] bg-solar-400 px-5 py-2.5 text-[13px] font-bold text-ink-950">Reload studio</button>
          </div>
        </div>
      );
    return this.props.children;
  }
}

function Splash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-solar-500/40 bg-ink-850">
          <svg viewBox="0 0 32 32" className="h-7 w-7"><path d="M9 23V9l7 8 7-8v14" stroke="#FFC14D" strokeWidth="2.6" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </div>
        <div className="indeterminate mx-auto mt-5 w-40" />
        <p className="mt-3 font-mono text-[11px] uppercase tracking-[0.2em] text-ink-500">starting studio…</p>
      </div>
    </div>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, ready, setUser } = useApp();
  useEffect(() => {
    if (ready && !user) {
      api.autoLocalLogin().then(({ user: u }) => setUser(u)).catch(() => { /* retried next tick */ });
    }
  }, [ready, user, setUser]);
  if (!ready) return <Splash />;
  if (!user) return <Splash />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { user } = useApp();
  if (user?.role !== "admin") return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function Router() {
  const { ready } = useApp();
  return (
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
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/characters" element={<CharactersPage />} />
        <Route path="/providers" element={<ProvidersPage />} />
        <Route path="/models" element={<ModelsPage />} />
        <Route path="/engine" element={<EnginePage />} />
        <Route path="/credits" element={<CreditsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <HashRouter>
          <Router />
          <Toaster />
        </HashRouter>
      </AppProvider>
    </ErrorBoundary>
  );
}
