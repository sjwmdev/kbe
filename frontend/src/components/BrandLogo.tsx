import { useTheme } from "../context/ThemeContext";
import { useSettings } from "../context/SettingsContext";
import { resolveMediaUrl } from "../lib/api";

interface BrandLogoProps {
  className?: string;
}

// Two pre-rendered variants (see frontend/public/logo-*-mode.png) are the
// fallback for Kalour itself, used until a tenant uploads its own logo via
// Settings — swapping images is far more reliable than a CSS filter trick,
// which would also distort a brand-specific flourish.
export function BrandLogo({ className = "h-6 w-auto sm:h-7" }: BrandLogoProps) {
  const { theme } = useTheme();
  const settings = useSettings();
  const isDark = theme === "dark";

  const customUrl = isDark ? settings.logo_dark_url : settings.logo_light_url;
  const src = customUrl
    ? resolveMediaUrl(customUrl)
    : isDark
      ? "/logo-dark-mode.png"
      : "/logo-light-mode.png";

  return <img src={src} alt={settings.company_name} className={className} />;
}
