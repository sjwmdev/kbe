import { Link } from "react-router-dom";
import type { MouseEvent } from "react";
import { Heart, MessageCircle } from "lucide-react";
import type { Product } from "../types/product";
import { resolveMediaUrl } from "../lib/api";
import { formatPrice } from "../lib/format";
import { buildWhatsAppLink } from "../lib/whatsapp";
import { ImagePlaceholder } from "./ImagePlaceholder";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  const primaryImage =
    product.images.find((img) => img.is_primary) ?? product.images[0];
  const isLiked = product.like_count > 0;
  const outOfStock = product.stock_status === "out_of_stock";

  function handleWhatsAppClick(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    window.open(buildWhatsAppLink(product.name), "_blank", "noopener,noreferrer");
  }

  return (
    <Link
      to={`/products/${product.id}`}
      className="group flex flex-col border border-line bg-surface transition hover:shadow-[0_10px_30px_rgba(0,0,0,0.05)]"
    >
      <div className="relative aspect-square w-full shrink-0 bg-surface-hover">
        {primaryImage ? (
          <img
            src={resolveMediaUrl(primaryImage.image_url)}
            alt={product.name}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        ) : (
          <ImagePlaceholder iconSize={28} />
        )}

        <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-surface/90 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-sm">
          <Heart
            size={12}
            className={isLiked ? "fill-brand-accent text-brand-accent" : "text-ink-muted"}
          />
          {product.like_count}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-brand-accent">
          {product.category}
        </span>
        <h3 className="line-clamp-2 text-left text-sm font-normal leading-snug text-ink-muted">
          {product.name}
        </h3>
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-base font-bold leading-none text-ink">
            {formatPrice(product.price)}
          </span>
          {outOfStock ? (
            <span
              aria-label="Bidhaa imeisha stoo"
              title="Bidhaa imeisha stoo"
              className="flex h-8 w-8 shrink-0 cursor-not-allowed items-center justify-center rounded-full border border-line text-ink-muted opacity-40"
            >
              <MessageCircle size={16} />
            </span>
          ) : (
            <button
              type="button"
              onClick={handleWhatsAppClick}
              aria-label={`Wasiliana kwa WhatsApp kuhusu ${product.name}`}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-ink-muted transition hover:border-brand-accent hover:bg-brand-accent hover:text-white"
            >
              <MessageCircle size={16} />
            </button>
          )}
        </div>
      </div>
    </Link>
  );
}
