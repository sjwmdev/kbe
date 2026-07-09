import { createContext, useCallback, useContext, useState } from "react";
import type { ReactNode } from "react";
import { ConfirmModal } from "../components/ConfirmModal";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  /**
   * "brand" (default) uses the app's brand-accent styling. "plain" forces a
   * neutral white background with black text regardless of theme — for
   * dialogs that need to read as a plain, unambiguous system alert (e.g.
   * bulk-delete confirmations) rather than a branded action.
   */
  tone?: "brand" | "plain";
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | undefined>(undefined);

// App-wide replacement for window.confirm(): returns a promise the caller
// can await, backed by the shared ConfirmModal component instead of a
// native browser dialog.
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      setPending({ ...options, resolve });
    });
  }, []);

  function settle(result: boolean) {
    pending?.resolve(result);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <ConfirmModal
          title={pending.title}
          message={pending.message}
          confirmLabel={pending.confirmLabel}
          cancelLabel={pending.cancelLabel}
          danger={pending.danger}
          tone={pending.tone}
          onConfirm={() => settle(true)}
          onCancel={() => settle(false)}
        />
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
