import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2, X } from "lucide-react";

type ToastType = "success" | "error" | "loading";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  leaving: boolean;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  /** Shows a persistent spinner toast; returns an id for update()/dismiss(). */
  loading: (message: string) => number;
  /** Turns an existing toast (usually a loading one) into success/error. */
  update: (id: number, type: "success" | "error", message: string) => void;
  dismiss: (id: number) => void;
  /**
   * SweetAlert-style promise helper: shows a loading toast immediately,
   * then resolves it to success/error once the promise settles.
   */
  promise: <T>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((result: T) => string);
      error: string | ((err: unknown) => string);
    },
  ) => Promise<T>;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const AUTO_DISMISS_MS = 4000;
const EXIT_ANIMATION_MS = 200;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const remove = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)),
      );
      setTimeout(() => remove(id), EXIT_ANIMATION_MS);
    },
    [remove],
  );

  const push = useCallback(
    (type: ToastType, message: string) => {
      const id = nextId.current++;
      setToasts((prev) => [...prev, { id, type, message, leaving: false }]);
      if (type !== "loading") {
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      }
      return id;
    },
    [dismiss],
  );

  const update = useCallback(
    (id: number, type: "success" | "error", message: string) => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, type, message } : t)),
      );
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const promise = useCallback(
    async <T,>(
      p: Promise<T>,
      messages: {
        loading: string;
        success: string | ((result: T) => string);
        error: string | ((err: unknown) => string);
      },
    ): Promise<T> => {
      const id = push("loading", messages.loading);
      try {
        const result = await p;
        const message =
          typeof messages.success === "function"
            ? messages.success(result)
            : messages.success;
        update(id, "success", message);
        return result;
      } catch (err) {
        const message =
          typeof messages.error === "function"
            ? messages.error(err)
            : messages.error;
        update(id, "error", message);
        throw err;
      }
    },
    [push, update],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message: string) => {
        push("success", message);
      },
      error: (message: string) => {
        push("error", message);
      },
      loading: (message: string) => push("loading", message),
      update,
      dismiss,
      promise,
    }),
    [push, update, dismiss, promise],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-50 flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border bg-surface/95 p-4 shadow-lg backdrop-blur ${
              toast.leaving
                ? "animate-[toast-out_0.2s_ease-in_forwards]"
                : "animate-[toast-in_0.25s_cubic-bezier(0.34,1.56,0.64,1)]"
            } ${
              toast.type === "success"
                ? "border-green-500/30 text-green-600 dark:text-green-400"
                : toast.type === "loading"
                  ? "border-brand-accent/30 text-brand-accent"
                  : "border-brand-accent/40 text-brand-accent"
            }`}
          >
            {toast.type === "success" && (
              <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
            )}
            {toast.type === "error" && (
              <AlertCircle size={20} className="mt-0.5 shrink-0" />
            )}
            {toast.type === "loading" && (
              <Loader2 size={20} className="mt-0.5 shrink-0 animate-spin" />
            )}
            <p className="flex-1 text-sm text-ink">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Funga"
              className="shrink-0 text-ink-muted hover:text-ink"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
