import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  ApiError,
  createProduct,
  fetchAdminCategories,
  fetchProduct,
  updateProduct,
} from "../../lib/api";
import type { ProductInput } from "../../lib/api";
import { PRODUCT_COLORS, type Category, type Product } from "../../types/product";
import { ProductImageManager } from "../../components/admin/ProductImageManager";
import { RichTextEditor } from "../../components/admin/RichTextEditor";

const EMPTY_FORM: ProductInput = {
  name: "",
  description: "",
  price: 0,
  category_id: "",
  is_active: true,
  stock_quantity: 0,
  low_stock_threshold: 5,
  colors: [],
};

export function ProductFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const { token, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState<ProductInput>(EMPTY_FORM);
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(isEditMode);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    fetchAdminCategories(token)
      .then((data) => {
        if (cancelled) return;
        setCategories(data);
        setForm((f) =>
          f.category_id ? f : { ...f, category_id: data[0]?.id ?? "" },
        );
      })
      .catch(() => {
        if (!cancelled) toast.error("Imeshindwa kupakia kategoria.");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    fetchProduct(id)
      .then((data) => {
        if (cancelled) return;
        setProduct(data);
        setForm({
          name: data.name,
          description: data.description,
          price: data.price,
          category_id: data.category_id,
          is_active: data.is_active,
          stock_quantity: data.stock_quantity,
          low_stock_threshold: data.low_stock_threshold,
          colors: data.colors,
        });
      })
      .catch(() => {
        if (!cancelled) toast.error("Imeshindwa kupakia bidhaa hii.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;

    setSaving(true);

    try {
      if (id) {
        const updated = await updateProduct(token, id, form);
        setProduct(updated);
        toast.success("Mabadiliko yamehifadhiwa.");
      } else {
        const created = await createProduct(token, form);
        toast.success("Bidhaa imeongezwa.");
        navigate(`/admin/products/${created.id}/edit`, { replace: true });
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
        logout();
        return;
      }
      toast.error(
        "Imeshindwa kuhifadhi bidhaa. Hakikisha taarifa zote ziko sahihi.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-ink-muted">Inapakia...</p>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <h1 className="text-2xl font-extrabold text-ink">
        {isEditMode ? "Hariri Bidhaa" : "Ongeza Bidhaa Mpya"}
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">
            Jina la Bidhaa
          </span>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">Kategoria</span>
          <select
            value={form.category_id}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                category_id: e.target.value,
              }))
            }
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          >
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id} className="bg-surface">
                {cat.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">Bei (TSh)</span>
          <input
            type="number"
            required
            min={0}
            step="0.01"
            value={form.price}
            onChange={(e) =>
              setForm((f) => ({ ...f, price: Number(e.target.value) }))
            }
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          />
        </label>

        <div className="grid grid-cols-2 gap-5">
          <label className="block">
            <span className="mb-1 block text-sm text-ink-muted">
              Kiasi Stoo
            </span>
            <input
              type="number"
              required
              min={0}
              step="1"
              value={form.stock_quantity}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  stock_quantity: Number(e.target.value),
                }))
              }
              className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-ink-muted">
              Kiwango cha Chini
            </span>
            <input
              type="number"
              required
              min={0}
              step="1"
              value={form.low_stock_threshold}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  low_stock_threshold: Number(e.target.value),
                }))
              }
              className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
            />
          </label>
        </div>

        <div className="block">
          <span className="mb-2 block text-sm text-ink-muted">Rangi</span>
          <div className="flex flex-wrap gap-2">
            {PRODUCT_COLORS.map((c) => {
              const selected = form.colors.includes(c.name);
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      colors: selected
                        ? f.colors.filter((existing) => existing !== c.name)
                        : [...f.colors, c.name],
                    }))
                  }
                  aria-pressed={selected}
                  className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    selected
                      ? "border-brand-accent bg-brand-accent/10 text-brand-accent"
                      : "border-line text-ink-muted hover:border-brand-accent"
                  }`}
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-line"
                    style={{ backgroundColor: c.hex }}
                  />
                  {c.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="block">
          <span className="mb-1 block text-sm text-ink-muted">Maelezo</span>
          <RichTextEditor
            value={form.description}
            onChange={(html) => setForm((f) => ({ ...f, description: html }))}
          />
        </div>

        {isEditMode && (
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) =>
                setForm((f) => ({ ...f, is_active: e.target.checked }))
              }
              className="h-5 w-5 accent-brand-accent"
            />
            <span className="text-sm text-ink-muted">
              Bidhaa inaonekana kwa wateja
            </span>
          </label>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-full bg-brand-accent py-3 font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
        >
          {saving ? "Inahifadhi..." : "Hifadhi"}
        </button>
      </form>

      {isEditMode && product && (
        <ProductImageManager
          productId={product.id}
          product={product}
          onProductChange={setProduct}
        />
      )}
    </div>
  );
}
