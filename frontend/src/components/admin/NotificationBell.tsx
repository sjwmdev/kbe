import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  clearNotifications,
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
} from "../../lib/api";
import type { Notification } from "../../types/notification";

const POLL_INTERVAL_MS = 60_000;
const PANEL_MAX_WIDTH = 320;
const VIEWPORT_GUTTER = 8;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("sw-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Minimal notification bell — foundation for the fuller system planned
 * later (categories/filters beyond low_stock, password-reset requests,
 * etc.). This already covers the real thing admins need today: see a low
 * stock alert, jump to the product, mark it read, or clear everything.
 */
export function NotificationBell() {
  const { token, hasPermission } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const canView = hasPermission("notifications.view");

  useEffect(() => {
    if (!token || !canView) return;

    function refreshCount() {
      if (!token) return;
      fetchUnreadNotificationCount(token)
        .then((data) => setUnreadCount(data.unread_count))
        .catch(() => {
          // Silent — a failed badge refresh isn't worth surfacing to the user.
        });
    }

    refreshCount();
    const timer = setInterval(refreshCount, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [token, canView]);

  useEffect(() => {
    if (!open || !token) return;
    setLoading(true);
    fetchNotifications(token, 1, 20)
      .then((data) => setNotifications(data.notifications))
      .catch(() => {
        // Silent — the panel just stays empty if this fails.
      })
      .finally(() => setLoading(false));
  }, [open, token]);

  // The panel renders through a portal with fixed positioning (so the
  // sidebar/header containers can never clip it — the old absolute panel
  // was wider than the sidebar and got cut off) and is clamped inside the
  // viewport with a small gutter on both sides, shrinking on narrow
  // screens instead of overflowing.
  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const width = Math.min(
      PANEL_MAX_WIDTH,
      window.innerWidth - VIEWPORT_GUTTER * 2,
    );
    const left = Math.max(
      VIEWPORT_GUTTER,
      Math.min(rect.right - width, window.innerWidth - width - VIEWPORT_GUTTER),
    );
    setPos({ top: rect.bottom + 8, left, width });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function handleClose() {
      setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleClose);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleClose);
    };
  }, [open]);

  async function handleOpenNotification(notification: Notification) {
    if (!token) return;
    setOpen(false);
    if (!notification.is_read) {
      try {
        await markNotificationRead(token, notification.id);
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // Navigate anyway — a failed mark-read shouldn't block the admin.
      }
    }
    if (notification.link_url) navigate(notification.link_url);
  }

  async function handleClearAll() {
    if (!token) return;
    try {
      await clearNotifications(token);
      setNotifications([]);
      setUnreadCount(0);
    } catch {
      // Best-effort — panel just keeps showing stale items on failure.
    }
  }

  if (!canView) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Arifa"
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition hover:bg-surface-hover hover:text-brand-accent"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-accent px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
        <div
          ref={panelRef}
          role="menu"
          style={
            pos
              ? { top: pos.top, left: pos.left, width: pos.width }
              : { top: 0, left: 0, visibility: "hidden" }
          }
          className="fixed z-[300] overflow-hidden rounded-xl border border-line bg-surface shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-sm font-bold text-ink">Arifa</span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => void handleClearAll()}
                className="text-xs font-semibold text-ink-muted hover:text-brand-accent"
              >
                Futa Zote
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && (
              <p className="p-4 text-center text-sm text-ink-muted">Inapakia...</p>
            )}
            {!loading && notifications.length === 0 && (
              <p className="p-4 text-center text-sm text-ink-muted">
                Hakuna arifa kwa sasa.
              </p>
            )}
            {!loading &&
              notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => void handleOpenNotification(n)}
                  className={`flex w-full flex-col gap-1 border-b border-line px-4 py-3 text-left text-sm transition last:border-0 hover:bg-surface-hover ${
                    n.is_read ? "text-ink-muted" : "text-ink"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    {!n.is_read && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-brand-accent" />
                    )}
                    {n.message}
                  </span>
                  <span className="text-xs text-ink-muted">
                    {formatDateTime(n.created_at)}
                  </span>
                </button>
              ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/admin/notifications");
            }}
            className="w-full border-t border-line px-4 py-3 text-center text-sm font-semibold text-brand-accent transition hover:bg-surface-hover"
          >
            Ona Arifa Zote
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
