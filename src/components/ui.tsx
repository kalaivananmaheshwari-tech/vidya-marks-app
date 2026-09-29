"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { classNames } from "@/lib/client";

/* ------------------------------- Containers ------------------------------ */

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={classNames(
        "rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-18px_rgba(15,23,42,0.25)]",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  icon?: string;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        {icon ? (
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-500 text-xl shadow-lg shadow-brand-500/25">
            {icon}
          </span>
        ) : null}
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
          {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* --------------------------------- Inputs -------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "success";
  size?: "sm" | "md";
  loading?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const variants: Record<string, string> = {
    primary:
      "bg-gradient-to-r from-brand-600 to-violet-600 text-white shadow-md shadow-brand-600/20 hover:from-brand-500 hover:to-violet-500",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
    ghost: "text-slate-600 hover:bg-slate-100",
    danger: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
    success: "bg-emerald-600 text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500",
  };
  return (
    <button
      className={classNames(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-60",
        size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={classNames("block", className)}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint ? <span className="mt-1 block text-xs text-slate-400">{hint}</span> : null}
    </label>
  );
}

const controlClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={classNames(controlClass, className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <select className={classNames(controlClass, "appearance-none pr-8", className)} {...rest}>
      {children}
    </select>
  );
}

/* --------------------------------- Badges -------------------------------- */

export function Badge({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: "slate" | "brand" | "green" | "amber" | "rose" | "sky";
  className?: string;
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600 ring-slate-200",
    brand: "bg-brand-50 text-brand-700 ring-brand-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    rose: "bg-rose-50 text-rose-700 ring-rose-200",
    sky: "bg-sky-50 text-sky-700 ring-sky-200",
  };
  return (
    <span
      className={classNames(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function GradePill({ grade }: { grade: string }) {
  const tone =
    grade === "A+" || grade === "A"
      ? "green"
      : grade === "B+" || grade === "B"
        ? "sky"
        : grade === "C" || grade === "D"
          ? "amber"
          : "rose";
  return <Badge tone={tone as "green" | "sky" | "amber" | "rose"}>{grade}</Badge>;
}

/* ------------------------------ States / feedback ------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={classNames("skeleton rounded-lg", className)} />;
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className={classNames("h-9 flex-1", c === 0 && "max-w-[40%]")} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon = "📭",
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-14 text-center">
      <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white text-2xl shadow-sm">{icon}</div>
      <h3 className="mt-4 text-base font-semibold text-slate-800">{title}</h3>
      {description ? <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-6 text-center">
      <p className="text-sm font-medium text-rose-700">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/* --------------------------------- Modal --------------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  // Reset position whenever modal opens or closes
  useEffect(() => {
    if (open) {
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  const handleStartDrag = (clientX: number, clientY: number) => {
    isDraggingRef.current = true;
    setIsDragging(true);
    dragStartRef.current = {
      mouseX: clientX,
      mouseY: clientY,
      posX: position.x,
      posY: position.y,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = e.clientX - dragStartRef.current.mouseX;
      const dy = e.clientY - dragStartRef.current.mouseY;
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDraggingRef.current || !e.touches[0]) return;
      const dx = e.touches[0].clientX - dragStartRef.current.mouseX;
      const dy = e.touches[0].clientY - dragStartRef.current.mouseY;
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };

    const handleEndDrag = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleEndDrag);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleEndDrag);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleEndDrag);
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", handleEndDrag);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Movable window container */}
      <div
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          transition: isDragging ? "none" : "transform 0.05s ease-out",
        }}
        className={classNames(
          "relative z-10 flex flex-col max-h-[88vh] w-full rounded-2xl bg-white shadow-2xl border border-slate-200/90 overflow-hidden",
          width,
        )}
      >
        {/* Draggable header */}
        <div
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            handleStartDrag(e.clientX, e.clientY);
          }}
          onTouchStart={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            if (e.touches[0]) handleStartDrag(e.touches[0].clientX, e.touches[0].clientY);
          }}
          onDoubleClick={() => setPosition({ x: 0, y: 0 })}
          className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-3.5 select-none cursor-grab active:cursor-grabbing"
          title="Click and drag to move window (Double-click to re-center)"
        >
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 text-xs font-mono select-none" aria-hidden="true">
                ⋮⋮
              </span>
              <h2 className="text-base font-semibold text-slate-900 truncate">{title}</h2>
              <span className="hidden sm:inline-block rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                Movable Window
              </span>
            </div>
            {description ? <p className="mt-0.5 text-xs text-slate-500 truncate">{description}</p> : null}
          </div>

          <button
            onClick={onClose}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal scrollable body */}
        <div className="scroll-thin flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {/* Modal footer */}
        {footer ? (
          <div className="flex-shrink-0 flex justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* --------------------------------- Toasts -------------------------------- */

type Toast = { id: number; message: string; tone: "success" | "error" | "info" };
type ToastContextValue = { push: (message: string, tone?: Toast["tone"]) => void };

const ToastContext = createContext<ToastContextValue>({ push: () => undefined });

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3600);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={classNames(
              "animate-fade-up pointer-events-auto flex items-start gap-3 rounded-xl px-4 py-3 text-sm shadow-lg ring-1",
              toast.tone === "success" && "bg-emerald-600 text-white ring-emerald-500",
              toast.tone === "error" && "bg-rose-600 text-white ring-rose-500",
              toast.tone === "info" && "bg-slate-900 text-white ring-slate-800",
            )}
          >
            <span>{toast.tone === "success" ? "✅" : toast.tone === "error" ? "⚠️" : "ℹ️"}</span>
            <span className="flex-1">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------- Confirm --------------------------------- */

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Delete",
  onConfirm,
  onCancel,
  busy,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      width="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}

/* ------------------------------- Stat card -------------------------------- */

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "brand",
  loading,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: string;
  accent?: "brand" | "green" | "amber" | "sky" | "rose";
  loading?: boolean;
}) {
  const accents: Record<string, string> = {
    brand: "from-brand-500/15 to-violet-500/10 text-brand-700",
    green: "from-emerald-500/15 to-teal-500/10 text-emerald-700",
    amber: "from-amber-500/15 to-orange-500/10 text-amber-700",
    sky: "from-sky-500/15 to-cyan-500/10 text-sky-700",
    rose: "from-rose-500/15 to-pink-500/10 text-rose-700",
  };
  return (
    <Card className="relative overflow-hidden">
      <div
        className={classNames(
          "pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gradient-to-br blur-xl",
          accents[accent],
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-20" />
          ) : (
            <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          )}
          {sub ? <p className="mt-1 truncate text-xs text-slate-500">{sub}</p> : null}
        </div>
        {icon ? (
          <span
            className={classNames(
              "grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-lg",
              accents[accent],
            )}
          >
            {icon}
          </span>
        ) : null}
      </div>
    </Card>
  );
}
