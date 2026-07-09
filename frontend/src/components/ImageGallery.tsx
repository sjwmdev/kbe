import { useRef, useState } from "react";
import type { TouchEvent } from "react";
import { Maximize2 } from "lucide-react";
import type { ProductImage } from "../types/product";
import { resolveMediaUrl } from "../lib/api";
import { ImageLightbox } from "./ImageLightbox";
import { ImagePlaceholder } from "./ImagePlaceholder";

interface ImageGalleryProps {
  images: ProductImage[];
  productName: string;
}

export function ImageGallery({ images, productName }: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  if (images.length === 0) {
    return (
      <div className="aspect-square w-full rounded-2xl border border-dashed border-line bg-surface-hover">
        <ImagePlaceholder />
      </div>
    );
  }

  function goTo(index: number) {
    setActiveIndex((index + images.length) % images.length);
  }

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    touchStartX.current = e.touches[0].clientX;
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    if (Math.abs(deltaX) > 50) {
      goTo(activeIndex + (deltaX < 0 ? 1 : -1));
    }
    touchStartX.current = null;
  }

  const activeImage = images[activeIndex];

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {/* Thumbnail rail: horizontal row on mobile, vertical column on desktop.
          Hovering a thumbnail previews it in the main viewer, like Amazon/Alibaba. */}
      {images.length > 1 && (
        <div className="no-scrollbar order-2 flex gap-2 overflow-x-auto sm:order-1 sm:max-h-[520px] sm:w-20 sm:flex-shrink-0 sm:flex-col sm:overflow-x-visible sm:overflow-y-auto">
          {images.map((img, index) => (
            <button
              key={img.id}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => setActiveIndex(index)}
              aria-label={`Ona picha ${index + 1}`}
              className={`aspect-square h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border-2 bg-surface-hover transition sm:h-auto sm:w-full ${
                index === activeIndex
                  ? "border-brand-accent"
                  : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              <img
                src={resolveMediaUrl(img.image_url)}
                alt={`${productName} - kidole gumba ${index + 1}`}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Main viewer: images are pre-cropped by the admin to this exact
          aspect-square ratio, so object-cover fills the frame with zero
          empty space. Click opens the full, uncropped lightbox. */}
      <div
        className="group relative order-1 aspect-square w-full flex-1 cursor-zoom-in overflow-hidden rounded-2xl bg-surface-hover sm:order-2"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onClick={() => setLightboxOpen(true)}
      >
        <img
          src={resolveMediaUrl(activeImage.image_url)}
          alt={`${productName} - picha ${activeIndex + 1}`}
          // The main product photo is almost always this page's LCP element.
          fetchPriority="high"
          decoding="async"
          className="h-full w-full object-cover"
        />

        <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/50 p-2 text-white opacity-0 transition group-hover:opacity-100">
          <Maximize2 size={18} />
        </div>
      </div>

      {lightboxOpen && (
        <ImageLightbox
          images={images.map((img) => resolveMediaUrl(img.image_url))}
          initialIndex={activeIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
