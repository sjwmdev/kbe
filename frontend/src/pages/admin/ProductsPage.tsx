import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import {
  ApiError,
  deleteProduct,
  fetchAdminProducts,
  forceDeleteProduct,
  resolveMediaUrl,
  restoreProduct,
} from "../../lib/api";
import type { Product } from "../../types/product";
import { formatPrice } from "../../lib/format";
import { ImagePlaceholder } from "../../components/ImagePlaceholder";
import { TableSkeleton } from "../../components/Skeleton";
import { StatusBadge } from "../../components/StatusBadge";
import { ActionMenu, type ActionMenuItem } from "../../components/admin/ActionMenu";

const PAGE_SIZE = 10;

export function ProductsPage() {
  const { token, logout, hasPermission } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);

    fetchAdminProducts(token, page, PAGE_SIZE)
      .then((data) => {
        if (cancelled) return;
        setProducts(data.products);
        setTotal(data.total);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
          logout();
          return;
        }
        toast.error("Imeshindwa kupakia bidhaa.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, page, logout, toast]);

  // Search only filters the currently loaded page — full-catalog search
  // would need a server-side query param, out of scope for this pass.
  const filtered = search.trim()
    ? products.filter((p) =>
        p.name.toLowerCase().includes(search.trim().toLowerCase()),
      )
    : products;

  async function handleDelete(product: Product) {
    if (!token) return;
    const confirmed = await confirm({
      title: "Ficha Bidhaa",
      message: `Una uhakika unataka kuficha "${product.name}"? Haitaonekana kwa wateja hadi utakapoirejesha.`,
      confirmLabel: "Ficha",
    });
    if (!confirmed) return;

    setDeletingId(product.id);
    try {
      await toast.promise(deleteProduct(token, product.id), {
        loading: "Inaficha bidhaa...",
        success: `"${product.name}" imefichwa.`,
        error: (err) =>
          err instanceof ApiError && err.status === 401
            ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
            : "Imeshindwa kuficha bidhaa.",
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: false } : p)),
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRestore(product: Product) {
    if (!token) return;
    setDeletingId(product.id);
    try {
      await toast.promise(restoreProduct(token, product.id), {
        loading: "Inarejesha bidhaa...",
        success: `"${product.name}" imerejeshwa.`,
        error: (err) =>
          err instanceof ApiError && err.status === 401
            ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
            : "Imeshindwa kurejesha bidhaa.",
      });
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, is_active: true } : p)),
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleForceDelete(product: Product) {
    if (!token) return;
    const confirmed = await confirm({
      title: "Futa Bidhaa Kabisa",
      message: `Una uhakika unataka kufuta "${product.name}" KABISA kutoka kwenye mfumo? Hatua hii HAIWEZI kutenduliwa. Ikiwa bidhaa hii ina historia ya oda, kitendo hiki kitashindwa ili kulinda taarifa za kifedha.`,
      confirmLabel: "Futa Kabisa",
    });
    if (!confirmed) return;

    setDeletingId(product.id);
    try {
      await toast.promise(forceDeleteProduct(token, product.id), {
        loading: "Inafuta bidhaa kabisa...",
        success: `"${product.name}" imefutwa kabisa.`,
        error: (err) =>
          err instanceof ApiError && err.status === 401
            ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
            : err instanceof ApiError
              ? err.message
              : "Imeshindwa kufuta bidhaa kabisa.",
      });
      setProducts((prev) => prev.filter((p) => p.id !== product.id));
      setTotal((prev) => prev - 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <h1 className="text-2xl font-extrabold text-ink">Bidhaa</h1>
        <div className="relative w-full sm:w-72">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted"
          />
          <input
            type="text"
            placeholder="Tafuta bidhaa (ukurasa huu)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-full border border-line bg-surface-hover py-2 pl-9 pr-4 text-ink outline-none focus:border-brand-accent"
          />
        </div>
      </div>

      {!loading && filtered.length === 0 && (
        <p className="text-ink-muted">Hakuna bidhaa zinazolingana.</p>
      )}

      {(loading || filtered.length > 0) && (
        <div className="overflow-hidden rounded-2xl border border-line shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface-hover text-ink-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Jina</th>
                <th className="px-4 py-3 font-semibold">Kategoria</th>
                <th className="px-4 py-3 font-semibold">Bei</th>
                <th className="px-4 py-3 font-semibold">Stoo</th>
                <th className="px-4 py-3 font-semibold">Hali</th>
                <th className="px-4 py-3 font-semibold">Vitendo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading && <TableSkeleton />}
              {!loading && filtered.map((product) => {
                const thumb =
                  product.images.find((img) => img.is_primary) ??
                  product.images[0];
                return (
                <tr key={product.id} className="text-ink">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-surface-hover">
                        {thumb ? (
                          <img
                            src={resolveMediaUrl(thumb.image_url)}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImagePlaceholder iconSize={16} />
                        )}
                      </div>
                      <span className="font-medium">{product.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {product.category}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {formatPrice(product.price)}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {product.stock_quantity}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge tone={product.is_active ? "success" : "neutral"}>
                      {product.is_active ? "Inaonekana" : "Imefichwa"}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3">
                    <ActionMenu
                      items={(
                        [
                          hasPermission("products.view") && {
                            label: "Angalia",
                            onClick: () => navigate(`/admin/products/${product.id}`),
                          },
                          hasPermission("products.edit") && {
                            label: "Hariri",
                            onClick: () => navigate(`/admin/products/${product.id}/edit`),
                          },
                          hasPermission("products.delete") && product.is_active && {
                            label: "Ficha",
                            onClick: () => void handleDelete(product),
                            disabled: deletingId === product.id,
                            danger: true,
                          },
                          hasPermission("products.restore") && !product.is_active && {
                            label: "Rejesha",
                            onClick: () => void handleRestore(product),
                            disabled: deletingId === product.id,
                          },
                          hasPermission("products.forceDelete") && !product.is_active && {
                            label: "Futa Kabisa",
                            onClick: () => void handleForceDelete(product),
                            disabled: deletingId === product.id,
                            danger: true,
                          },
                        ] as (ActionMenuItem | false)[]
                      ).filter((item): item is ActionMenuItem => Boolean(item))}
                    />
                  </td>
                </tr>
                );
              })}
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
