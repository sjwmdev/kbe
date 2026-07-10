import { useEffect, useMemo, useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { fetchMessageTemplates } from "../../lib/api";
import { renderTemplate, type MessageTemplate } from "../../types/template";
import {
  COMMUNICATION_CHANNEL_LABELS,
  type AdminUser,
  type CommunicationChannel,
} from "../../types/rbac";

interface ResetPasswordModalProps {
  user: AdminUser;
  temporaryPassword: string;
  onClose: () => void;
}

/**
 * Shown once after an admin resets a user's password: the one-time temporary
 * password plus a ready-to-send message built from the message template for
 * the chosen channel (preselected from the user's own communication
 * preference). Nothing here is retrievable after close — same rule as the
 * create-user flow.
 */
export function ResetPasswordModal({
  user,
  temporaryPassword,
  onClose,
}: ResetPasswordModalProps) {
  const { token } = useAuth();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  // Dashboard preference can't deliver a password (the user can't log in to
  // see it), so message sending only offers email/WhatsApp.
  const [channel, setChannel] = useState<CommunicationChannel>(
    user.default_communication_channel === "whatsapp" ? "whatsapp" : "email",
  );
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchMessageTemplates(token)
      .then(setTemplates)
      .catch(() => {
        // Silent — the password itself is still shown; only the pre-built
        // message convenience is lost.
      });
  }, [token]);

  const template = useMemo(
    () =>
      templates.find(
        (t) => t.channel === channel && t.key.startsWith("password_reset"),
      ),
    [templates, channel],
  );

  const message = useMemo(() => {
    if (!template) return "";
    return renderTemplate(template.body, {
      user_name: user.name || user.username,
      email: user.email,
      temporary_password: temporaryPassword,
      login_url: `${window.location.origin}/admin/login`,
    });
  }, [template, user, temporaryPassword]);

  const whatsappLink = useMemo(() => {
    if (channel !== "whatsapp" || !user.phone || !message) return "";
    const digits = user.phone.replace(/\D/g, "");
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  }, [channel, user.phone, message]);

  function copy(text: string, mark: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      mark(true);
      setTimeout(() => mark(false), 2000);
    });
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 animate-[modal-backdrop-in_0.15s_ease-out]">
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl animate-[modal-pop-in_0.2s_cubic-bezier(0.34,1.56,0.64,1)]"
      >
        <div className="flex max-h-[85vh] flex-col gap-4 overflow-y-auto p-6">
          <div className="text-center">
            <h2 className="text-lg font-bold text-ink">
              Nenosiri Jipya la Muda
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Kwa {user.name || user.username} ({user.email}). Halitaonyeshwa
              tena baada ya kufunga dirisha hili. Mtumiaji atalazimika kuweka
              nenosiri jipya akiingia.
            </p>
          </div>

          <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-surface-hover px-4 py-3">
            <code className="font-mono text-base font-bold text-ink">
              {temporaryPassword}
            </code>
            <button
              type="button"
              onClick={() => copy(temporaryPassword, setCopiedPassword)}
              aria-label="Nakili nenosiri"
              className="shrink-0 text-ink-muted hover:text-brand-accent"
            >
              {copiedPassword ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </div>

          <div className="rounded-lg border border-line p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-ink">
                Ujumbe wa Kutuma
              </span>
              <select
                value={channel}
                onChange={(e) =>
                  setChannel(e.target.value as CommunicationChannel)
                }
                aria-label="Chagua kiolezo cha ujumbe"
                className="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink outline-none focus:border-brand-accent"
              >
                <option value="email">Kiolezo cha Barua Pepe</option>
                <option value="whatsapp">Kiolezo cha WhatsApp</option>
              </select>
            </div>

            <p className="mb-2 text-xs text-ink-muted">
              Njia anayopendelea mtumiaji:{" "}
              <span className="font-semibold">
                {COMMUNICATION_CHANNEL_LABELS[
                  user.default_communication_channel
                ] ?? "—"}
              </span>
              {user.phone && ` · ${user.phone}`}
            </p>

            {message ? (
              <>
                <pre className="whitespace-pre-wrap rounded-lg bg-surface-hover p-3 font-sans text-xs leading-relaxed text-ink">
                  {message}
                </pre>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => copy(message, setCopiedMessage)}
                    className="flex items-center gap-1.5 rounded-full border border-line px-4 py-1.5 text-xs font-semibold text-ink-muted transition hover:border-brand-accent hover:text-brand-accent"
                  >
                    {copiedMessage ? <Check size={14} /> : <Copy size={14} />}
                    Nakili Ujumbe
                  </button>
                  {whatsappLink && (
                    <a
                      href={whatsappLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 rounded-full bg-green-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700"
                    >
                      <MessageCircle size={14} /> Fungua WhatsApp
                    </a>
                  )}
                </div>
              </>
            ) : (
              <p className="text-xs text-ink-muted">Inapakia kiolezo...</p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-1 rounded-full bg-brand-accent px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark"
          >
            Nimeelewa, Funga
          </button>
        </div>
      </div>
    </div>
  );
}
