import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { UploadCloud } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  ApiError,
  createSlider,
  fetchAdminCategories,
  fetchAdminSliders,
  uploadErrorMessage,
  uploadSliderImage,
} from "../../lib/api";
import type { Category } from "../../types/product";
import type { SliderPoster } from "../../types/content";
import { ImageCropModal } from "../../components/admin/ImageCropModal";
import { SliderPosterRow } from "../../components/admin/SliderPosterRow";
import { SliderRowSkeleton } from "../../components/Skeleton";

// Matches the public HeroSlider's aspect-[21/9] banner shape.
const SLIDER_ASPECT = 21 / 9;

export function SlidersPage() {
  const { token, logout, hasPermission } = useAuth();
  const toast = useToast();
  const [posters, setPosters] = useState<SliderPoster[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cropSource, setCropSource] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(
    null,
  );
  const [newCategory, setNewCategory] = useState("");
  const [creating, setCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  function clearPending() {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    Promise.all([fetchAdminSliders(token), fetchAdminCategories(token)])
      .then(([sliders, cats]) => {
        if (cancelled) return;
        setPosters(sliders);
        setCategories(cats);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
          logout();
          return;
        }
        toast.error("Imeshindwa kupakia slaidi.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, logout, toast]);

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setCropSource({ url: URL.createObjectURL(file), name: file.name });
  }

  function handleCropConfirm(file: File) {
    if (cropSource) URL.revokeObjectURL(cropSource.url);
    setCropSource(null);
    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
  }

  function handleCropCancel() {
    if (cropSource) URL.revokeObjectURL(cropSource.url);
    setCropSource(null);
  }

  async function handleCreate() {
    if (!token || !pendingFile) return;

    setCreating(true);
    setUploadProgress(0);
    try {
      const { image_url } = await uploadSliderImage(
        token,
        pendingFile,
        setUploadProgress,
      );
      const created = await createSlider(token, {
        image_url,
        link_category: newCategory,
        display_order: posters.length,
        is_active: true,
      });
      setPosters((prev) => [...prev, created]);
      clearPending();
      setNewCategory("");
      toast.success("Slaidi mpya imeongezwa.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
        logout();
        return;
      }
      toast.error(uploadErrorMessage(err) ?? "Imeshindwa kuongeza slaidi.");
    } finally {
      setCreating(false);
    }
  }

  function handleSaved(saved: SliderPoster) {
    setPosters((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
  }

  function handleDeleted(id: string) {
    setPosters((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Slaidi za Nyumbani</h1>
        <p className="text-ink-muted">
          Simamia picha za slaidi zinazoonekana kwenye ukurasa wa nyumbani.
        </p>
      </div>

      {hasPermission("sliders.create") && (
      <div className="flex flex-col gap-4 rounded-xl border border-brand-accent/30 bg-brand-accent/5 p-6">
        <h2 className="text-lg font-bold text-ink">Ongeza Slaidi Mpya</h2>

        {!pendingFile ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-line bg-surface p-8 text-ink-muted transition hover:border-brand-accent hover:text-brand-accent"
          >
            <UploadCloud size={28} />
            <span className="text-sm font-semibold">
              Bofya kuchagua picha (skrini pana)
            </span>
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <img
              src={pendingPreviewUrl ?? undefined}
              alt=""
              className="h-20 w-36 rounded-lg object-cover"
            />
            <label className="flex flex-col gap-1 text-xs text-ink-muted">
              Kategoria
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
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
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="rounded-full bg-brand-accent px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
            >
              {creating ? `Inapakia... ${uploadProgress}%` : "Ongeza Slaidi"}
            </button>
            {creating && (
              <div className="h-1.5 w-full max-w-[10rem] overflow-hidden rounded-full bg-surface-hover">
                <div
                  className="h-full rounded-full bg-brand-accent transition-[width] duration-150 ease-out"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
            <button
              type="button"
              onClick={clearPending}
              disabled={creating}
              className="text-sm font-semibold text-ink-muted hover:text-brand-accent disabled:opacity-40"
            >
              Ghairi
            </button>
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>
      )}

      {loading && (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <SliderRowSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && posters.length === 0 && (
        <p className="text-ink-muted">Bado hakuna slaidi zilizoongezwa.</p>
      )}

      {!loading && token && posters.length > 0 && (
        <div className="flex flex-col gap-4">
          {posters.map((poster) => (
            <SliderPosterRow
              key={poster.id}
              poster={poster}
              token={token}
              categories={categories}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
            />
          ))}
        </div>
      )}

      {cropSource && (
        <ImageCropModal
          imageUrl={cropSource.url}
          fileName={cropSource.name}
          defaultAspect={SLIDER_ASPECT}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}
    </div>
  );
}
