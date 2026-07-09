import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { ApiError, fetchProduct, fetchProducts } from "../lib/api";
import type { Product } from "../types/product";
import { formatPrice } from "../lib/format";
import { ImageGallery } from "../components/ImageGallery";
import { LikeButton } from "../components/LikeButton";
import { WhatsAppButton } from "../components/WhatsAppButton";
import { ProductCard } from "../components/ProductCard";
import { ImageGallerySkeleton, Skeleton } from "../components/Skeleton";

const RELATED_COUNT = 4;

export function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allProducts, setAllProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchProduct(id)
      .then((data) => {
        if (!cancelled) setProduct(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setError("Bidhaa hii haipatikani.");
        } else {
          setError("Imeshindwa kupakia bidhaa. Jaribu tena baadaye.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;
    // Related products are matched client-side by category below, so this
    // needs a broad slice of the catalog, not one page of it — 100 is the
    // server's max page size (see parsePagination).
    fetchProducts(undefined, 1, 100)
      .then((data) => {
        if (!cancelled) setAllProducts(data.products);
      })
      .catch(() => {
        // Related products are a bonus section — fail silently and just
        // don't show it, no need to surface a second error on this page.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    return allProducts
      .filter((p) => p.category_id === product.category_id && p.id !== product.id)
      .slice(0, RELATED_COUNT);
  }, [allProducts, product]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <Skeleton className="mb-6 h-4 w-48" />
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          <ImageGallerySkeleton />
          <div className="flex flex-col gap-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-7 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="mt-4 h-12 w-full rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <p className="text-brand-accent">{error ?? "Bidhaa hii haipatikani."}</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 text-ink-muted hover:text-ink"
        >
          <ArrowLeft size={18} /> Rudi kwenye bidhaa zote
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav aria-label="Njia" className="mb-6 flex items-center gap-1.5 text-sm text-ink-muted">
        <Link to="/" className="flex items-center gap-1.5 hover:text-brand-accent">
          <ArrowLeft size={14} className="sm:hidden" />
          Nyumbani
        </Link>
        <ChevronRight size={14} className="hidden sm:block" />
        <Link
          to={`/?category_id=${product.category_id}`}
          className="hidden hover:text-brand-accent sm:block"
        >
          {product.category}
        </Link>
        <ChevronRight size={14} className="hidden sm:block" />
        <span className="hidden truncate font-semibold text-ink sm:block">
          {product.name}
        </span>
      </nav>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
        <ImageGallery images={product.images} productName={product.name} />

        <div className="flex flex-col gap-4">
          <span className="text-xs font-semibold uppercase tracking-widest text-brand-accent">
            {product.category}
          </span>
          <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
            {product.name}
          </h1>

          <div className="flex items-center justify-between gap-4">
            <p className="text-2xl font-extrabold text-ink">
              {formatPrice(product.price)}
            </p>
            <LikeButton productId={product.id} initialCount={product.like_count} />
          </div>

          {product.description && (
            <p className="whitespace-pre-line leading-relaxed text-ink-muted">
              {product.description}
            </p>
          )}

          <div className="mt-4">
            <WhatsAppButton productName={product.name} />
          </div>
        </div>
      </div>

      {relatedProducts.length > 0 && (
        <div className="mt-16">
          <h2 className="mb-6 text-lg font-bold text-ink">Bidhaa Zinazofanana</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
            {relatedProducts.map((related) => (
              <ProductCard key={related.id} product={related} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
