import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { fetchMediaFolders } from "../../lib/api";
import type { MediaAsset, MediaFolder } from "../../types/media";
import { MediaGrid } from "./MediaGrid";

interface MediaPickerModalProps {
  onSelect: (asset: MediaAsset) => void;
  onClose: () => void;
}

// Reuses MediaGrid in picker mode: click an asset to highlight it, then
// confirm with "Chagua" — mirrors an existing library asset being reused
// without re-uploading, for the Product Form's "Agiza kutoka Media" flow.
export function MediaPickerModal({ onSelect, onClose }: MediaPickerModalProps) {
  const { token } = useAuth();
  const toast = useToast();

  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [picked, setPicked] = useState<MediaAsset | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchMediaFolders(token)
      .then(setFolders)
      .catch(() => toast.error("Imeshindwa kupakia folda."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-black/50 p-4 animate-[modal-backdrop-in_0.15s_ease-out]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl animate-[modal-pop-in_0.2s_cubic-bezier(0.34,1.56,0.64,1)]"
      >
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="text-lg font-bold text-ink">Agiza kutoka Media</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Funga"
            className="text-ink-muted hover:text-ink"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {token && (
            <MediaGrid
              token={token}
              selectionMode="picker"
              folders={folders}
              currentFolderId={currentFolderId}
              onFolderChange={setCurrentFolderId}
              refreshToken={0}
              pickedAssetId={picked?.id ?? null}
              onPickAsset={setPicked}
            />
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-line p-5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-surface-hover hover:text-ink"
          >
            Ghairi
          </button>
          <button
            type="button"
            onClick={() => picked && onSelect(picked)}
            disabled={!picked}
            className="rounded-full bg-brand-accent px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
          >
            Chagua
          </button>
        </div>
      </div>
    </div>
  );
}
