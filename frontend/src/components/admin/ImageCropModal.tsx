import { useCallback, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { Check, X } from "lucide-react";
import { getCroppedImageFile } from "../../lib/cropImage";

interface ImageCropModalProps {
  imageUrl: string;
  fileName: string;
  defaultAspect: number;
  onConfirm: (file: File) => void;
  onCancel: () => void;
}

const ASPECT_OPTIONS = [
  { label: "Mraba 1:1", value: 1 },
  { label: "Wima 3:4", value: 3 / 4 },
  { label: "Hadithi 9:16", value: 9 / 16 },
  { label: "Mlalo 4:3", value: 4 / 3 },
  { label: "Skrini Pana 16:9", value: 16 / 9 },
  { label: "Skrini Pana 21:9", value: 21 / 9 },
];

export function ImageCropModal({
  imageUrl,
  fileName,
  defaultAspect,
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(defaultAspect);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(
    null,
  );
  const [processing, setProcessing] = useState(false);

  const handleCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleConfirm() {
    if (!croppedAreaPixels) return;
    setProcessing(true);
    try {
      const file = await getCroppedImageFile(
        imageUrl,
        croppedAreaPixels,
        fileName,
      );
      onConfirm(file);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-black/95 p-4 sm:p-8">
      <div className="flex items-center justify-between pb-4">
        <h2 className="text-lg font-bold text-white">Kata Picha</h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Funga"
          className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
        >
          <X size={20} />
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl bg-black">
        <Cropper
          image={imageUrl}
          crop={crop}
          zoom={zoom}
          aspect={aspect}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={handleCropComplete}
        />
      </div>

      <div className="flex flex-col gap-4 pt-4">
        <div className="flex flex-wrap justify-center gap-2">
          {ASPECT_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => setAspect(opt.value)}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                aspect === opt.value
                  ? "border-brand-accent bg-brand-accent text-white"
                  : "border-white/15 text-white/70 hover:border-brand-accent/60"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-3 text-white/70">
          <span className="text-sm">Kuza</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="flex-1 accent-brand-accent"
          />
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-full border border-white/15 py-3 font-semibold text-white/80 hover:bg-white/5"
          >
            Ghairi
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={processing || !croppedAreaPixels}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-brand-accent py-3 font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
          >
            <Check size={18} />
            {processing ? "Inatayarisha..." : "Tumia Picha"}
          </button>
        </div>
      </div>
    </div>
  );
}
