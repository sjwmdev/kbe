import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  ApiError,
  changePassword,
  fetchProfile,
  updateProfile,
} from "../../lib/api";
import type { AdminProfile } from "../../lib/api";
import {
  COMMUNICATION_CHANNEL_LABELS,
  type CommunicationChannel,
} from "../../types/rbac";
import { Skeleton } from "../../components/Skeleton";

export function ProfilePage() {
  const { token, logout, applySession, mustChangePassword } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<CommunicationChannel>("dashboard");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    fetchProfile(token)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setName(data.name);
        setEmail(data.email);
        setPhone(data.phone);
        setChannel(data.default_communication_channel || "dashboard");
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
          logout();
          return;
        }
        toast.error("Imeshindwa kupakia wasifu wako.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, logout, toast]);

  async function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (channel === "whatsapp" && !phone.trim()) {
      toast.error("Weka namba ya simu ili kutumia WhatsApp.");
      return;
    }

    setSavingProfile(true);
    try {
      const updated = await toast.promise(
        updateProfile(token, {
          name,
          email,
          phone: phone.trim(),
          default_communication_channel: channel,
        }),
        {
          loading: "Inahifadhi wasifu...",
          success: "Wasifu umehifadhiwa.",
          error: (err) =>
            err instanceof ApiError && err.status === 401
              ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
              : "Imeshindwa kuhifadhi wasifu.",
        },
      );
      setProfile(updated);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    if (newPassword.length < 8) {
      toast.error("Nenosiri jipya lazima liwe na herufi 8 au zaidi.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Nenosiri jipya na uthibitisho hazifanani.");
      return;
    }

    setChangingPassword(true);
    try {
      const session = await toast.promise(
        changePassword(token, {
          current_password: currentPassword,
          new_password: newPassword,
        }),
        {
          loading: "Inabadilisha nenosiri...",
          success: "Nenosiri limebadilishwa.",
          error: (err) =>
            err instanceof ApiError && err.status === 401
              ? "Nenosiri la sasa si sahihi."
              : "Imeshindwa kubadilisha nenosiri.",
        },
      );
      // Swap in the freshly issued token — the old one still carries the
      // stale must_change_password=true claim (see auth_handler.go).
      applySession(session);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      // toast already reported the specific reason.
    } finally {
      setChangingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      {mustChangePassword && (
        <div className="rounded-xl border border-brand-accent/40 bg-brand-accent/10 p-4 text-sm text-ink">
          <span className="font-bold text-brand-accent">Lazima ubadilishe nenosiri lako.</span>{" "}
          Huwezi kutumia sehemu nyingine za dashibodi hadi ubadilishe nenosiri
          lako la muda kuwa jipya hapa chini.
        </div>
      )}

      <div>
        <h1 className="text-2xl font-extrabold text-ink">Wasifu Wangu</h1>
        <p className="text-ink-muted">
          Ingia kama <span className="font-semibold">{profile?.username}</span>
        </p>
      </div>

      <form
        onSubmit={handleSaveProfile}
        className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6 shadow-card"
      >
        <h2 className="text-lg font-bold text-ink">Taarifa Binafsi</h2>

        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">Jina</span>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">Barua Pepe</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">
            Namba ya Simu / WhatsApp
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+255 7XX XXX XXX"
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">
            Njia Unayopendelea ya Mawasiliano
          </span>
          <select
            value={channel}
            onChange={(e) => setChannel(e.target.value as CommunicationChannel)}
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          >
            {(
              Object.entries(COMMUNICATION_CHANNEL_LABELS) as [
                CommunicationChannel,
                string,
              ][]
            ).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-ink-muted">
            Njia hii itatumika kukutumia taarifa kama vile nenosiri jipya.
          </span>
        </label>

        <button
          type="submit"
          disabled={savingProfile}
          className="self-start rounded-full bg-brand-accent px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
        >
          {savingProfile ? "Inahifadhi..." : "Hifadhi Taarifa"}
        </button>
      </form>

      <form
        onSubmit={handleChangePassword}
        className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6 shadow-card"
      >
        <h2 className="text-lg font-bold text-ink">Badilisha Nenosiri</h2>

        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">
            Nenosiri la Sasa
          </span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">
            Nenosiri Jipya (herufi 8+)
          </span>
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm text-ink-muted">
            Thibitisha Nenosiri Jipya
          </span>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface-hover px-4 py-3 text-ink outline-none focus:border-brand-accent"
          />
        </label>

        <button
          type="submit"
          disabled={changingPassword}
          className="self-start rounded-full bg-brand-accent px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
        >
          {changingPassword ? "Inabadilisha..." : "Badilisha Nenosiri"}
        </button>
      </form>
    </div>
  );
}
