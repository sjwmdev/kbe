import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { FolderPlus, Loader2, UploadCloud } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  ApiError,
  createMediaFolder,
  fetchMediaFolders,
  uploadErrorMessage,
  uploadMediaAsset,
} from "../../lib/api";
import type { MediaFolder } from "../../types/media";
import { MediaGrid } from "../../components/admin/MediaGrid";

export function MediaLibraryPage() {
  const { token, logout, hasPermission } = useAuth();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const canUpload = hasPermission("media.upload");
  const canDelete = hasPermission("media.delete");

  function loadFolders() {
    if (!token) return;
    fetchMediaFolders(token)
      .then(setFolders)
      .catch(() => toast.error("Imeshindwa kupakia folda."));
  }

  useEffect(() => {
    loadFolders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !token) return;

    setUploading(true);
    setUploadProgress(0);

    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(0);
        await uploadMediaAsset(token, files[i], currentFolderId, setUploadProgress);
      }
      toast.success(files.length > 1 ? "Picha zimepakiwa." : "Picha imepakiwa.");
      setRefreshToken((n) => n + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
        logout();
        return;
      }
      toast.error(uploadErrorMessage(err) ?? "Imeshindwa kupakia picha. Jaribu tena.");
    } finally {
      setUploading(false);
    }
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    void handleFiles(e.target.files);
    e.target.value = "";
  }

  async function handleCreateFolder() {
    if (!token || !newFolderName.trim()) return;

    try {
      await createMediaFolder(token, newFolderName.trim());
      toast.success("Folda imeundwa.");
      setNewFolderName("");
      setCreatingFolder(false);
      loadFolders();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Imeshindwa kuunda folda.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Media</h1>
          <p className="text-ink-muted">
            Simamia picha zote zinazoweza kutumika kwenye bidhaa na slaidi.
          </p>
        </div>

        {canUpload && (
          <div className="flex items-center gap-3">
            {creatingFolder ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  autoFocus
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleCreateFolder();
                    if (e.key === "Escape") setCreatingFolder(false);
                  }}
                  placeholder="Jina la Folda"
                  className="rounded-full border border-line bg-surface-hover px-4 py-2 text-sm text-ink outline-none focus:border-brand-accent"
                />
                <button
                  type="button"
                  onClick={() => void handleCreateFolder()}
                  className="rounded-full bg-brand-accent px-4 py-2 text-sm font-bold text-white hover:bg-brand-accent-dark"
                >
                  Hifadhi
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreatingFolder(false);
                    setNewFolderName("");
                  }}
                  className="text-sm font-semibold text-ink-muted hover:text-ink"
                >
                  Ghairi
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreatingFolder(true)}
                className="flex items-center gap-2 rounded-full border border-line px-4 py-2.5 text-sm font-semibold text-ink transition hover:border-brand-accent hover:text-brand-accent"
              >
                <FolderPlus size={16} /> Ongeza Folda
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <UploadCloud size={16} />
              )}
              {uploading ? `Inapakia... ${uploadProgress}%` : "Pakia Picha"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileInputChange}
              className="hidden"
            />
          </div>
        )}
      </div>

      {token && (
        <MediaGrid
          token={token}
          selectionMode="browse"
          canDelete={canDelete}
          folders={folders}
          currentFolderId={currentFolderId}
          onFolderChange={setCurrentFolderId}
          refreshToken={refreshToken}
          onFoldersChanged={loadFolders}
        />
      )}
    </div>
  );
}
