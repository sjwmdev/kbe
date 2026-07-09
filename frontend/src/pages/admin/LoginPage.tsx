import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useSettings } from "../../context/SettingsContext";
import { ApiError, resolveMediaUrl } from "../../lib/api";

interface LocationState {
  from?: { pathname: string };
}

export function LoginPage() {
  const { login } = useAuth();
  const settings = useSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const state = location.state as LocationState | null;
  const from = state?.from?.pathname ?? "/admin";

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.code === "account_locked") {
        toast.error(
          "Akaunti imefungwa kwa muda kutokana na majaribio mengi. Jaribu tena baadaye.",
        );
      } else if (err instanceof ApiError && err.code === "account_inactive") {
        toast.error("Akaunti hii imezimwa. Wasiliana na msimamizi.");
      } else {
        toast.error("Barua pepe au nenosiri sio sahihi.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-page px-4">
      <form
        onSubmit={handleSubmit}
        // Deliberately a plain white card regardless of the app's active
        // theme — same reasoning as ConfirmModal's "plain" tone: a login
        // form benefits from staying crisp and unambiguous rather than
        // following dark mode, since it's the one screen every admin sees
        // before any personal theme preference is even loaded.
        className="w-full max-w-sm animate-[modal-pop-in_0.25s_cubic-bezier(0.34,1.56,0.64,1)] rounded-2xl border border-gray-200 bg-white p-8 shadow-2xl shadow-black/10"
      >
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img
            src={
              settings.logo_light_url
                ? resolveMediaUrl(settings.logo_light_url)
                : "/logo-light-mode.png"
            }
            alt={settings.company_name}
            className="h-8 w-auto"
          />
          <p className="text-xs font-semibold tracking-widest text-brand-accent">
            DASHIBODI YA MSIMAMIZI
          </p>
        </div>

        <label className="mb-4 block">
          <span className="mb-1.5 block text-sm font-medium text-gray-600">
            Barua Pepe
          </span>
          <div className="relative">
            <Mail
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="email"
              required
              autoComplete="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-11 pr-4 text-gray-900 outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
            />
          </div>
        </label>

        <label className="mb-6 block">
          <span className="mb-1.5 block text-sm font-medium text-gray-600">
            Nenosiri
          </span>
          <div className="relative">
            <Lock
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-3 pl-11 pr-11 text-gray-900 outline-none transition focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Ficha nenosiri" : "Onyesha nenosiri"}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 transition hover:text-gray-600"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </label>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-full bg-brand-accent py-3 font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
        >
          {submitting ? "Inaingia..." : "Ingia"}
        </button>
      </form>
    </div>
  );
}
