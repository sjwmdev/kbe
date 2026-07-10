import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { fetchPage } from "../lib/api";
import type { StaticPage } from "../types/content";
import { StaticPageBody } from "../components/StaticPageBody";

export function PrivacyPage() {
  const [page, setPage] = useState<StaticPage | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPage("privacy")
      .then((data) => {
        if (!cancelled) setPage(data);
      })
      .catch(() => {
        // Page failing to load just leaves the section empty below the title.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
        {page?.title ?? "Faragha Yako Inatuhusu"}
      </h1>
      <p className="mt-4 text-sm text-ink-muted">
        Ilisasishwa: {new Date().getFullYear()}
      </p>

      {page && (
        <div className="mt-8">
          <StaticPageBody body={page.body} />
        </div>
      )}

      <div className="mt-10 rounded-xl border border-line bg-surface p-8 text-center">
        <span className="mx-auto mb-3 flex items-center justify-center text-icon">
          <ShieldCheck size={26} />
        </span>
        <h2 className="mb-2 text-lg font-bold text-ink">
          Maswali Kuhusu Faragha Yako?
        </h2>
        <p className="mx-auto mb-5 max-w-md text-sm leading-relaxed text-ink-muted">
          Ikiwa una maswali yoyote kuhusu sera yetu ya faragha au jinsi
          tunavyoshughulikia data zako, tafadhali wasiliana nasi.
        </p>
        <Link
          to="/contact"
          className="inline-block rounded-full bg-brand-accent px-6 py-3 text-sm font-bold text-white transition hover:bg-brand-accent-dark"
        >
          Wasiliana Nasi
        </Link>
      </div>
    </div>
  );
}
