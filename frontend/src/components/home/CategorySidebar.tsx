import { Headset, LayoutGrid, Tag } from "lucide-react";
import type { Category } from "../../types/product";
import { buildGeneralWhatsAppLink } from "../../lib/whatsapp";

type CategoryFilter = "all" | string;

interface CategorySidebarProps {
  categories: Category[];
  value: CategoryFilter;
  onChange: (value: CategoryFilter) => void;
}

const COLOR_SWATCHES = ["#000000", "#ffffff", "#b80049", "#c9a876", "#4b5563"];
const SHOE_SIZES = ["38", "39", "40", "41", "42", "43", "44"];

function ComingSoonTag() {
  return (
    <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
      Hivi Karibuni
    </span>
  );
}

// Paired with the whole main content column (hero + grid), the standard
// Amazon/Alibaba category-rail layout.
export function CategorySidebar({ categories, value, onChange }: CategorySidebarProps) {
  return (
    <aside className="hidden shrink-0 lg:block lg:w-64">
      <div className="sticky top-24 flex flex-col gap-4">
        <div className="rounded-sm border border-line bg-surface p-4">
          <h3 className="mb-3 px-2 text-sm font-bold text-ink">
            Nunua kwa Aina
          </h3>
          <nav className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => onChange("all")}
              aria-current={value === "all"}
              className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-left text-sm font-semibold transition ${
                value === "all"
                  ? "bg-brand-accent/10 text-brand-accent"
                  : "text-ink-muted hover:bg-surface-hover hover:text-ink"
              }`}
            >
              <LayoutGrid size={18} className="dark:text-white" />
              Zote
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => onChange(category.id)}
                aria-current={value === category.id}
                className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-left text-sm font-semibold transition ${
                  value === category.id
                    ? "bg-brand-accent/10 text-brand-accent"
                    : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                }`}
              >
                <Tag size={18} className="dark:text-white" />
                {category.name}
              </button>
            ))}
          </nav>
        </div>

        {/* Placeholder filters — not wired to real data yet (no price-range,
            color, or size attributes exist on products today). Shown
            disabled with a "Coming Soon" tag rather than silently doing
            nothing when touched. */}
        <div className="rounded-sm border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between px-2">
            <h3 className="text-sm font-bold text-ink">Kiwango cha Bei</h3>
            <ComingSoonTag />
          </div>
          <div className="px-2">
            <input
              type="range"
              disabled
              className="w-full cursor-not-allowed accent-brand-accent opacity-50"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-ink-muted">
              <span>TSh 0</span>
              <span>TSh 500,000+</span>
            </div>
          </div>
        </div>

        <div className="rounded-sm border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between px-2">
            <h3 className="text-sm font-bold text-ink">Rangi</h3>
            <ComingSoonTag />
          </div>
          <div className="flex flex-wrap gap-2 px-2">
            {COLOR_SWATCHES.map((color) => (
              <button
                key={color}
                type="button"
                disabled
                aria-label={color}
                style={{ backgroundColor: color }}
                className="h-6 w-6 cursor-not-allowed rounded-full border border-line opacity-50"
              />
            ))}
          </div>
        </div>

        <div className="rounded-sm border border-line bg-surface p-4">
          <div className="mb-3 flex items-center justify-between px-2">
            <h3 className="text-sm font-bold text-ink">Saizi</h3>
            <ComingSoonTag />
          </div>
          <div className="flex flex-wrap gap-2 px-2">
            {SHOE_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                disabled
                className="flex h-8 w-8 cursor-not-allowed items-center justify-center rounded border border-line text-xs font-semibold text-ink-muted opacity-50"
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-sm border border-line bg-surface p-5 text-center">
          <span className="mx-auto mb-2 flex items-center justify-center text-icon">
            <Headset size={24} />
          </span>
          <p className="text-sm font-bold text-ink">Need Help?</p>
          <p className="mb-3 text-xs text-ink-muted">
            Chat with us on WhatsApp
          </p>
          <a
            href={buildGeneralWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg bg-brand-accent py-2 text-sm font-bold text-white transition hover:bg-brand-accent-dark"
          >
            Chat Now
          </a>
        </div>
      </div>
    </aside>
  );
}
