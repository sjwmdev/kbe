import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface ErrorPageProps {
  code: string;
  icon: ReactNode;
  title: string;
  message: string;
  actionLabel?: string;
  /** Navigates here via react-router. Ignored if onAction is provided. */
  actionTo?: string;
  /** Renders the action as a plain button instead of a Link (e.g. "reload"). */
  onAction?: () => void;
}

// Shared shell for the 404/403/500 pages below — one consistent, on-brand
// look for every "something went wrong" state across the site.
export function ErrorPage({
  code,
  icon,
  title,
  message,
  actionLabel = "Rudi Nyumbani",
  actionTo = "/",
  onAction,
}: ErrorPageProps) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <span className="mb-6 flex items-center justify-center text-icon">
        {icon}
      </span>
      <span className="text-xs font-semibold uppercase tracking-widest text-brand-accent">
        Hitilafu {code}
      </span>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
        {title}
      </h1>
      <p className="mt-4 max-w-md leading-relaxed text-ink-muted">{message}</p>
      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-accent px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-accent-dark"
        >
          {actionLabel}
        </button>
      ) : (
        <Link
          to={actionTo}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-brand-accent px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-accent-dark"
        >
          {actionLabel}
        </Link>
      )}
    </div>
  );
}
