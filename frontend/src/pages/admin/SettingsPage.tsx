import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { ApiError, fetchSettings, updateSettings } from "../../lib/api";
import type { SettingsInput } from "../../lib/api";

const EMPTY_FORM: SettingsInput = {
  whatsapp_number: "",
  contact_email: "",
  contact_address: "",
  instagram_url: "",
  facebook_url: "",
  company_name: "",
  logo_light_url: "",
  logo_dark_url: "",
  brand_accent_color: "#b80049",
  brand_accent_color_dark: "#8f003d",
};

export function SettingsPage() {
  const { token, logout, hasPermission } = useAuth();
  const canEdit = hasPermission("settings.edit");
  const toast = useToast();
  const [form, setForm] = useState<SettingsInput>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchSettings()
      .then((data) => {
        if (!cancelled) setForm(data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Imeshindwa kupakia mipangilio.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [toast]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    setSaving(true);
    try {
      const saved = await updateSettings(token, form);
      setForm(saved);
      toast.success("Mipangilio imehifadhiwa. Onyesha upya ukurasa kuona mabadiliko ya nembo/rangi kila mahali.");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
        logout();
        return;
      }
      toast.error("Imeshindwa kuhifadhi mipangilio.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-ink-muted">Inapakia...</p>;
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-extrabold text-ink">Mipangilio ya Tovuti</h1>
        <p className="text-ink-muted">
          Taarifa hizi zinaonekana kwenye ukurasa wa Wasiliana Nasi na
          sehemu ya chini ya tovuti (footer).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <fieldset disabled={!canEdit} className="flex flex-col gap-5 disabled:opacity-60">
        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">Jina la Biashara</span>
          <input
            type="text"
            required
            value={form.company_name}
            onChange={(e) =>
              setForm((f) => ({ ...f, company_name: e.target.value }))
            }
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          />
        </label>

        <div className="grid grid-cols-2 gap-5">
          <label className="block">
            <span className="mb-1 block text-sm text-ink-muted">
              Nembo (Mandhari Angavu)
            </span>
            <input
              type="text"
              placeholder="/uploads/logo-light.png"
              value={form.logo_light_url}
              onChange={(e) =>
                setForm((f) => ({ ...f, logo_light_url: e.target.value }))
              }
              className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-ink-muted">
              Nembo (Mandhari ya Giza)
            </span>
            <input
              type="text"
              placeholder="/uploads/logo-dark.png"
              value={form.logo_dark_url}
              onChange={(e) =>
                setForm((f) => ({ ...f, logo_dark_url: e.target.value }))
              }
              className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-5">
          <label className="block">
            <span className="mb-1 block text-sm text-ink-muted">Rangi Kuu</span>
            <input
              type="color"
              value={form.brand_accent_color}
              onChange={(e) =>
                setForm((f) => ({ ...f, brand_accent_color: e.target.value }))
              }
              className="h-11 w-full rounded-lg border border-line bg-surface-hover px-2 py-1"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-ink-muted">
              Rangi Kuu (Kivuli)
            </span>
            <input
              type="color"
              value={form.brand_accent_color_dark}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  brand_accent_color_dark: e.target.value,
                }))
              }
              className="h-11 w-full rounded-lg border border-line bg-surface-hover px-2 py-1"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">
            Namba ya WhatsApp (mfano: 255687862261)
          </span>
          <input
            type="text"
            required
            value={form.whatsapp_number}
            onChange={(e) =>
              setForm((f) => ({ ...f, whatsapp_number: e.target.value }))
            }
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">Barua Pepe</span>
          <input
            type="email"
            required
            value={form.contact_email}
            onChange={(e) =>
              setForm((f) => ({ ...f, contact_email: e.target.value }))
            }
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">Anwani</span>
          <input
            type="text"
            value={form.contact_address}
            onChange={(e) =>
              setForm((f) => ({ ...f, contact_address: e.target.value }))
            }
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">
            Kiungo cha Instagram (hiari)
          </span>
          <input
            type="url"
            placeholder="https://instagram.com/..."
            value={form.instagram_url}
            onChange={(e) =>
              setForm((f) => ({ ...f, instagram_url: e.target.value }))
            }
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">
            Kiungo cha Facebook (hiari)
          </span>
          <input
            type="url"
            placeholder="https://facebook.com/..."
            value={form.facebook_url}
            onChange={(e) =>
              setForm((f) => ({ ...f, facebook_url: e.target.value }))
            }
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          />
        </label>

        {canEdit && (
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-brand-accent py-3 font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
          >
            {saving ? "Inahifadhi..." : "Hifadhi Mipangilio"}
          </button>
        )}
        </fieldset>
      </form>
    </div>
  );
}
