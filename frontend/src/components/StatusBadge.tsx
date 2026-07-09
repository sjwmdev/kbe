import type { ReactNode } from "react";
import { STATUS_TONE_CLASSES, type StatusTone } from "../lib/statusTone";

interface StatusBadgeProps {
  tone: StatusTone;
  children: ReactNode;
}

// A small read-only pill for binary/tri-state status displays (active/
// inactive, success/failure) — the same visual treatment was previously
// repeated verbatim across ProductsPage and AuditLogsPage.
export function StatusBadge({ tone, children }: StatusBadgeProps) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE_CLASSES[tone]}`}
    >
      {children}
    </span>
  );
}
