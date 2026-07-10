import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { ApiError, createOrder, fetchAdminProducts } from "../../lib/api";
import type { OrderItemInput } from "../../lib/api";
import type { Product } from "../../types/product";
import { formatPrice } from "../../lib/format";

interface LineItem {
  productId: string;
  quantity: number;
}

const EMPTY_LINE: LineItem = { productId: "", quantity: 1 };

export function OrderFormPage() {
  const { token, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [items, setItems] = useState<LineItem[]>([{ ...EMPTY_LINE }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    // page_size=100 (the server's max) — this form needs the seller's whole
    // catalog to choose from, not one page of it.
    fetchAdminProducts(token, 1, 100)
      .then((data) => {
        if (!cancelled) setProducts(data.products.filter((p) => p.is_active));
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
        if (!cancelled) setLoadingProducts(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, logout, toast]);

  const productById = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(p.id, p));
    return map;
  }, [products]);

  const total = items.reduce((sum, item) => {
    const product = productById.get(item.productId);
    return sum + (product ? product.price * item.quantity : 0);
  }, 0);

  function updateItem(index: number, patch: Partial<LineItem>) {
    setItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, ...patch } : item)),
    );
  }

  function addItem() {
    setItems((prev) => [...prev, { ...EMPTY_LINE }]);
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;

    const orderItems: OrderItemInput[] = items
      .filter((item) => item.productId && item.quantity > 0)
      .map((item) => ({ product_id: item.productId, quantity: item.quantity }));

    if (orderItems.length === 0) {
      toast.error("Ongeza angalau bidhaa moja.");
      return;
    }

    setSaving(true);
    try {
      await createOrder(token, {
        customer_name: customerName,
        customer_phone: customerPhone,
        items: orderItems,
      });
      toast.success("Oda imerekodiwa.");
      navigate("/admin/orders", { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
        logout();
        return;
      }
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Imeshindwa kurekodi oda. Hakikisha taarifa zote ziko sahihi.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingProducts) {
    return <p className="text-ink-muted">Inapakia...</p>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <h1 className="text-2xl font-extrabold text-ink">Rekodi Oda Mpya</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm text-ink-muted">
              Jina la Mteja
            </span>
            <input
              type="text"
              required
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-ink-muted">
              Namba ya Simu
            </span>
            <input
              type="tel"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="255700000000"
              className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
            />
          </label>
        </div>

        <div className="flex flex-col gap-3">
          <span className="text-sm text-ink-muted">Bidhaa</span>

          {items.map((item, index) => {
            const product = productById.get(item.productId);
            const subtotal = product ? product.price * item.quantity : 0;
            return (
              <div
                key={index}
                className="flex flex-col gap-3 rounded-lg border border-line p-3 sm:flex-row sm:items-center"
              >
                <select
                  required
                  value={item.productId}
                  onChange={(e) =>
                    updateItem(index, { productId: e.target.value })
                  }
                  className="w-full flex-1 rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
                >
                  <option value="" className="bg-surface">
                    Chagua bidhaa...
                  </option>
                  {products.map((p) => (
                    <option
                      key={p.id}
                      value={p.id}
                      disabled={p.stock_quantity <= 0}
                      className="bg-surface"
                    >
                      {p.name} ({formatPrice(p.price)}) — Stoo:{" "}
                      {p.stock_quantity <= 0 ? "Imeisha" : p.stock_quantity}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  required
                  min={1}
                  max={product?.stock_quantity ?? undefined}
                  value={item.quantity}
                  onChange={(e) =>
                    updateItem(index, { quantity: Number(e.target.value) })
                  }
                  className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent sm:w-24"
                />

                <span className="w-full text-right text-sm font-semibold text-ink sm:w-32">
                  {formatPrice(subtotal)}
                </span>

                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={items.length === 1}
                  aria-label="Ondoa bidhaa"
                  className="text-ink-muted hover:text-brand-accent disabled:opacity-30"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-2 self-start rounded-full border border-line px-4 py-2 text-sm font-semibold text-ink-muted transition hover:border-brand-accent hover:text-brand-accent"
          >
            <Plus size={16} /> Ongeza Bidhaa
          </button>
        </div>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <span className="text-sm font-semibold text-ink-muted">Jumla</span>
          <span className="text-xl font-extrabold text-ink">
            {formatPrice(total)}
          </span>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-brand-accent py-3 font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
        >
          {saving ? "Inahifadhi..." : "Hifadhi Oda"}
        </button>
      </form>
    </div>
  );
}
