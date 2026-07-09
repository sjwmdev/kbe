import { useState } from "react";
import { Trash2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { deleteSlider, resolveMediaUrl, updateSlider } from "../../lib/api";
import type { Category } from "../../types/product";
import type { SliderPoster } from "../../types/content";

interface SliderPosterRowProps {
  poster: SliderPoster;
  token: string;
  categories: Category[];
  onSaved: (poster: SliderPoster) => void;
  onDeleted: (id: string) => void;
}

// A single editable slider-poster row — its own image, category/order/active
// fields, and save/delete actions — split out of SlidersPage since it's a
// fully self-contained unit with no need to share state with its siblings.
export function SliderPosterRow({
  poster,
  token,
  categories,
  onSaved,
  onDeleted,
}: SliderPosterRowProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const { hasPermission } = useAuth();
  const [linkCategory, setLinkCategory] = useState(poster.link_category);
  const [displayOrder, setDisplayOrder] = useState(poster.display_order);
  const [isActive, setIsActive] = useState(poster.is_active);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const saved = await updateSlider(token, poster.id, {
        image_url: poster.image_url,
        link_category: linkCategory,
        display_order: displayOrder,
        is_active: isActive,
      });
      onSaved(saved);
      toast.success("Slaidi imehifadhiwa.");
    } catch {
      toast.error("Imeshindwa kuhifadhi slaidi.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = await confirm({
      title: "Futa Slaidi",
      message: "Una uhakika unataka kufuta slaidi hii? Hatua hii haiwezi kutenduliwa.",
      confirmLabel: "Futa",
    });
    if (!confirmed) return;
    setDeleting(true);
    try {
      await toast.promise(deleteSlider(token, poster.id), {
        loading: "Inafuta slaidi...",
        success: "Slaidi imefutwa.",
        error: "Imeshindwa kufuta slaidi.",
      });
      onDeleted(poster.id);
    } catch {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
      <img
        src={resolveMediaUrl(poster.image_url)}
        alt=""
        className="h-20 w-full shrink-0 rounded-lg object-cover sm:w-36"
      />

      <div className="flex flex-1 flex-wrap items-center gap-3">
        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Kategoria
          <select
            value={linkCategory}
            onChange={(e) => setLinkCategory(e.target.value)}
            className="rounded-lg border border-line bg-surface-hover px-3 py-2 text-sm text-ink outline-none focus:border-brand-accent"
          >
            <option value="">Hakuna (Nyumbani)</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.slug} className="bg-surface">
                {cat.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-ink-muted">
          Mpangilio
          <input
            type="number"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(Number(e.target.value))}
            className="w-20 rounded-lg border border-line bg-surface-hover px-3 py-2 text-sm text-ink outline-none focus:border-brand-accent"
          />
        </label>

        <label className="flex items-center gap-2 self-end pb-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 accent-brand-accent"
          />
          Inaonekana
        </label>
      </div>

      <div className="flex items-center gap-2 sm:self-center">
        {hasPermission("sliders.edit") && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-full bg-brand-accent px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
          >
            {saving ? "..." : "Hifadhi"}
          </button>
        )}
        {hasPermission("sliders.delete") && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            aria-label="Futa"
            className="rounded-full border border-line p-2.5 text-ink-muted transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-60"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
