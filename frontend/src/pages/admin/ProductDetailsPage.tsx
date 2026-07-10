import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Package, ShoppingCart, Wallet } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { ApiError, fetchAdminProductDetail, resolveMediaUrl } from "../../lib/api";
import type { ProductDetail } from "../../types/product";
import {
  PRODUCT_COLORS,
  STOCK_STATUS_LABELS,
  STOCK_STATUS_TONE,
} from "../../types/product";
import { formatPrice } from "../../lib/format";
import { StatusBadge } from "../../components/StatusBadge";
import { ImagePlaceholder } from "../../components/ImagePlaceholder";

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("sw-TZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function SummaryCard({
  label,
  icon,
  value,
}: {
  label: string;
  icon: ReactNode;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-widest text-ink-muted">
          {label}
        </span>
        {icon}
      </div>
      <p className="text-2xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

export function ProductDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const { token, logout } = useAuth();
  const toast = useToast();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token || !id) return;
    let cancelled = false;

    fetchAdminProductDetail(token, id)
      .then((data) => {
        if (!cancelled) setProduct(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
          logout();
          return;
        }
        if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
          setNotFound(true);
          return;
        }
        toast.error("Imeshindwa kupakia taarifa za bidhaa.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, id, logout, toast]);

  if (loading) {
    return <p className="text-ink-muted">Inapakia...</p>;
  }

  if (notFound || !product) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ink-muted">Bidhaa hii haipatikani.</p>
        <Link
          to="/admin/products"
          className="inline-flex w-fit items-center gap-2 text-sm font-semibold text-brand-accent hover:underline"
        >
          <ArrowLeft size={16} /> Rudi kwenye Bidhaa
        </Link>
      </div>
    );
  }

  const primaryImage =
    product.images.find((img) => img.is_primary) ?? product.images[0];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to="/admin/products"
          className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-ink-muted hover:text-brand-accent"
        >
          <ArrowLeft size={16} /> Rudi kwenye Bidhaa
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold text-ink">{product.name}</h1>
          <StatusBadge tone={product.is_active ? "success" : "neutral"}>
            {product.is_active ? "Inaonekana" : "Imefichwa"}
          </StatusBadge>
        </div>
        <p className="text-ink-muted">Taarifa za bidhaa (kusoma tu).</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Bei"
          icon={<Wallet size={20} className="text-icon" />}
          value={formatPrice(product.price)}
        />
        <SummaryCard
          label="Oda Zilizouza"
          icon={<ShoppingCart size={20} className="text-icon" />}
          value={`${product.order_summary.units_sold} (${formatPrice(product.order_summary.revenue)})`}
        />
        <SummaryCard
          label="Anayopenda"
          icon={<Heart size={20} className="text-icon" />}
          value={String(product.like_count)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <div className="aspect-square w-full overflow-hidden rounded-xl border border-line shadow-card bg-surface-hover">
            {primaryImage ? (
              <img
                src={resolveMediaUrl(primaryImage.image_url)}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <ImagePlaceholder iconSize={32} />
            )}
          </div>
          {product.images.length > 1 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {product.images.map((img) => (
                <div
                  key={img.id}
                  className="aspect-square overflow-hidden rounded-lg border border-line bg-surface-hover"
                >
                  <img
                    src={resolveMediaUrl(img.image_url)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-6 lg:col-span-2">
          <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
            <h2 className="mb-4 text-lg font-bold text-ink">Taarifa za Bidhaa</h2>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Kategoria
                </dt>
                <dd className="text-ink">{product.category}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Hali ya Stoo
                </dt>
                <dd>
                  <StatusBadge tone={STOCK_STATUS_TONE[product.stock_status]}>
                    {STOCK_STATUS_LABELS[product.stock_status]} ({product.stock_quantity})
                  </StatusBadge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Kiwango cha Chini cha Stoo
                </dt>
                <dd className="text-ink">{product.low_stock_threshold}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Rangi
                </dt>
                <dd className="flex flex-wrap gap-2">
                  {product.colors.length === 0 ? (
                    <span className="text-ink">—</span>
                  ) : (
                    product.colors.map((name) => {
                      const hex = PRODUCT_COLORS.find((c) => c.name === name)?.hex;
                      return (
                        <span
                          key={name}
                          className="flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-xs text-ink"
                        >
                          {hex && (
                            <span
                              className="h-3 w-3 rounded-full border border-line"
                              style={{ backgroundColor: hex }}
                            />
                          )}
                          {name}
                        </span>
                      );
                    })
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Iliundwa Na
                </dt>
                <dd className="text-ink">{product.created_by_name || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Iliundwa
                </dt>
                <dd className="text-ink">{formatDateTime(product.created_at)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Ilisasishwa Mwisho
                </dt>
                <dd className="text-ink">{formatDateTime(product.updated_at)}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-ink">
              <Package size={18} className="text-icon" /> Maelezo
            </h2>
            {product.description ? (
              // Server-sanitized HTML (see backend's SanitizeDescriptionHTML)
              // — safe to render directly, never raw user input.
              <div
                className="leading-relaxed text-ink-muted [&_a]:text-brand-accent [&_a]:underline [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_li]:ml-5 [&_ol]:list-decimal [&_ul]:list-disc"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            ) : (
              <p className="text-ink-muted">Hakuna maelezo.</p>
            )}
          </div>

          <div className="rounded-xl border border-line bg-surface p-6 shadow-card">
            <h2 className="mb-4 text-lg font-bold text-ink">Muhtasari wa Oda</h2>
            <dl className="grid grid-cols-3 gap-4 text-center">
              <div>
                <dt className="text-xs text-ink-muted">Idadi ya Oda</dt>
                <dd className="text-xl font-bold text-ink">
                  {product.order_summary.order_count}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Vitengo Vilivyouzwa</dt>
                <dd className="text-xl font-bold text-ink">
                  {product.order_summary.units_sold}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-muted">Mapato Yote</dt>
                <dd className="text-xl font-bold text-ink">
                  {formatPrice(product.order_summary.revenue)}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
