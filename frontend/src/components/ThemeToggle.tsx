import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Washa mwanga" : "Zima mwanga"}
      aria-pressed={isDark}
      className="rounded-full border border-line p-2 text-ink-muted transition hover:border-brand-accent/50 hover:text-brand-accent"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
