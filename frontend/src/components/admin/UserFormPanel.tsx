import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Check, Copy, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  ApiError,
  createUser,
  fetchRoles,
  updateUser,
} from "../../lib/api";
import type { AdminUser } from "../../types/rbac";
import type { Role } from "../../types/rbac";

interface UserFormPanelProps {
  user: AdminUser | null;
  onClose: () => void;
  onSaved: (user: AdminUser) => void;
}

export function UserFormPanel({ user, onClose, onSaved }: UserFormPanelProps) {
  const { token, logout } = useAuth();
  const toast = useToast();
  const isEditMode = Boolean(user);

  const [roles, setRoles] = useState<Role[]>([]);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [roleId, setRoleId] = useState(user?.role_id ?? "");
  const [saving, setSaving] = useState(false);

  // Once set, the form shows a one-time reveal screen instead of the fields
  // — closing it does not bring the password back (it isn't stored anywhere
  // in plaintext once this component unmounts).
  const [revealedPassword, setRevealedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchRoles(token)
      .then(setRoles)
      .catch(() => {
        toast.error("Imeshindwa kupakia majukumu.");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    setSaving(true);
    try {
      const input = { name, email, role_id: roleId || null };
      if (isEditMode) {
        const saved = await toast.promise(updateUser(token, user!.id, input), {
          loading: "Inahifadhi mtumiaji...",
          success: "Mtumiaji amehifadhiwa.",
          error: (err) =>
            err instanceof ApiError && err.status === 401
              ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
              : "Imeshindwa kuhifadhi mtumiaji.",
        });
        onSaved(saved);
      } else {
        const result = await toast.promise(createUser(token, input), {
          loading: "Inaongeza mtumiaji...",
          success: "Mtumiaji mpya ameongezwa.",
          error: (err) =>
            err instanceof ApiError && err.status === 401
              ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
              : "Imeshindwa kuongeza mtumiaji.",
        });
        // Don't close yet — show the one-time password first.
        setRevealedPassword(result.temporary_password);
        onSaved(result.user);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
    } finally {
      setSaving(false);
    }
  }

  function handleCopy() {
    if (!revealedPassword) return;
    navigator.clipboard.writeText(revealedPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 animate-[modal-backdrop-in_0.15s_ease-out]"
      onClick={revealedPassword ? undefined : onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl animate-[modal-pop-in_0.2s_cubic-bezier(0.34,1.56,0.64,1)]"
      >
        {revealedPassword ? (
          <div className="flex flex-col gap-4 p-6 text-center">
            <h2 className="text-lg font-bold text-ink">
              Nenosiri la Muda Limetengenezwa
            </h2>
            <p className="text-sm text-ink-muted">
              Mpe mtumiaji nenosiri hili sasa. Halitaonyeshwa tena baada ya
              kufunga dirisha hili.
            </p>
            <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-hover px-4 py-3">
              <code className="font-mono text-base font-bold text-ink">
                {revealedPassword}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Nakili"
                className="shrink-0 text-ink-muted hover:text-brand-accent"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 rounded-full bg-brand-accent px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark"
            >
              Nimeelewa, Funga
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-line p-5">
              <h2 className="text-lg font-bold text-ink">
                {isEditMode ? "Hariri Mtumiaji" : "Ongeza Mtumiaji Mpya"}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Funga"
                className="text-ink-muted hover:text-ink"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-5">
              <label className="block">
                <span className="mb-1 block text-sm text-ink-muted">Jina</span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface-hover px-4 py-2.5 text-ink outline-none focus:border-brand-accent"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-ink-muted">
                  Barua Pepe
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface-hover px-4 py-2.5 text-ink outline-none focus:border-brand-accent"
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-sm text-ink-muted">Jukumu</span>
                <select
                  value={roleId}
                  onChange={(e) => setRoleId(e.target.value)}
                  className="w-full rounded-lg border border-line bg-surface-hover px-4 py-2.5 text-ink outline-none focus:border-brand-accent"
                >
                  <option value="">Hakuna Jukumu</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id} className="bg-surface">
                      {role.name}
                    </option>
                  ))}
                </select>
              </label>

              {!isEditMode && (
                <p className="text-xs text-ink-muted">
                  Nenosiri la muda litatengenezwa kiotomatiki na kuonyeshwa
                  mara moja baada ya kuongeza mtumiaji.
                </p>
              )}

              <div className="mt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-surface-hover hover:text-ink"
                >
                  Ghairi
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-brand-accent px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
                >
                  {saving ? "Inahifadhi..." : "Hifadhi"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
