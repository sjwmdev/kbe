import { useEffect, useState } from "react";
import { fetchPage } from "../lib/api";
import type { StaticPage } from "../types/content";
import { StaticPageBody } from "../components/StaticPageBody";

export function AboutPage() {
  const [page, setPage] = useState<StaticPage | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchPage("about")
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
      <span className="text-xs font-semibold uppercase tracking-widest text-brand-accent">
        Kuhusu Sisi
      </span>
      <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl">
        {page?.title ?? "Kalour Beauty Empire"}
      </h1>

      {page && (
        <div className="mt-6">
          <StaticPageBody body={page.body} />
        </div>
      )}
    </div>
  );
}
