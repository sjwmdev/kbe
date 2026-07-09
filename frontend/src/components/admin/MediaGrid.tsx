import { useEffect, useState } from "react";
import type { MouseEvent } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Folder,
  FolderPlus,
  Trash2,
  X,
} from "lucide-react";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import {
  ApiError,
  bulkDeleteMediaAssets,
  deleteMediaFolder,
  fetchMediaAssets,
  moveMediaAssets,
  resolveMediaUrl,
} from "../../lib/api";
import type { MediaAsset, MediaFolder } from "../../types/media";
import { Skeleton } from "../Skeleton";
import { ImagePlaceholder } from "../ImagePlaceholder";
import { ImageLightbox } from "../ImageLightbox";

const PAGE_SIZE = 24;

interface MediaGridProps {
  token: string;
  selectionMode: "browse" | "picker";
  /** Browse mode only — hides checkboxes/hover-delete/folder-delete for callers without media.delete. */
  canDelete?: boolean;
  folders: MediaFolder[];
  currentFolderId: string | null;
  onFolderChange: (folderId: string | null) => void;
  refreshToken: number;
  onFoldersChanged?: () => void;
  // picker mode only
  pickedAssetId?: string | null;
  onPickAsset?: (asset: MediaAsset) => void;
}

export function MediaGrid({
  token,
  selectionMode,
  canDelete = true,
  folders,
  currentFolderId,
  onFolderChange,
  refreshToken,
  onFoldersChanged,
  pickedAssetId,
  onPickAsset,
}: MediaGridProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const isBrowse = selectionMode === "browse";
  const showSelection = isBrowse && canDelete;

  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [movingTarget, setMovingTarget] = useState("");
  const [localNonce, setLocalNonce] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentFolder = folders.find((f) => f.id === currentFolderId) ?? null;

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [currentFolderId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetchMediaAssets(token, currentFolderId, page, PAGE_SIZE)
      .then((data) => {
        if (cancelled) return;
        setAssets(data.assets);
        setTotal(data.total);
      })
      .catch(() => {
        if (!cancelled) toast.error("Imeshindwa kupakia picha.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, currentFolderId, page, refreshToken, localNonce, toast]);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleDeleteSingle(asset: MediaAsset) {
    const confirmed = await confirm({
      title: "Futa Picha",
      message: `Una uhakika unataka kufuta picha hii?`,
      confirmLabel: "Futa",
    });
    if (!confirmed) return;

    try {
      const result = await bulkDeleteMediaAssets(token, [asset.id]);
      if (result.skipped_count > 0) {
        toast.error("Picha hii bado inatumika kwenye bidhaa/slaidi, haiwezi kufutwa.");
      } else {
        toast.success("Picha imefutwa.");
        setLocalNonce((n) => n + 1);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Imeshindwa kufuta picha.");
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    const confirmed = await confirm({
      title: "Futa Picha Zilizochaguliwa",
      message: `Una uhakika unataka kufuta picha ${ids.length}?`,
      confirmLabel: "Futa",
      tone: "plain",
    });
    if (!confirmed) return;

    try {
      const result = await bulkDeleteMediaAssets(token, ids);
      setSelectedIds(new Set());
      if (result.deleted_count > 0) setLocalNonce((n) => n + 1);
      if (result.skipped_count > 0) {
        toast.error(
          `${result.deleted_count} zimefutwa, ${result.skipped_count} bado zinatumika.`,
        );
      } else {
        toast.success(`${result.deleted_count} zimefutwa.`);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Imeshindwa kufuta picha.");
    }
  }

  async function handleMove() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    try {
      await moveMediaAssets(token, ids, movingTarget === "__root__" ? null : movingTarget);
      toast.success("Picha zimehamishwa.");
      setSelectedIds(new Set());
      setMovingTarget("");
      setLocalNonce((n) => n + 1);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Imeshindwa kuhamisha picha.");
    }
  }

  async function handleDeleteFolder(folder: MediaFolder, e: MouseEvent) {
    e.stopPropagation();
    const confirmed = await confirm({
      title: "Futa Folda",
      message: `Una uhakika unataka kufuta folda "${folder.name}"? Picha zilizomo hazitafutwa, zitahamia kwenye orodha kuu.`,
      confirmLabel: "Futa",
    });
    if (!confirmed) return;

    try {
      await deleteMediaFolder(token, folder.id);
      toast.success("Folda imefutwa.");
      onFoldersChanged?.();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Imeshindwa kufuta folda.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm text-ink-muted">
        <button
          type="button"
          onClick={() => onFolderChange(null)}
          className={`font-semibold ${!currentFolderId ? "text-ink" : "hover:text-brand-accent"}`}
        >
          Media
        </button>
        {currentFolder && (
          <>
            <span>/</span>
            <span className="font-semibold text-ink">{currentFolder.name}</span>
          </>
        )}
      </div>

      {!currentFolderId && folders.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {folders.map((folder) => (
            <button
              key={folder.id}
              type="button"
              onClick={() => onFolderChange(folder.id)}
              className="group relative flex flex-col items-center gap-2 rounded-xl border border-line bg-surface p-4 transition hover:border-brand-accent"
            >
              <Folder size={32} className="text-brand-accent" />
              <span className="line-clamp-1 text-xs font-semibold text-ink">
                {folder.name}
              </span>
              {showSelection && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => void handleDeleteFolder(folder, e)}
                  aria-label="Futa folda"
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition group-hover:opacity-100 hover:bg-brand-accent"
                >
                  <Trash2 size={12} />
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {showSelection && selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand-accent/40 bg-brand-accent/10 p-3">
          <span className="text-sm font-semibold text-ink">
            {selectedIds.size} zimechaguliwa
          </span>
          <select
            value={movingTarget}
            onChange={(e) => setMovingTarget(e.target.value)}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-brand-accent"
          >
            <option value="" disabled>
              Hamishia Folda...
            </option>
            {currentFolderId && <option value="__root__">(Bila Folda)</option>}
            {folders
              .filter((f) => f.id !== currentFolderId)
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => void handleMove()}
            disabled={!movingTarget}
            className="rounded-full border border-line px-4 py-1.5 text-sm font-semibold text-ink transition hover:border-brand-accent hover:text-brand-accent disabled:pointer-events-none disabled:opacity-40"
          >
            Hamisha
          </button>
          <button
            type="button"
            onClick={() => void handleBulkDelete()}
            className="rounded-full bg-brand-accent px-4 py-1.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark"
          >
            Futa ({selectedIds.size})
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="text-sm font-semibold text-ink-muted hover:text-ink"
          >
            Ghairi Uteuzi
          </button>
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square w-full rounded-xl" />
          ))}
        </div>
      ) : assets.length === 0 ? (
        <p className="py-8 text-center text-ink-muted">Hakuna picha hapa.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6">
          {assets.map((asset, index) => {
            const isSelected = selectedIds.has(asset.id);
            const isPicked = pickedAssetId === asset.id;
            return (
              <div
                key={asset.id}
                onClick={() => {
                  if (selectionMode === "picker") onPickAsset?.(asset);
                  else setLightboxIndex(index);
                }}
                className={`group relative aspect-square cursor-pointer overflow-hidden rounded-xl border bg-surface-hover transition ${
                  isSelected || isPicked
                    ? "border-brand-accent ring-2 ring-brand-accent"
                    : "border-line"
                }`}
              >
                {asset.image_url ? (
                  <img
                    src={resolveMediaUrl(asset.image_url)}
                    alt={asset.original_filename}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImagePlaceholder iconSize={24} />
                )}

                {showSelection && (
                  <>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(asset.id)}
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute left-2 top-2 h-4 w-4 accent-brand-accent transition-opacity ${
                        isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                      }`}
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteSingle(asset);
                      }}
                      aria-label="Futa picha"
                      className="absolute right-2 top-2 rounded-full bg-black/70 p-1 text-white opacity-0 transition group-hover:opacity-100 hover:bg-brand-accent"
                    >
                      <X size={14} />
                    </button>
                  </>
                )}

                {asset.in_use_count > 0 && (
                  <span className="pointer-events-none absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                    Inatumika
                  </span>
                )}
              </div>
            );
          })}
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

      {!currentFolderId && folders.length === 0 && !loading && assets.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <FolderPlus size={16} /> Anza kwa kupakia picha au kuunda folda.
        </p>
      )}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={assets.map((a) => resolveMediaUrl(a.image_url))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
