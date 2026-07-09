import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { fetchSettings } from "../lib/api";
import { setBusinessNumber } from "../lib/whatsapp";
import { CONTACT_EMAIL, CONTACT_LOCATION } from "../lib/contact";
import type { SiteSettings } from "../types/content";

const DEFAULT_SETTINGS: SiteSettings = {
  whatsapp_number: "",
  contact_email: CONTACT_EMAIL,
  contact_address: CONTACT_LOCATION,
  instagram_url: "",
  facebook_url: "",
  company_name: "Kalour Beauty Empire",
  logo_light_url: "",
  logo_dark_url: "",
  brand_accent_color: "",
  brand_accent_color_dark: "",
  updated_at: "",
};

// Tailwind's @theme only generates utility classes at build time — the CSS
// variable's *value* still resolves at runtime like any other, the same
// mechanism the existing `.dark` class override already relies on. Applying
// it here means every tenant's branding takes effect without a rebuild.
function applyBranding(settings: SiteSettings) {
  // --color-icon is deliberately left untouched here — it's overridden to a
  // flat white by the .dark class (see index.css), and an inline style on
  // the same element would outrank that class override and break dark mode.
  const root = document.documentElement.style;
  if (settings.brand_accent_color) {
    root.setProperty("--color-brand-accent", settings.brand_accent_color);
  }
  if (settings.brand_accent_color_dark) {
    root.setProperty("--color-brand-accent-dark", settings.brand_accent_color_dark);
  }
  if (settings.company_name) {
    document.title = settings.company_name;
  }
}

const SettingsContext = createContext<SiteSettings>(DEFAULT_SETTINGS);

// Fetches site settings once on mount and provides them app-wide. Falls back
// to the existing env-var-based defaults (lib/contact.ts) if the fetch fails,
// so the site never breaks if the API is briefly unavailable.
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let cancelled = false;

    fetchSettings()
      .then((data) => {
        if (cancelled) return;
        setSettings(data);
        setBusinessNumber(data.whatsapp_number);
        applyBranding(data);
      })
      .catch(() => {
        // Keep the defaults; nothing else to do.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SettingsContext.Provider value={settings}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SiteSettings {
  return useContext(SettingsContext);
}
