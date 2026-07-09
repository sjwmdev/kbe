import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { ApiError, clearAuditLogs, fetchAuditLogs } from "../../lib/api";
import type { AuditLog } from "../../types/audit";
import { Skeleton } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";

const PAGE_SIZE = 20;

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("sw-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AuditLogsPage() {
  const { token, logout, roleName, profileLoading } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!token || roleName !== "SuperAdmin") return;
    let cancelled = false;
    setLoading(true);

    fetchAuditLogs(token, page, PAGE_SIZE)
      .then((data) => {
        if (cancelled) return;
        setLogs(data.logs);
        setTotal(data.total);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
          logout();
          return;
        }
        toast.error("Imeshindwa kupakia kumbukumbu.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, page, roleName, logout, toast]);

  // Defense-in-depth on top of the backend's hard RequireSuperAdmin gate —
  // there's deliberately no permission key for this page (see Task 14 plan),
  // so it's checked directly against the role name instead of hasPermission.
  // Waits for profileLoading first: roleName starts empty on every hard
  // reload regardless of the real role, so redirecting before rehydration
  // resolves would incorrectly kick out a real SuperAdmin on page refresh.
  if (profileLoading) {
    return null;
  }
  if (roleName !== "SuperAdmin") {
    return <Navigate to="/admin" replace />;
  }

  async function handleClear() {
    if (!token) return;
    const confirmed = await confirm({
      title: "Futa Kumbukumbu Zote",
      message:
        "Una uhakika unataka kufuta kumbukumbu zote za mfumo? Hatua hii haiwezi kutenduliwa.",
      confirmLabel: "Futa Zote",
    });
    if (!confirmed) return;

    setClearing(true);
    try {
      await toast.promise(clearAuditLogs(token), {
        loading: "Inafuta kumbukumbu...",
        success: "Kumbukumbu zote zimefutwa.",
        error: (err) =>
          err instanceof ApiError && err.status === 401
            ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
            : "Imeshindwa kufuta kumbukumbu.",
      });
      setLogs([]);
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
          <h1 className="text-2xl font-extrabold text-ink">Kumbukumbu za Mfumo</h1>
          <p className="text-ink-muted">
            Rekodi ya vitendo muhimu na kuingia kwa watumiaji.
          </p>
        </div>
        {total > 0 && (
          <button
            type="button"
            onClick={() => void handleClear()}
            disabled={clearing}
            className="flex items-center gap-2 rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-muted transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-60"
          >
            <Trash2 size={16} /> Futa Kumbukumbu Zote
          </button>
        )}
      </div>

      {!loading && logs.length === 0 && (
        <p className="text-ink-muted">Bado hakuna kumbukumbu zilizorekodiwa.</p>
      )}

      {(loading || logs.length > 0) && (
        <div className="overflow-hidden rounded-2xl border border-line">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Wakati</th>
                <th className="px-4 py-3 font-semibold">Mtumiaji</th>
                <th className="px-4 py-3 font-semibold">Kitendo</th>
                <th className="px-4 py-3 font-semibold">Hali</th>
                <th className="px-4 py-3 font-semibold">Muda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-32" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-48" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-6 w-14 rounded-full" />
                    </td>
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-12" />
                    </td>
                  </tr>
                ))}
              {!loading &&
                logs.map((log) => (
                  <tr key={log.id} className="text-ink">
                    <td className="px-4 py-3 text-ink-muted">
                      {formatDateTime(log.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {log.username || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                      {log.method} {log.path}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={log.status_code < 400 ? "success" : "danger"}>
                        {log.status_code}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {log.duration_ms} ms
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
