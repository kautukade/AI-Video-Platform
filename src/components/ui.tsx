import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, CheckCircle2, ChevronDown, Info, Loader2, X, XCircle } from "lucide-react";
import { JobStatus, StageEvent } from "../lib/types";
import { cn } from "../lib/utils";
import { useApp } from "../state/store";

const btnVariants: Record<string, string> = {
  primary: "bg-solar-400 text-ink-950 hover:bg-solar-300 font-bold shadow-[0_2px_16px_-4px_rgba(255,193,77,0.45)]",
  outline: "border border-ink-600 text-ink-100 hover:border-ink-400 hover:bg-ink-750",
  ghost: "text-ink-200 hover:bg-ink-750 hover:text-ink-50",
  danger: "bg-coral-500/15 text-coral-300 border border-coral-500/40 hover:bg-coral-500/25",
  jade: "bg-jade-500/15 text-jade-300 border border-jade-500/40 hover:bg-jade-500/25",
  subtle: "bg-ink-750 text-ink-100 hover:bg-ink-700 border border-ink-700",
};

export function Button({ variant = "primary", size = "md", loading, className, children, icon, disabled, ...rest }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof btnVariants; size?: "sm" | "md" | "lg"; loading?: boolean; icon?: React.ReactNode }) {
  return (
    <button
      className={cn(
        "focus-ring inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition-all duration-150 select-none",
        size === "sm" ? "h-8 px-3 text-[12.5px]" : size === "lg" ? "h-12 px-6 text-[15px]" : "h-10 px-4 text-[13.5px]",
        btnVariants[variant], (disabled || loading) && "opacity-55 pointer-events-none", className,
      )}
      disabled={disabled || loading} {...rest}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

export const statusStyles: Record<JobStatus, { cls: string; dot: string; pulse: boolean }> = {
  queued: { cls: "bg-ink-700/60 text-ink-200 border-ink-600", dot: "bg-ink-300", pulse: true },
  preparing: { cls: "bg-solar-400/10 text-solar-300 border-solar-500/35", dot: "bg-solar-400", pulse: true },
  generating: { cls: "bg-iris-400/10 text-iris-300 border-iris-500/35", dot: "bg-iris-400", pulse: true },
  processing: { cls: "bg-iris-400/10 text-iris-300 border-iris-500/35", dot: "bg-iris-400", pulse: true },
  completed: { cls: "bg-jade-500/10 text-jade-300 border-jade-500/35", dot: "bg-jade-400", pulse: false },
  failed: { cls: "bg-coral-500/10 text-coral-300 border-coral-500/35", dot: "bg-coral-400", pulse: false },
  cancelled: { cls: "bg-ink-700/40 text-ink-300 border-ink-600", dot: "bg-ink-400", pulse: false },
};

export function StatusBadge({ status, className }: { status: JobStatus; className?: string }) {
  const s = statusStyles[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide", s.cls, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} style={s.pulse ? { animation: "pulse-dot 1.2s ease-in-out infinite" } : undefined} />
      {status}
    </span>
  );
}

export function Tag({ children, tone = "ink", className }: { children: React.ReactNode; tone?: "ink" | "solar" | "jade" | "coral" | "iris"; className?: string }) {
  const tones = {
    ink: "bg-ink-700/50 text-ink-200 border-ink-600",
    solar: "bg-solar-400/10 text-solar-300 border-solar-500/30",
    jade: "bg-jade-500/10 text-jade-300 border-jade-500/30",
    coral: "bg-coral-500/10 text-coral-300 border-coral-500/30",
    iris: "bg-iris-400/10 text-iris-300 border-iris-500/30",
  };
  return <span className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold", tones[tone], className)}>{children}</span>;
}

export const inputCls =
  "w-full rounded-[10px] border border-ink-600 bg-ink-800/80 px-3.5 py-2.5 text-[13.5px] text-ink-100 placeholder:text-ink-400 transition-colors focus:border-solar-500/70 focus:bg-ink-800 hover:border-ink-500";
export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) { return <input {...props} className={cn(inputCls, props.className)} />; }
export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) { return <textarea {...props} className={cn(inputCls, "resize-y min-h-[110px] leading-relaxed", props.className)} />; }
export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={cn("relative", className)}>
      <select {...rest} className={cn(inputCls, "appearance-none pr-9 cursor-pointer")}>{children}</select>
      <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-400" />
    </div>
  );
}
export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ink-300">{label}</span>
        {hint && <span className="text-[11px] text-ink-400">{hint}</span>}
      </div>
      {children}
      {error && <div className="mt-1 text-[12px] font-medium text-coral-300">{error}</div>}
    </label>
  );
}
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onChange(!checked)} className={cn("focus-ring group inline-flex items-center gap-2.5 disabled:opacity-50", label && "py-1")} aria-pressed={checked}>
      <span className={cn("relative h-[22px] w-[40px] rounded-full border transition-colors", checked ? "border-jade-500/60 bg-jade-500/30" : "border-ink-600 bg-ink-750")}>
        <span className={cn("absolute top-[2px] h-4 w-4 rounded-full transition-all", checked ? "left-[18px] bg-jade-400" : "left-[3px] bg-ink-400 group-hover:bg-ink-300")} />
      </span>
      {label && <span className="text-[13px] font-medium text-ink-200">{label}</span>}
    </button>
  );
}
export function Segmented<T extends string>({ options, value, onChange, size = "md" }: { options: { value: T; label: React.ReactNode; title?: string }[]; value: T; onChange: (v: T) => void; size?: "sm" | "md" }) {
  return (
    <div className="inline-flex max-w-full flex-wrap gap-1 rounded-[10px] border border-ink-700 bg-ink-800/70 p-1">
      {options.map((o) => (
        <button key={o.value} title={o.title} type="button" onClick={() => onChange(o.value)}
          className={cn("focus-ring rounded-lg font-semibold transition-all", size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3.5 py-1.5 text-[12.5px]",
            value === o.value ? "bg-solar-400 text-ink-950 shadow" : "text-ink-300 hover:bg-ink-750 hover:text-ink-100")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Modal({ open, onClose, title, children, footer, wide }: { open: boolean; onClose: () => void; title: React.ReactNode; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink-950/75 backdrop-blur-[3px] sm:items-center sm:p-6" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={cn("anim-scale-in panel flex max-h-[92vh] w-full flex-col overflow-hidden rounded-b-none sm:rounded-b-[14px]", wide ? "sm:max-w-3xl" : "sm:max-w-lg")}>
        <div className="flex items-center justify-between border-b border-ink-700 px-5 py-4">
          <h3 className="font-display text-[16px] font-bold text-ink-50">{title}</h3>
          <button onClick={onClose} className="focus-ring rounded-lg p-1.5 text-ink-400 hover:bg-ink-750 hover:text-ink-100"><X size={17} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-ink-700 px-5 py-3.5">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
export function ConfirmModal({ open, onClose, onConfirm, title, body, confirmLabel = "Delete", danger = true, children }: {
  open: boolean; onClose: () => void; onConfirm: () => void; title: string; body?: string; confirmLabel?: string; danger?: boolean; children?: React.ReactNode;
}) {
  return (
    <Modal open={open} onClose={onClose} title={title}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? "danger" : "primary"} onClick={() => { onConfirm(); onClose(); }}>{confirmLabel}</Button>
      </>}>
      {body && <p className="text-[13.5px] leading-relaxed text-ink-300">{body}</p>}
      {children}
    </Modal>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="panel-flat anim-fade-in flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-ink-600 bg-ink-800 text-ink-300">{icon}</div>
      <h3 className="font-display text-[16px] font-bold text-ink-100">{title}</h3>
      {body && <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-ink-400">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function StatCard({ label, value, sub, icon, tone = "ink" }: { label: string; value: React.ReactNode; sub?: string; icon: React.ReactNode; tone?: "ink" | "solar" | "jade" | "iris" | "coral" }) {
  const tones = {
    ink: "text-ink-200 bg-ink-750 border-ink-600",
    solar: "text-solar-300 bg-solar-400/10 border-solar-500/30",
    jade: "text-jade-300 bg-jade-500/10 border-jade-500/30",
    iris: "text-iris-300 bg-iris-400/10 border-iris-500/30",
    coral: "text-coral-300 bg-coral-500/10 border-coral-500/30",
  };
  return (
    <div className="panel-flat flex items-center gap-4 px-5 py-4 transition-colors hover:border-ink-600">
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border", tones[tone])}>{icon}</div>
      <div className="min-w-0">
        <div className="font-mono text-[21px] font-bold leading-tight text-ink-50">{value}</div>
        <div className="truncate text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-400">{label}</div>
        {sub && <div className="text-[11px] text-ink-500">{sub}</div>}
      </div>
    </div>
  );
}

export function StageProgress({ stages, status }: { stages: StageEvent[]; status: JobStatus }) {
  const active = ["queued", "preparing", "generating", "processing"].includes(status);
  const last = stages[stages.length - 1];
  const honest = last?.honest !== false;
  return (
    <div className="space-y-3">
      <div className="indeterminate" style={!active ? { opacity: 0.25 } : undefined} />
      <ol className="space-y-1.5">
        {stages.slice(-6).map((s, i, arr) => {
          const isLast = i === arr.length - 1;
          return (
            <li key={s.at + i} className={cn("flex items-center gap-2.5 text-[12.5px]", isLast && active ? "text-ink-100" : "text-ink-400")}>
              {isLast && active ? <Loader2 size={13} className="shrink-0 animate-spin text-solar-400" />
                : status === "failed" && isLast ? <XCircle size={13} className="shrink-0 text-coral-400" />
                : <CheckCircle2 size={13} className={cn("shrink-0", status === "completed" || !isLast ? "text-jade-400" : "text-ink-500")} />}
              <span className={cn(isLast && active && "font-semibold")}>{s.stage}</span>
            </li>
          );
        })}
      </ol>
      {active && !honest && <p className="text-[11.5px] italic text-ink-400">This provider doesn't expose progress — showing the real processing state, not an invented percentage.</p>}
    </div>
  );
}

export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-ink-700">
      {tabs.map((t) => (
        <button key={t.id} onClick={() => onChange(t.id)}
          className={cn("focus-ring -mb-px border-b-2 px-4 py-2.5 text-[13px] font-semibold transition-colors",
            value === t.id ? "border-solar-400 text-solar-300" : "border-transparent text-ink-400 hover:text-ink-200")}>
          {t.label}
          {t.count != null && <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 font-mono text-[10.5px]", value === t.id ? "bg-solar-400/15" : "bg-ink-750")}>{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export function InfoNote({ children, tone = "iris" }: { children: React.ReactNode; tone?: "iris" | "solar" | "coral" | "jade" }) {
  const tones = {
    iris: "border-iris-500/30 bg-iris-400/8 text-iris-300",
    solar: "border-solar-500/30 bg-solar-400/8 text-solar-300",
    coral: "border-coral-500/30 bg-coral-500/8 text-coral-300",
    jade: "border-jade-500/30 bg-jade-500/8 text-jade-300",
  };
  const Icon = tone === "coral" ? AlertTriangle : tone === "jade" ? CheckCircle2 : Info;
  return (
    <div className={cn("flex items-start gap-2.5 rounded-[10px] border px-3.5 py-2.5 text-[12.5px] leading-relaxed", tones[tone])}>
      <Icon size={15} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

export function Toaster() {
  const { toasts, dismissToast } = useApp();
  if (!toasts.length) return null;
  return createPortal(
    <div className="pointer-events-none fixed bottom-5 right-5 z-[120] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {toasts.map((t) => {
        const icons = {
          success: <CheckCircle2 size={16} className="text-jade-400" />, error: <XCircle size={16} className="text-coral-400" />,
          info: <Info size={16} className="text-iris-400" />, warning: <AlertTriangle size={16} className="text-solar-400" />,
        };
        return (
          <div key={t.id} className="anim-fade-up panel pointer-events-auto flex items-start gap-3 px-4 py-3 shadow-2xl shadow-black/50">
            <span className="mt-0.5 shrink-0">{icons[t.kind]}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-bold text-ink-50">{t.title}</div>
              {t.body && <div className="mt-0.5 text-[12px] leading-snug text-ink-300">{t.body}</div>}
            </div>
            <button onClick={() => dismissToast(t.id)} className="focus-ring shrink-0 rounded p-0.5 text-ink-500 hover:text-ink-200"><X size={14} /></button>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
