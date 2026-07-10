import { useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Boxes,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useSettings } from "../../context/SettingsContext";
import { ApiError, requestPasswordReset, resolveMediaUrl } from "../../lib/api";

interface LocationState {
  from?: { pathname: string };
}

const FEATURE_HIGHLIGHTS = [
  { icon: Package, label: "Bidhaa", desc: "Simamia orodha ya bidhaa zako" },
  { icon: ShoppingCart, label: "Oda", desc: "Fuatilia oda za wateja" },
  { icon: Boxes, label: "Stoo", desc: "Angalia hali ya stoo kwa wakati" },
  { icon: Users, label: "Wateja", desc: "Tunza uhusiano na wateja" },
  { icon: BarChart3, label: "Ripoti", desc: "Pima ukuaji wa biashara" },
];

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

  const [forgotMode, setForgotMode] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [requesting, setRequesting] = useState(false);

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

  async function handleForgotSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setRequesting(true);
    try {
      await requestPasswordReset(identifier.trim());
      setRequestSent(true);
    } catch {
      toast.error("Imeshindwa kutuma ombi. Jaribu tena.");
    } finally {
      setRequesting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* Promo panel — deliberately theme-independent, same reasoning as the
          form panel: this is the one screen every admin sees before any
          personal theme preference loads. Colors follow the app's own
          conventions rather than a big saturated brand surface: a near-black
          background mixed from the configured brand accent (11% via
          color-mix, so it follows tenant branding instead of hardcoding one
          hue), white text/icons (the dark-surface icon rule), and
          brand-accent kept to small glow accents — the same "accent, never
          a wall of color" restraint used across the app. Hidden on mobile
          since only the form matters on a small screen. */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-[color-mix(in_srgb,var(--color-brand-accent)_11%,#0a060a)] p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-brand-accent/25 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-brand-accent/15 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <img
            src={
              settings.logo_dark_url
                ? resolveMediaUrl(settings.logo_dark_url)
                : "/logo-dark-mode.png"
            }
            alt={settings.company_name}
            className="h-8 w-auto"
          />
        </div>

        <div className="relative flex flex-col gap-8">
          <div>
            <h1 className="text-3xl font-extrabold leading-tight text-white">
              Simamia biashara yako popote ulipo
            </h1>
            <p className="mt-3 max-w-sm text-white/70">
              Dashibodi moja ya kusimamia bidhaa, oda, stoo na wateja wa{" "}
              {settings.company_name}.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {FEATURE_HIGHLIGHTS.map(({ icon: Icon, label, desc }) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/[0.06] p-4"
              >
                <Icon size={20} className="text-white" />
                <p className="mt-2 text-sm font-bold text-white">{label}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-white/60">
                  {desc}
                </p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-xs text-white/50">
          &copy; {new Date().getFullYear()} {settings.company_name}. Haki zote
          zimehifadhiwa.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        {forgotMode ? (
          <form
            onSubmit={handleForgotSubmit}
            className="w-full max-w-sm animate-[modal-pop-in_0.25s_cubic-bezier(0.34,1.56,0.64,1)]"
          >
            <div className="mb-10 flex flex-col items-center gap-3 text-center lg:hidden">
              <img
                src={
                  settings.logo_light_url
                    ? resolveMediaUrl(settings.logo_light_url)
                    : "/logo-light-mode.png"
                }
                alt={settings.company_name}
                className="h-8 w-auto"
              />
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-extrabold text-gray-900">
                Umesahau nenosiri?
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Weka barua pepe au jina lako la mtumiaji — msimamizi
                atashughulikia ombi lako.
              </p>
            </div>

            {requestSent ? (
              <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
                Ombi la kuweka upya nenosiri limetumwa. Tafadhali subiri
                msimamizi alishughulikie ombi lako.
              </div>
            ) : (
              <>
                <label className="mb-6 block">
                  <span className="mb-1.5 block text-sm font-medium text-gray-600">
                    Barua Pepe au Jina la Mtumiaji
                  </span>
                  <div className="relative">
                    <Mail
                      size={18}
                      className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      type="text"
                      required
                      autoFocus
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-gray-900 outline-none transition focus:border-brand-accent focus:bg-white focus:ring-2 focus:ring-brand-accent/15"
                    />
                  </div>
                </label>

                <button
                  type="submit"
                  disabled={requesting}
                  className="w-full rounded-full bg-brand-accent py-3 font-bold text-white shadow-lg shadow-brand-accent/25 transition hover:bg-brand-accent-dark disabled:opacity-60"
                >
                  {requesting ? "Inatuma..." : "Tuma Ombi"}
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setForgotMode(false);
                setRequestSent(false);
                setIdentifier("");
              }}
              className="mt-6 w-full text-center text-sm font-semibold text-brand-accent transition hover:text-brand-accent-dark"
            >
              &larr; Rudi kwenye kuingia
            </button>
          </form>
        ) : (
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm animate-[modal-pop-in_0.25s_cubic-bezier(0.34,1.56,0.64,1)]"
        >
          <div className="mb-10 flex flex-col items-center gap-3 text-center lg:hidden">
            <img
              src={
                settings.logo_light_url
                  ? resolveMediaUrl(settings.logo_light_url)
                  : "/logo-light-mode.png"
              }
              alt={settings.company_name}
              className="h-8 w-auto"
            />
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-extrabold text-gray-900">
              Karibu tena
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Ingia kwenye dashibodi ya msimamizi
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
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-gray-900 outline-none transition focus:border-brand-accent focus:bg-white focus:ring-2 focus:ring-brand-accent/15"
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
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-3 pl-11 pr-11 text-gray-900 outline-none transition focus:border-brand-accent focus:bg-white focus:ring-2 focus:ring-brand-accent/15"
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
            className="w-full rounded-full bg-brand-accent py-3 font-bold text-white shadow-lg shadow-brand-accent/25 transition hover:bg-brand-accent-dark disabled:opacity-60"
          >
            {submitting ? "Inaingia..." : "Ingia"}
          </button>

          <button
            type="button"
            onClick={() => setForgotMode(true)}
            className="mt-6 w-full text-center text-sm font-semibold text-brand-accent transition hover:text-brand-accent-dark"
          >
            Umesahau nenosiri?
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
