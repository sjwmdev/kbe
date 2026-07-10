import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Plus, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import {
  ApiError,
  createCategory,
  deleteCategory,
  fetchAdminCategories,
  updateCategory,
} from "../../lib/api";
import type { CategoryInput } from "../../lib/api";
import type { Category } from "../../types/product";
import { Skeleton } from "../../components/Skeleton";
import { ActionMenu, type ActionMenuItem } from "../../components/admin/ActionMenu";

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

interface CategoryFormPanelProps {
  category: Category | null;
  nextDisplayOrder: number;
  onClose: () => void;
  onSaved: (category: Category) => void;
}

function CategoryFormPanel({
  category,
  nextDisplayOrder,
  onClose,
  onSaved,
}: CategoryFormPanelProps) {
  const { token, logout } = useAuth();
  const toast = useToast();
  const isEditMode = Boolean(category);

  const [name, setName] = useState(category?.name ?? "");
  const [slug, setSlug] = useState(category?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEditMode);
  const [displayOrder, setDisplayOrder] = useState(
    category?.display_order ?? nextDisplayOrder,
  );
  const [saving, setSaving] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    const input: CategoryInput = { name, slug, display_order: displayOrder };

    setSaving(true);
    try {
      const saved = await toast.promise(
        isEditMode
          ? updateCategory(token, category!.id, input)
          : createCategory(token, input),
        {
          loading: isEditMode ? "Inahifadhi kategoria..." : "Inaongeza kategoria...",
          success: isEditMode ? "Kategoria imehifadhiwa." : "Kategoria imeongezwa.",
          error: (err) =>
            err instanceof ApiError && err.status === 401
              ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
              : "Imeshindwa kuhifadhi kategoria.",
        },
      );
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 animate-[modal-backdrop-in_0.15s_ease-out]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl animate-[modal-pop-in_0.2s_cubic-bezier(0.34,1.56,0.64,1)]"
      >
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="text-lg font-bold text-ink">
            {isEditMode ? "Hariri Kategoria" : "Ongeza Kategoria Mpya"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Funga"
            className="text-ink-muted hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
          <label className="block">
            <span className="mb-1 block text-sm text-ink-muted">Jina</span>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface-hover px-4 py-2.5 text-ink outline-none focus:border-brand-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-ink-muted">
              Slug (herufi ndogo, namba, na "-" pekee)
            </span>
            <input
              type="text"
              required
              pattern="[a-z0-9-]+"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
              className="w-full rounded-lg border border-line bg-surface-hover px-4 py-2.5 font-mono text-sm text-ink outline-none focus:border-brand-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-ink-muted">Mpangilio</span>
            <input
              type="number"
              value={displayOrder}
              onChange={(e) => setDisplayOrder(Number(e.target.value))}
              className="w-full rounded-lg border border-line bg-surface-hover px-4 py-2.5 text-ink outline-none focus:border-brand-accent"
            />
          </label>

          <div className="mt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-surface-hover hover:text-ink"
            >
              Ghairi
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-full bg-brand-accent px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
            >
              {saving ? "Inahifadhi..." : "Hifadhi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CategoriesPage() {
  const { token, logout, hasPermission } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [panelCategory, setPanelCategory] = useState<Category | null | undefined>(
    undefined,
  );

  useEffect(() => {
    loadCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function loadCategories() {
    if (!token) return;
    setLoading(true);
    fetchAdminCategories(token)
      .then(setCategories)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
          logout();
          return;
        }
        toast.error("Imeshindwa kupakia kategoria.");
      })
      .finally(() => setLoading(false));
  }

  async function handleDelete(category: Category) {
    if (!token) return;
    const confirmed = await confirm({
      title: "Futa Kategoria",
      message: `Una uhakika unataka kufuta kategoria "${category.name}"? Hii itashindwa endapo bado kuna bidhaa zinazotumia kategoria hii.`,
      confirmLabel: "Futa",
    });
    if (!confirmed) return;

    setDeletingId(category.id);
    try {
      await toast.promise(deleteCategory(token, category.id), {
        loading: "Inafuta kategoria...",
        success: `"${category.name}" imefutwa.`,
        error: (err) =>
          err instanceof ApiError && err.status === 401
            ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
            : err instanceof ApiError
              ? err.message
              : "Imeshindwa kufuta kategoria.",
      });
      setCategories((prev) => prev.filter((c) => c.id !== category.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(saved: Category) {
    setCategories((prev) => {
      const exists = prev.some((c) => c.id === saved.id);
      return exists
        ? prev.map((c) => (c.id === saved.id ? saved : c))
        : [...prev, saved].sort((a, b) => a.display_order - b.display_order);
    });
    setPanelCategory(undefined);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Kategoria</h1>
          <p className="text-ink-muted">
            Simamia makundi ya bidhaa yanayoonekana kwenye tovuti.
          </p>
        </div>
        {hasPermission("categories.create") && (
          <button
            type="button"
            onClick={() => setPanelCategory(null)}
            className="flex items-center gap-2 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark"
          >
            <Plus size={16} /> Ongeza Kategoria
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Jina</th>
              <th className="px-4 py-3 font-semibold">Slug</th>
              <th className="px-4 py-3 font-semibold">Mpangilio</th>
              <th className="px-4 py-3 font-semibold">Vitendo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-10" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-12" />
                  </td>
                </tr>
              ))}
            {!loading &&
              categories.map((category) => (
                <tr key={category.id} className="text-ink">
                  <td className="px-4 py-3 font-medium">{category.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">
                    {category.slug}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {category.display_order}
                  </td>
                  <td className="px-4 py-3">
                    <ActionMenu
                      items={(
                        [
                          hasPermission("categories.edit") && {
                            label: "Hariri",
                            onClick: () => setPanelCategory(category),
                          },
                          hasPermission("categories.delete") && {
                            label: "Futa",
                            onClick: () => void handleDelete(category),
                            disabled: deletingId === category.id,
                            danger: true,
                          },
                        ] as (ActionMenuItem | false)[]
                      ).filter((item): item is ActionMenuItem => Boolean(item))}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && categories.length === 0 && (
        <p className="text-ink-muted">Bado hakuna kategoria zilizoongezwa.</p>
      )}

      {panelCategory !== undefined && (
        <CategoryFormPanel
          category={panelCategory}
          nextDisplayOrder={categories.length}
          onClose={() => setPanelCategory(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
