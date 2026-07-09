import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, MapPin, MessageCircle } from "lucide-react";
import {
  buildGeneralWhatsAppLink,
  formatBusinessNumber,
} from "../lib/whatsapp";
import { fetchCategories } from "../lib/api";
import type { Category } from "../types/product";
import { useSettings } from "../context/SettingsContext";
import { BrandLogo } from "./BrandLogo";

function InstagramIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function FacebookIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

const LEGAL_LINKS = [
  { to: "/about", label: "Kuhusu Sisi" },
  { to: "/contact", label: "Wasiliana Nasi" },
  { to: "/privacy", label: "Sera ya Faragha" },
  { to: "/terms", label: "Vigezo na Masharti" },
];

export function Footer() {
  const settings = useSettings();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchCategories()
      .then((data) => {
        if (!cancelled) setCategories(data);
      })
      .catch(() => {
        // Quick links just fall back to "Home" only — not worth an error UI.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const quickLinks = [
    { to: "/", label: "Nyumbani" },
    ...categories.map((c) => ({ to: `/?category_id=${c.id}`, label: c.name })),
  ];

  return (
    <footer className="border-t border-line px-4 py-12 sm:px-6">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <Link to="/" className="flex w-fit flex-col items-center gap-0.5 leading-none">
            <BrandLogo />
            <span className="text-sm font-extrabold tracking-wide text-ink">
              {settings.company_name}
            </span>
          </Link>
          <p className="mt-3 text-sm text-ink-muted">
            Manukato, vipodozi na viatu vya kifahari kutoka Zanzibar hadi
            kwako.
          </p>
          <div className="mt-4 flex items-center gap-3">
            {settings.instagram_url && (
              <a
                href={settings.instagram_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="rounded-full border border-line p-2 text-ink-muted transition hover:border-brand-accent/50 hover:text-brand-accent"
              >
                <InstagramIcon />
              </a>
            )}
            {settings.facebook_url && (
              <a
                href={settings.facebook_url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="rounded-full border border-line p-2 text-ink-muted transition hover:border-brand-accent/50 hover:text-brand-accent"
              >
                <FacebookIcon />
              </a>
            )}
            <a
              href={buildGeneralWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="rounded-full border border-line p-2 text-ink-muted transition hover:border-brand-accent/50 hover:text-brand-accent"
            >
              <MessageCircle size={18} />
            </a>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Viungo</h3>
          <ul className="flex flex-col gap-2">
            {quickLinks.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  className="text-sm text-ink-muted transition hover:text-brand-accent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Taarifa</h3>
          <ul className="flex flex-col gap-2">
            {LEGAL_LINKS.map((item) => (
              <li key={item.label}>
                <Link
                  to={item.to}
                  className="text-sm text-ink-muted transition hover:text-brand-accent"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-3 text-sm font-semibold text-ink">Mawasiliano</h3>
          <ul className="flex flex-col gap-3">
            <li className="flex items-start gap-2 text-sm text-ink-muted">
              <MapPin size={16} className="mt-0.5 shrink-0" />
              {settings.contact_address}
            </li>
            <li className="flex items-start gap-2 text-sm text-ink-muted">
              <MessageCircle size={16} className="mt-0.5 shrink-0" />
              <a
                href={buildGeneralWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-brand-accent"
              >
                {formatBusinessNumber()}
              </a>
            </li>
            <li className="flex items-start gap-2 text-sm text-ink-muted">
              <Mail size={16} className="mt-0.5 shrink-0" />
              <a
                href={`mailto:${settings.contact_email}`}
                className="break-all hover:text-brand-accent"
              >
                {settings.contact_email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-line pt-6 text-center text-xs text-ink-muted">
        &copy; {new Date().getFullYear()} {settings.company_name}. Haki zote
        zimehifadhiwa.
      </div>
    </footer>
  );
}
