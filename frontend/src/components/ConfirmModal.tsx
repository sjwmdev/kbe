import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

export interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the confirm button as destructive (brand-red) vs. a neutral dark action. */
  danger?: boolean;
  /**
   * "brand" (default) follows the app's theme. "plain" forces a neutral
   * white card with black text regardless of light/dark mode, for dialogs
   * that should read as a plain system alert rather than a branded action.
   */
  tone?: "brand" | "plain";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = "Thibitisha",
  cancelLabel = "Ghairi",
  danger = true,
  tone = "brand",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const isPlain = tone === "plain";

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 animate-[modal-backdrop-in_0.15s_ease-out]"
      onClick={onCancel}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl animate-[modal-pop-in_0.2s_cubic-bezier(0.34,1.56,0.64,1)] ${
          isPlain ? "border border-gray-200 bg-white" : "border border-line bg-surface"
        }`}
      >
        <span
          className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full ${
            isPlain
              ? "bg-gray-100 text-gray-700"
              : danger
                ? "bg-brand-accent/10 text-brand-accent"
                : "bg-surface-hover text-ink-muted"
          }`}
        >
          <AlertTriangle size={22} />
        </span>
        <h2
          id="confirm-modal-title"
          className={`mb-2 text-lg font-bold ${isPlain ? "text-black" : "text-ink"}`}
        >
          {title}
        </h2>
        <p
          className={`mb-6 text-sm leading-relaxed ${isPlain ? "text-gray-600" : "text-ink-muted"}`}
        >
          {message}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className={
              isPlain
                ? "flex-1 rounded-full border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-100"
                : "flex-1 rounded-full border border-line py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-surface-hover hover:text-ink"
            }
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className={
              isPlain
                ? "flex-1 rounded-full bg-black py-2.5 text-sm font-bold text-white transition hover:opacity-90"
                : `flex-1 rounded-full py-2.5 text-sm font-bold text-white transition ${
                    danger
                      ? "bg-brand-accent hover:bg-brand-accent-dark"
                      : "bg-ink hover:opacity-90"
                  }`
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
