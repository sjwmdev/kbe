import { useEffect, useState } from "react";
import { Mail, MapPin, MessageCircle } from "lucide-react";
import {
  buildGeneralWhatsAppLink,
  formatBusinessNumber,
} from "../lib/whatsapp";
import { fetchPage } from "../lib/api";
import { useSettings } from "../context/SettingsContext";
import type { StaticPage } from "../types/content";

export function ContactPage() {
  const settings = useSettings();
  const [page, setPage] = useState<StaticPage | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPage("contact")
      .then((data) => {
        if (!cancelled) setPage(data);
      })
      .catch(() => {
        // Falls back to no intro paragraph; the contact block below still works.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <span className="text-xs font-semibold uppercase tracking-widest text-brand-accent">
        Wasiliana Nasi
      </span>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
        {page?.title ?? "Tuko Tayari Kukusaidia"}
      </h1>
      {page?.body && (
        <p className="mt-4 max-w-xl leading-relaxed text-ink-muted">
          {page.body}
        </p>
      )}

      <div className="mt-8 flex flex-col gap-4 rounded-xl border border-line bg-surface p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center text-icon">
            <MapPin size={20} />
          </span>
          <span className="text-ink">{settings.contact_address}</span>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center text-icon">
            <MessageCircle size={20} />
          </span>
          <a
            href={buildGeneralWhatsAppLink()}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink hover:text-brand-accent"
          >
            {formatBusinessNumber()}
          </a>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center text-icon">
            <Mail size={20} />
          </span>
          <a
            href={`mailto:${settings.contact_email}`}
            className="text-ink hover:text-brand-accent"
          >
            {settings.contact_email}
          </a>
        </div>

        <a
          href={buildGeneralWhatsAppLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex items-center justify-center gap-2 rounded-full bg-brand-accent px-6 py-4 text-base font-bold text-white shadow-lg shadow-brand-accent/30 transition hover:bg-brand-accent-dark"
        >
          <MessageCircle size={20} />
          Wasiliana Nasi kwa WhatsApp
        </a>
      </div>
    </div>
  );
}
