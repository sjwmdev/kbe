import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { fetchCategories, fetchProducts } from "../lib/api";
import type { ProductFilter } from "../lib/api";
import type { Category, Product } from "../types/product";
import { ProductCard } from "../components/ProductCard";
import { HeroSlider } from "../components/home/HeroSlider";
import { CategorySidebar } from "../components/home/CategorySidebar";
import { TrustBadges } from "../components/home/TrustBadges";
import { ProductGridSkeleton } from "../components/Skeleton";

type CategoryFilter = "all" | string;

const PAGE_SIZE = 24;

export function ProductListPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [color, setColor] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<{ min: string; max: string }>({
    min: "",
    max: "",
  });
  // The header nav links to /?category_id=<uuid>, so the URL is the single
  // source of truth shared between the header and this sidebar.
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFilter: CategoryFilter = searchParams.get("category_id") ?? "all";

  function handleCategoryChange(value: CategoryFilter) {
    setSearchParams(value === "all" ? {} : { category_id: value });
  }

  const minPrice = priceRange.min.trim() ? Number(priceRange.min) : undefined;
  const maxPrice = priceRange.max.trim() ? Number(priceRange.max) : undefined;
  const priceRangeInvalid =
    minPrice != null && maxPrice != null && minPrice > maxPrice;

  const filter: ProductFilter = {
    categoryId: categoryFilter === "all" ? undefined : categoryFilter,
    color: color ?? undefined,
    minPrice,
    maxPrice,
  };
  // A stable string key so the fetch effect only re-runs when a filter value
  // actually changes, not on every render (filter is a fresh object each time).
  const filterKey = JSON.stringify(filter);

  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch(() => {
        // The sidebar just shows "All" if categories fail to load — not
        // worth a second error banner on top of the product-fetch one.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Filtering happens server-side now (the catalog can grow past what's
  // reasonable to filter client-side), so any filter change means a fresh
  // page-1 fetch rather than re-slicing an already-loaded array.
  useEffect(() => {
    if (priceRangeInvalid) {
      setLoading(false);
      setProducts([]);
      setTotal(0);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchProducts(filter, 1, PAGE_SIZE)
      .then((data) => {
        if (cancelled) return;
        setProducts(data.products);
        setTotal(data.total);
        setPage(1);
      })
      .catch(() => {
        if (!cancelled) setError("Imeshindwa kupakia bidhaa. Jaribu tena baadaye.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, priceRangeInvalid]);

  function handleLoadMore() {
    const nextPage = page + 1;
    setLoadingMore(true);
    fetchProducts(filter, nextPage, PAGE_SIZE)
      .then((data) => {
        setProducts((prev) => [...prev, ...data.products]);
        setTotal(data.total);
        setPage(nextPage);
      })
      .catch(() => {
        setError("Imeshindwa kupakia bidhaa zaidi. Jaribu tena.");
      })
      .finally(() => setLoadingMore(false));
  }

  const hasMore = products.length < total;

  return (
    <div className="pb-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 pt-6 sm:px-6 sm:pt-10 lg:flex-row lg:items-start">
        <CategorySidebar
          categories={categories}
          value={categoryFilter}
          onChange={handleCategoryChange}
          color={color}
          onColorChange={setColor}
          priceRange={priceRange}
          onPriceRangeChange={setPriceRange}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-10 sm:gap-14">
          <HeroSlider categories={categories} />

          <TrustBadges />

          <div>
            <h2
              id="bidhaa"
              className="mb-6 scroll-mt-24 text-lg font-bold text-ink"
            >
              Bidhaa Zote
            </h2>

            {loading && <ProductGridSkeleton />}

            {priceRangeInvalid && !loading && (
              <p className="py-20 text-center text-ink-muted">
                Bei ya chini haiwezi kuwa kubwa kuliko bei ya juu.
              </p>
            )}

            {error && !loading && (
              <p className="py-20 text-center text-brand-accent">{error}</p>
            )}

            {!loading && !error && !priceRangeInvalid && products.length === 0 && (
              <p className="py-20 text-center text-ink-muted">
                Hakuna bidhaa kwenye kundi hili kwa sasa.
              </p>
            )}

            {!loading && !error && products.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
                  {products.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {hasMore && (
                  <div className="mt-8 flex justify-center">
                    <button
                      type="button"
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="flex items-center gap-2 rounded-full border border-line px-8 py-3 text-sm font-semibold text-ink transition hover:border-brand-accent hover:text-brand-accent disabled:opacity-60"
                    >
                      {loadingMore && (
                        <Loader2 size={16} className="animate-spin" />
                      )}
                      {loadingMore ? "Inapakia..." : "Onyesha Zaidi"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
