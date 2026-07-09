import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { ApiError, fetchAdminPages, updatePage } from "../../lib/api";
import type { StaticPage, StaticPageSlug } from "../../types/content";
import { PageCardSkeleton } from "../../components/Skeleton";

const PAGE_LABELS: Record<StaticPageSlug, string> = {
  about: "Kuhusu Sisi",
  contact: "Wasiliana Nasi",
  privacy: "Sera ya Faragha",
  terms: "Vigezo na Masharti",
};

const SLUG_ORDER: StaticPageSlug[] = ["about", "contact", "privacy", "terms"];

function PageCard({
  page,
  token,
  onSaved,
}: {
  page: StaticPage;
  token: string;
  onSaved: (page: StaticPage) => void;
}) {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission("pages.edit");
  const [title, setTitle] = useState(page.title);
  const [body, setBody] = useState(page.body);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const saved = await updatePage(token, page.slug, { title, body });
      onSaved(saved);
      toast.success(`"${PAGE_LABELS[page.slug]}" imehifadhiwa.`);
    } catch {
      toast.error("Imeshindwa kuhifadhi ukurasa.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6"
    >
      <h2 className="text-lg font-bold text-ink">{PAGE_LABELS[page.slug]}</h2>

      <label className="block">
        <span className="mb-1 block text-sm text-ink-muted">Kichwa</span>
        <input
          type="text"
          required
          disabled={!canEdit}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent disabled:opacity-60"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-sm text-ink-muted">
          Maudhui (tumia "## Kichwa" kwa vichwa vidogo)
        </span>
        <textarea
          rows={10}
          disabled={!canEdit}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 font-mono text-sm text-ink outline-none focus:border-brand-accent disabled:opacity-60"
        />
      </label>

      {canEdit && (
        <button
          type="submit"
          disabled={saving}
          className="self-start rounded-full bg-brand-accent px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
        >
          {saving ? "Inahifadhi..." : "Hifadhi"}
        </button>
      )}
    </form>
  );
}

export function StaticPagesPage() {
  const { token, logout } = useAuth();
  const toast = useToast();
  const [pages, setPages] = useState<StaticPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    fetchAdminPages(token)
      .then((data) => {
        if (!cancelled) setPages(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
          logout();
          return;
        }
        toast.error("Imeshindwa kupakia kurasa.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, logout, toast]);

  function handleSaved(saved: StaticPage) {
    setPages((prev) => prev.map((p) => (p.slug === saved.slug ? saved : p)));
  }

  const orderedPages = SLUG_ORDER.map((slug) =>
    pages.find((p) => p.slug === slug),
  ).filter((p): p is StaticPage => Boolean(p));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Kurasa Tuli</h1>
        <p className="text-ink-muted">
          Hariri maudhui ya kurasa za Kuhusu Sisi, Wasiliana Nasi, Sera ya
          Faragha, na Vigezo na Masharti.
        </p>
      </div>

      {loading && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <PageCardSkeleton key={i} />
          ))}
        </div>
      )}

      {!loading && token && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {orderedPages.map((page) => (
            <PageCard
              key={page.slug}
              page={page}
              token={token}
              onSaved={handleSaved}
            />
          ))}
        </div>
      )}
    </div>
  );
}
