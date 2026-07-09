import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { fetchProducts, resolveMediaUrl } from "../lib/api";
import type { Product } from "../types/product";
import { formatPrice } from "../lib/format";
import { ImagePlaceholder } from "./ImagePlaceholder";

interface SearchOverlayProps {
  onClose: () => void;
}

export function SearchOverlay({ onClose }: SearchOverlayProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    // Search-as-you-type needs the whole catalog to match against, not one
    // page of it — 100 is the server's max page size (see parsePagination).
    fetchProducts(undefined, 1, 100)
      .then((data) => {
        if (!cancelled) setProducts(data.products);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const q = query.trim().toLowerCase();
  const results = q
    ? products.filter((p) => p.name.toLowerCase().includes(q))
    : [];

  function goToProduct(id: string) {
    onClose();
    navigate(`/products/${id}`);
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 pt-20 backdrop-blur-sm sm:pt-28"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <Search size={18} className="shrink-0 text-ink-muted" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tafuta bidhaa..."
            className="flex-1 bg-transparent text-ink outline-none placeholder:text-ink-muted"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Funga"
            className="shrink-0 text-ink-muted hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {!q && (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">
              Anza kuandika kutafuta bidhaa.
            </p>
          )}

          {q && loading && (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">
              Inapakia...
            </p>
          )}

          {q && !loading && results.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-ink-muted">
              Hakuna bidhaa iliyopatikana kwa &quot;{query}&quot;.
            </p>
          )}

          {q && !loading && results.length > 0 && (
            <ul className="divide-y divide-line">
              {results.map((product) => {
                const primaryImage =
                  product.images.find((img) => img.is_primary) ??
                  product.images[0];
                return (
                  <li key={product.id}>
                    <button
                      type="button"
                      onClick={() => goToProduct(product.id)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-surface-hover"
                    >
                      <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg bg-surface-hover">
                        {primaryImage ? (
                          <img
                            src={resolveMediaUrl(primaryImage.image_url)}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ImagePlaceholder iconSize={16} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {product.name}
                        </p>
                        <p className="text-xs text-ink-muted">
                          {formatPrice(product.price)}
                        </p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
