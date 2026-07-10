import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { ApiError, fetchOrders, updateOrderStatus } from "../../lib/api";
import type { Order, OrderStatus } from "../../types/order";
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from "../../types/order";
import { formatPrice } from "../../lib/format";
import { TableSkeleton } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";
import { STATUS_TONE_CLASSES } from "../../lib/statusTone";

const PAGE_SIZE = 10;
const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "confirmed",
  "delivered",
  "cancelled",
];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("sw-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function itemsSummary(order: Order): string {
  if (order.items.length === 0) return "—";
  const [first, ...rest] = order.items;
  const label = `${first.product_name} x${first.quantity}`;
  return rest.length > 0 ? `${label} +${rest.length} zaidi` : label;
}

export function OrdersPage() {
  const { token, logout, hasPermission } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);

    fetchOrders(token, page, PAGE_SIZE)
      .then((data) => {
        if (cancelled) return;
        setOrders(data.orders);
        setTotal(data.total);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
          logout();
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
          return;
        }
        toast.error("Imeshindwa kupakia oda.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, page, logout, toast]);

  async function handleStatusChange(order: Order, status: OrderStatus) {
    if (!token) return;
    setUpdatingId(order.id);
    try {
      const updated = await toast.promise(
        updateOrderStatus(token, order.id, status),
        {
          loading: "Inasasisha hali ya oda...",
          success: "Hali ya oda imesasishwa.",
          error: (err) =>
            err instanceof ApiError && err.status === 401
              ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
              : "Imeshindwa kusasisha hali ya oda.",
        },
      );
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? updated : o)),
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
      }
    } finally {
      setUpdatingId(null);
    }
  }

  if (forbidden) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-extrabold text-ink">Oda</h1>
        <p className="text-ink-muted">Huna ruhusa ya kuona oda.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-extrabold text-ink">Oda</h1>
        {hasPermission("orders.create") && (
          <Link
            to="/admin/orders/new"
            className="flex items-center gap-2 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark"
          >
            <Plus size={16} /> Ongeza Oda
          </Link>
        )}
      </div>

      {!loading && orders.length === 0 && (
        <p className="text-ink-muted">Hakuna oda zilizorekodiwa bado.</p>
      )}

      {(loading || orders.length > 0) && (
        <div className="overflow-hidden rounded-2xl border border-line shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Mteja</th>
                <th className="px-4 py-3 font-semibold">Bidhaa</th>
                <th className="px-4 py-3 font-semibold">Jumla</th>
                <th className="px-4 py-3 font-semibold">Hali</th>
                <th className="px-4 py-3 font-semibold">Tarehe</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && <TableSkeleton />}
              {!loading &&
                orders.map((order) => (
                  <tr key={order.id} className="text-ink">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">
                          {order.customer.name}
                        </span>
                        <span className="text-xs text-ink-muted">
                          {order.customer.phone}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {itemsSummary(order)}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {formatPrice(order.total_amount)}
                    </td>
                    <td className="px-4 py-3">
                      {hasPermission("orders.edit") ? (
                        <select
                          value={order.status}
                          disabled={updatingId === order.id}
                          onChange={(e) =>
                            handleStatusChange(
                              order,
                              e.target.value as OrderStatus,
                            )
                          }
                          className={`rounded-full border-0 px-3 py-1 text-xs font-semibold outline-none disabled:opacity-60 ${
                            STATUS_TONE_CLASSES[ORDER_STATUS_TONE[order.status]]
                          }`}
                        >
                          {ORDER_STATUSES.map((status) => (
                            <option
                              key={status}
                              value={status}
                              className="bg-surface text-ink"
                            >
                              {ORDER_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <StatusBadge tone={ORDER_STATUS_TONE[order.status]}>
                          {ORDER_STATUS_LABELS[order.status]}
                        </StatusBadge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {formatDateTime(order.created_at)}
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
