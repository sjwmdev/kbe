import { useRef, useState } from "react";
import type { ChangeEvent, DragEvent } from "react";
import { FolderOpen, Loader2, UploadCloud, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import {
  ApiError,
  deleteProductImage,
  fetchProduct,
  resolveMediaUrl,
  uploadErrorMessage,
  uploadProductImage,
} from "../../lib/api";
import type { Product } from "../../types/product";
import type { MediaAsset } from "../../types/media";
import { ImageLightbox } from "../ImageLightbox";
import { ImageCropModal } from "./ImageCropModal";
import { MediaPickerModal } from "./MediaPickerModal";

// Matches the aspect-square main image container on the customer product page,
// so a crop confirmed with the default ratio fits with zero further cropping.
const FRONTEND_MAIN_IMAGE_ASPECT = 1;

interface ProductImageManagerProps {
  productId: string;
  product: Product;
  onProductChange: (product: Product) => void;
}

// Everything to do with a product's photo gallery — upload (from disk or the
// Media Library), crop, delete, and full-size preview — split out of
// ProductFormPage, which only needs to render this and hand it the current
// product plus a way to hear about updates.
export function ProductImageManager({
  productId,
  product,
  onProductChange,
}: ProductImageManagerProps) {
  const { token, logout } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [cropSource, setCropSource] = useState<{
    url: string;
    name: string;
  } | null>(null);
  const cropResolverRef = useRef<((file: File | null) => void) | null>(null);
  const [showMediaPicker, setShowMediaPicker] = useState(false);

  // Shows the crop modal for a single file and resolves with the cropped
  // result once the admin confirms, or null if they cancel that file.
  function requestCrop(file: File): Promise<File | null> {
    return new Promise((resolve) => {
      cropResolverRef.current = resolve;
      setCropSource({ url: URL.createObjectURL(file), name: file.name });
    });
  }

  function settleCrop(result: File | null) {
    cropResolverRef.current?.(result);
    cropResolverRef.current = null;
    if (cropSource) URL.revokeObjectURL(cropSource.url);
    setCropSource(null);
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || !token) return;

    setUploading(true);
    setUploadProgress(0);
    const hasExistingImages = product.images.length > 0;
    let uploadedAny = false;

    try {
      for (let i = 0; i < files.length; i++) {
        const cropped = await requestCrop(files[i]);
        if (!cropped) continue;

        setUploadProgress(0);
        const isPrimary = !hasExistingImages && !uploadedAny;
        await uploadProductImage(token, productId, cropped, isPrimary, setUploadProgress);
        uploadedAny = true;
      }

      if (uploadedAny) {
        const refreshed = await fetchProduct(productId);
        onProductChange(refreshed);
        toast.success(
          files.length > 1 ? "Picha zimepakiwa." : "Picha imepakiwa.",
        );
      }
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

  async function handleDeleteImage(imageId: string) {
    if (!token) return;
    const confirmed = await confirm({
      title: "Ondoa Picha",
      message: "Una uhakika unataka kuondoa picha hii?",
      confirmLabel: "Ondoa",
    });
    if (!confirmed) return;

    setDeletingImageId(imageId);
    try {
      const refreshed = await toast.promise(
        deleteProductImage(token, imageId).then(() => fetchProduct(productId)),
        {
          loading: "Inaondoa picha...",
          success: "Picha imeondolewa.",
          error: (err) =>
            err instanceof ApiError && err.status === 401
              ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
              : "Imeshindwa kuondoa picha.",
        },
      );
      onProductChange(refreshed);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        logout();
      }
    } finally {
      setDeletingImageId(null);
    }
  }

  // Picking an image from the Media Library still goes through the same
  // crop step as a fresh upload from disk — the library keeps the original,
  // uncropped master, and cropping only ever happens at the point of use
  // (here, or via handleFiles above), never to the stored asset itself.
  async function handleImportFromMedia(asset: MediaAsset) {
    setShowMediaPicker(false);
    if (!token) return;

    try {
      const response = await fetch(resolveMediaUrl(asset.image_url));
      if (!response.ok) throw new Error("failed to fetch media asset");
      const blob = await response.blob();
      const file = new File(
        [blob],
        asset.original_filename || "media-image.jpg",
        { type: blob.type || "image/jpeg" },
      );

      const cropped = await requestCrop(file);
      if (!cropped) return;

      const isPrimary = product.images.length === 0;
      setUploading(true);
      setUploadProgress(0);
      await uploadProductImage(
        token,
        productId,
        cropped,
        isPrimary,
        setUploadProgress,
        asset.id,
      );

      const refreshed = await fetchProduct(productId);
      onProductChange(refreshed);
      toast.success("Picha imeagizwa kutoka Media.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
        logout();
        return;
      }
      toast.error(uploadErrorMessage(err) ?? "Imeshindwa kuagiza picha.");
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    void handleFiles(e.dataTransfer.files);
  }

  function handleFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    void handleFiles(e.target.files);
    e.target.value = "";
  }

  return (
    <div>
      <h2 className="mb-3 text-lg font-bold text-ink">Picha za Bidhaa</h2>

      {product.images.length > 0 && (
        <div className="mb-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
          {product.images.map((img, index) => (
            <div
              key={img.id}
              className="relative aspect-square overflow-hidden rounded-lg border border-line bg-surface-hover"
            >
              <button
                type="button"
                onClick={() => setLightboxIndex(index)}
                aria-label="Ona picha kamili"
                className="h-full w-full"
              >
                <img
                  src={resolveMediaUrl(img.image_url)}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              </button>

              {img.is_primary && (
                <span className="pointer-events-none absolute left-1 top-1 rounded bg-brand-accent px-1.5 py-0.5 text-[0.6rem] font-bold text-white">
                  KUU
                </span>
              )}

              <button
                type="button"
                onClick={() => void handleDeleteImage(img.id)}
                disabled={deletingImageId === img.id}
                aria-label="Futa picha"
                className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white transition hover:bg-brand-accent disabled:opacity-50"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-8 text-center transition ${
          isDragging ? "border-brand-accent bg-brand-accent/10" : "border-line"
        }`}
      >
        {uploading ? (
          <Loader2 className="animate-spin text-brand-accent" size={28} />
        ) : (
          <UploadCloud className="text-ink-muted" size={28} />
        )}
        <p className="text-sm text-ink-muted">
          {uploading
            ? `Inapakia picha... ${uploadProgress}%`
            : "Bofya au buruta picha hapa kuzipakia"}
        </p>
        {uploading && (
          <div className="h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-hover">
            <div
              className="h-full rounded-full bg-brand-accent transition-[width] duration-150 ease-out"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>

      <button
        type="button"
        onClick={() => setShowMediaPicker(true)}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-line py-3 text-sm font-semibold text-ink transition hover:border-brand-accent hover:text-brand-accent"
      >
        <FolderOpen size={16} /> Agiza kutoka Media
      </button>

      {showMediaPicker && (
        <MediaPickerModal
          onSelect={(asset) => void handleImportFromMedia(asset)}
          onClose={() => setShowMediaPicker(false)}
        />
      )}

      {lightboxIndex !== null && (
        <ImageLightbox
          images={product.images.map((img) => resolveMediaUrl(img.image_url))}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}

      {cropSource && (
        <ImageCropModal
          imageUrl={cropSource.url}
          fileName={cropSource.name}
          defaultAspect={FRONTEND_MAIN_IMAGE_ASPECT}
          onConfirm={(file) => settleCrop(file)}
          onCancel={() => settleCrop(null)}
        />
      )}
    </div>
  );
}
