import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import {
  ApiError,
  clearNotifications,
  deleteNotification,
  fetchNotifications,
  markNotificationRead,
} from "../../lib/api";
import {
  NOTIFICATION_CATEGORY_LABELS,
  type Notification,
  type NotificationCategory,
} from "../../types/notification";
import { Skeleton } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";

const PAGE_SIZE = 20;

type ReadFilter = "" | "unread" | "read";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("sw-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function NotificationsPage() {
  const { token, logout, hasPermission } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState<NotificationCategory | "">("");
  const [readFilter, setReadFilter] = useState<ReadFilter>("");
  const [loading, setLoading] = useState(true);
  // Skeleton rows only on the very first load; later fetches (filter/page
  // changes, mutations) keep the current rows on screen and just dim them —
  // swapping the whole table for skeletons on every filter change made the
  // page jump and flicker.
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnce = useRef(false);
  const [clearing, setClearing] = useState(false);
  // Bumped to force a refetch after a mutation without duplicating fetch code.
  const [refreshKey, setRefreshKey] = useState(0);

  const canManage = hasPermission("notifications.manage");
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    if (hasLoadedOnce.current) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    fetchNotifications(token, page, PAGE_SIZE, {
      category,
      read: readFilter === "" ? undefined : readFilter === "read",
    })
      .then((data) => {
        if (cancelled) return;
        setNotifications(data.notifications);
        setTotal(data.total);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
          logout();
          return;
        }
        toast.error("Imeshindwa kupakia arifa.");
      })
      .finally(() => {
        if (cancelled) return;
        hasLoadedOnce.current = true;
        setLoading(false);
        setRefreshing(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, page, category, readFilter, refreshKey, logout, toast]);

  async function handleOpen(notification: Notification) {
    if (!token) return;
    if (!notification.is_read) {
      try {
        await markNotificationRead(token, notification.id);
        setRefreshKey((k) => k + 1);
      } catch {
        // Navigate anyway — a failed mark-read shouldn't block the admin.
      }
    }
    if (notification.link_url) navigate(notification.link_url);
  }

  async function handleMarkRead(notification: Notification) {
    if (!token || notification.is_read) return;
    try {
      await markNotificationRead(token, notification.id);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      toast.error("Imeshindwa kuweka arifa kama imesomwa.");
    }
  }

  async function handleDelete(notification: Notification) {
    if (!token) return;
    const confirmed = await confirm({
      title: "Futa Arifa",
      message:
        "Una uhakika unataka kufuta arifa hii kabisa? Hatua hii haiwezi kutenduliwa.",
      confirmLabel: "Futa",
    });
    if (!confirmed) return;

    try {
      await deleteNotification(token, notification.id);
      toast.success("Arifa imefutwa.");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
        return;
      }
      toast.error("Imeshindwa kufuta arifa.");
    }
  }

  async function handleClearAll() {
    if (!token) return;
    const confirmed = await confirm({
      title: "Futa Arifa Zote",
      message:
        "Una uhakika unataka kufuta arifa zote kabisa? Hatua hii haiwezi kutenduliwa.",
      confirmLabel: "Futa Zote",
    });
    if (!confirmed) return;

    setClearing(true);
    try {
      await toast.promise(clearNotifications(token), {
        loading: "Inafuta arifa...",
        success: "Arifa zote zimefutwa.",
        error: (err) =>
          err instanceof ApiError && err.status === 401
            ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
            : "Imeshindwa kufuta arifa.",
      });
      setNotifications([]);
      setTotal(0);
      setPage(1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
      }
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Arifa</h1>
          <p className="text-ink-muted">
            Arifa zote za mfumo — stoo ndogo, maombi ya nenosiri na nyinginezo.
          </p>
        </div>
        {canManage && total > 0 && (
          <button
            type="button"
            onClick={() => void handleClearAll()}
            disabled={clearing}
            className="flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-muted transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-60"
          >
            <Trash2 size={16} /> Futa Arifa Zote
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value as NotificationCategory | "");
            setPage(1);
          }}
          disabled={refreshing}
          aria-label="Chuja kwa aina"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-accent disabled:opacity-60"
        >
          <option value="">Aina Zote</option>
          {(
            Object.entries(NOTIFICATION_CATEGORY_LABELS) as [
              NotificationCategory,
              string,
            ][]
          ).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>

        <select
          value={readFilter}
          onChange={(e) => {
            setReadFilter(e.target.value as ReadFilter);
            setPage(1);
          }}
          disabled={refreshing}
          aria-label="Chuja kwa hali"
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition focus:border-brand-accent disabled:opacity-60"
        >
          <option value="">Hali Zote</option>
          <option value="unread">Hazijasomwa</option>
          <option value="read">Zimesomwa</option>
        </select>

        {refreshing && (
          <Loader2
            size={16}
            aria-label="Inapakia"
            className="animate-spin text-brand-accent"
          />
        )}
      </div>

      {!loading && !refreshing && notifications.length === 0 && (
        <p className="text-ink-muted">Hakuna arifa zinazolingana na vichujio.</p>
      )}

      {(loading || refreshing || notifications.length > 0) && (
        <div
          className={`overflow-hidden rounded-2xl border border-line shadow-card transition-opacity duration-200 ${
            refreshing ? "pointer-events-none opacity-50" : "opacity-100"
          }`}
        >
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Arifa</th>
                <th className="px-4 py-3 font-semibold">Aina</th>
                <th className="px-4 py-3 font-semibold">Wakati</th>
                <th className="px-4 py-3 font-semibold">Hali</th>
                <th className="px-4 py-3 font-semibold">
                  <span className="sr-only">Vitendo</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-64" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-6 w-16 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-8" />
                    </td>
                  </tr>
                ))}
              {!loading &&
                notifications.map((n) => (
                  <tr key={n.id} className="text-ink">
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => void handleOpen(n)}
                        className={`flex items-center gap-2 text-left transition hover:text-brand-accent ${
                          n.is_read ? "text-ink-muted" : "font-medium"
                        }`}
                      >
                        {!n.is_read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-brand-accent" />
                        )}
                        {n.message}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone="neutral">
                        {NOTIFICATION_CATEGORY_LABELS[
                          n.category as NotificationCategory
                        ] ?? n.category}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {formatDateTime(n.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {n.is_read ? (
                        <StatusBadge tone="success">Imesomwa</StatusBadge>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleMarkRead(n)}
                          title="Weka kama imesomwa"
                          className="cursor-pointer"
                        >
                          <StatusBadge tone="warning">Mpya</StatusBadge>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {canManage && (
                        <button
                          type="button"
                          onClick={() => void handleDelete(n)}
                          aria-label="Futa arifa"
                          className="text-ink-muted transition hover:text-red-500"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && total > 0 && (
        <div className="flex items-center justify-between text-sm text-ink-muted">
          <span>
            Ukurasa {page} kati ya {totalPages} ({total} jumla)
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              aria-label="Ukurasa uliopita"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-muted transition hover:border-brand-accent hover:text-brand-accent disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              aria-label="Ukurasa unaofuata"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-ink-muted transition hover:border-brand-accent hover:text-brand-accent disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
