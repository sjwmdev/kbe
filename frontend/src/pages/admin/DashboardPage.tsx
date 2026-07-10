import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import {
  Plus,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { ApiError, fetchDashboardSummary } from "../../lib/api";
import type { DashboardSummary } from "../../types/order";
import { formatPrice } from "../../lib/format";
import { Skeleton } from "../../components/Skeleton";

function TrendIndicator({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-ink-muted">Bila mabadiliko</span>;
  }
  const isUp = pct >= 0;
  const Icon = isUp ? TrendingUp : TrendingDown;
  return (
    <span
      className={`flex items-center gap-1 font-semibold ${
        isUp ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
      }`}
    >
      <Icon size={14} />
      {Math.abs(pct).toFixed(1)}% tangu mwezi uliopita
    </span>
  );
}

function KpiCard({
  label,
  icon,
  value,
  trendPct,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  trendPct: number | null;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">
          {label}
        </span>
        {icon}
      </div>
      <p className="text-3xl font-extrabold text-ink">{value}</p>
      <p className="mt-1 text-xs">
        <TrendIndicator pct={trendPct} />
      </p>
    </div>
  );
}

export function DashboardPage() {
  const { token, logout } = useAuth();
  const toast = useToast();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    fetchDashboardSummary(token)
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
          logout();
          return;
        }
        toast.error("Imeshindwa kupakia taarifa za biashara.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, logout, toast]);

  if (loading || !summary) {
    return (
      <div className="flex flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-40" />
          </div>
          <Skeleton className="h-10 w-40 rounded-full" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-line bg-surface p-6 shadow-card">
              <div className="mb-4 flex items-center justify-between">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-6 rounded" />
              </div>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="mt-2 h-3 w-28" />
            </div>
          ))}
        </div>
        <div>
          <Skeleton className="mb-4 h-6 w-56" />
          <div className="overflow-hidden rounded-xl border border-line shadow-card">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className={`flex items-center justify-between bg-surface p-4 ${i > 0 ? "border-t border-line" : ""}`}
              >
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Muhtasari wa Biashara</h1>
          <p className="text-ink-muted">Muhtasari wa shughuli za siku 30 zilizopita.</p>
        </div>
        <Link
          to="/admin/products/new"
          className="flex items-center gap-2 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark"
        >
          <Plus size={16} /> Ongeza Bidhaa
        </Link>
      </div>

      {summary.can_view_orders && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            label="Mauzo Yote"
            icon={<Wallet size={22} className="text-icon" />}
            value={formatPrice(summary.total_sales)}
            trendPct={summary.total_sales_trend_pct}
          />
          <KpiCard
            label="Oda Zote"
            icon={<ShoppingCart size={22} className="text-icon" />}
            value={String(summary.total_orders)}
            trendPct={summary.total_orders_trend_pct}
          />
          <KpiCard
            label="Wateja Amilifu"
            icon={<Users size={22} className="text-icon" />}
            value={String(summary.active_customers)}
            trendPct={summary.active_customers_trend_pct}
          />
        </div>
      )}

      {summary.can_view_products && (
        <div>
          <h2 className="mb-4 text-lg font-bold text-ink">
            Utendaji wa Bidhaa Hivi Karibuni
          </h2>

          {summary.product_performance.length === 0 ? (
            <p className="text-ink-muted">
              Bado hakuna bidhaa zilizouzwa katika siku 30 zilizopita.
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line shadow-card">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-hover text-ink-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Bidhaa</th>
                    <th className="px-4 py-3 font-semibold">Kundi</th>
                    <th className="px-4 py-3 font-semibold">Idadi Iliyouzwa</th>
                    <th className="px-4 py-3 font-semibold">Hali ya Stoo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {summary.product_performance.map((item) => (
                    <tr key={item.product_id} className="text-ink">
                      <td className="px-4 py-3 font-medium">
                        <Link
                          to={`/admin/products/${item.product_id}/edit`}
                          className="hover:text-brand-accent"
                        >
                          {item.product_name}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-ink-muted">
                        {item.category}
                      </td>
                      <td className="px-4 py-3 text-ink-muted">{item.units_sold}</td>
                      <td className="px-4 py-3 text-ink-muted">{item.stock_quantity}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!summary.can_view_orders && !summary.can_view_products && (
        <p className="text-ink-muted">
          Huna ruhusa ya kuona takwimu za biashara. Wasiliana na msimamizi wako.
        </p>
      )}
    </div>
  );
}
