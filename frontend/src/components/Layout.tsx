import { useState } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import type { NavLinkRenderProps } from "react-router-dom";
import { Menu, Search, X } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { SearchOverlay } from "./SearchOverlay";
import { Footer } from "./Footer";
import { BrandLogo } from "./BrandLogo";

const NAV_ITEMS = [
  { to: "/", label: "Nyumbani", end: true },
  { to: "/about", label: "Kuhusu Sisi", end: false },
  { to: "/contact", label: "Wasiliana Nasi", end: false },
];

function navLinkClass({ isActive }: NavLinkRenderProps) {
  return `border-b-2 pb-1 text-sm font-semibold transition ${
    isActive
      ? "border-brand-accent text-brand-accent dark:text-white"
      : "border-transparent text-ink-muted hover:text-brand-accent dark:hover:text-white"
  }`;
}

function mobileNavLinkClass({ isActive }: NavLinkRenderProps) {
  return `rounded-lg px-3 py-2 text-sm font-semibold transition ${
    isActive
      ? "bg-brand-accent/10 text-brand-accent dark:text-white"
      : "text-ink-muted hover:bg-surface-hover hover:text-brand-accent dark:hover:text-white"
  }`;
}

export function Layout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-page">
      <header className="sticky top-0 z-30 border-b border-line bg-page/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-4 py-4 sm:px-6">
          <Link to="/" className="flex flex-col items-center gap-0.5 leading-none">
            <BrandLogo />
            <span className="text-sm font-extrabold tracking-wide text-ink">
              BEAUTY
            </span>
          </Link>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                className={navLinkClass}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-label="Tafuta"
              className="rounded-full border border-line p-2 text-ink-muted transition hover:border-brand-accent/50 hover:text-brand-accent"
            >
              <Search size={18} />
            </button>
            <ThemeToggle />
            <button
              type="button"
              onClick={() => setMobileNavOpen((v) => !v)}
              aria-label={mobileNavOpen ? "Funga menyu" : "Fungua menyu"}
              aria-expanded={mobileNavOpen}
              className="rounded-full border border-line p-2 text-ink-muted transition hover:border-brand-accent/50 hover:text-brand-accent md:hidden"
            >
              {mobileNavOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {mobileNavOpen && (
          <nav className="flex flex-col gap-1 border-t border-line px-4 py-3 md:hidden">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.label}
                to={item.to}
                end={item.end}
                onClick={() => setMobileNavOpen(false)}
                className={mobileNavLinkClass}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />

      {searchOpen && <SearchOverlay onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
