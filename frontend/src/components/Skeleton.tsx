interface SkeletonProps {
  className?: string;
}

/** Base pulsing placeholder block — compose into layout-specific skeletons below. */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-surface-hover ${className}`}
    />
  );
}

/** Matches ProductCard.tsx's layout: square image + category/name/price rows. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col border border-line bg-surface">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="flex flex-1 flex-col gap-2 p-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-4 w-full" />
        <div className="mt-auto flex items-center justify-between border-t border-line pt-2">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** A grid of product-card skeletons, for list/related-product loading states. */
export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Matches ImageGallery.tsx: a large main image + a row of thumbnail squares. */
export function ImageGallerySkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-16 shrink-0 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** Matches the admin products table's row layout (thumbnail + 4 text columns). */
export function TableRowSkeleton() {
  return (
    <tr>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg" />
          <Skeleton className="h-4 w-32" />
        </div>
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-20" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-16" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-6 w-20 rounded-full" />
      </td>
      <td className="px-4 py-3">
        <Skeleton className="h-4 w-12" />
      </td>
    </tr>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <TableRowSkeleton key={i} />
      ))}
    </>
  );
}

/** Matches SlidersPage.tsx's PosterRow layout: wide thumbnail + field row. */
export function SliderRowSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-4 sm:flex-row sm:items-center">
      <Skeleton className="h-20 w-full shrink-0 rounded-lg sm:w-36" />
      <div className="flex flex-1 gap-3">
        <Skeleton className="h-14 w-24" />
        <Skeleton className="h-14 w-16" />
      </div>
      <Skeleton className="h-9 w-24 rounded-full" />
    </div>
  );
}

/** Matches StaticPagesPage.tsx's PageCard layout: title input + textarea + button. */
export function PageCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-11 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-9 w-24 rounded-full" />
    </div>
  );
}
