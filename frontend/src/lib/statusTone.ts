export type StatusTone = "success" | "neutral" | "danger" | "warning";

// Shared color treatment for status pills/toggles (active/inactive,
// success/failure) — used by both the read-only StatusBadge component and
// any interactive status control (e.g. UsersPage's active/inactive button)
// that needs the exact same colors but can't be a plain <span>.
export const STATUS_TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
  neutral: "bg-surface-hover text-ink-muted",
  danger: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400",
  // Distinct from danger — used for "low stock", a warning short of the
  // "out of stock" danger state.
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400",
};
