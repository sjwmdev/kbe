import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import {
  ApiError,
  deleteUser,
  fetchUsers,
  resetUserPassword,
  setUserActive,
} from "../../lib/api";
import { COMMUNICATION_CHANNEL_LABELS, type AdminUser } from "../../types/rbac";
import { Skeleton } from "../../components/Skeleton";
import { STATUS_TONE_CLASSES } from "../../lib/statusTone";
import { UserFormPanel } from "../../components/admin/UserFormPanel";
import { ResetPasswordModal } from "../../components/admin/ResetPasswordModal";
import { ActionMenu, type ActionMenuItem } from "../../components/admin/ActionMenu";

export function UsersPage() {
  const { token, logout, hasPermission } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [panelUser, setPanelUser] = useState<AdminUser | null | undefined>(
    undefined,
  );
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{
    user: AdminUser;
    password: string;
  } | null>(null);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function loadUsers() {
    if (!token) return;
    setLoading(true);
    fetchUsers(token)
      .then(setUsers)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
          logout();
          return;
        }
        toast.error("Imeshindwa kupakia watumiaji.");
      })
      .finally(() => setLoading(false));
  }

  async function handleToggleActive(user: AdminUser) {
    if (!token) return;
    setTogglingId(user.id);
    try {
      await toast.promise(setUserActive(token, user.id, !user.is_active), {
        loading: "Inasasisha hali...",
        success: user.is_active
          ? `"${user.name}" amezimwa.`
          : `"${user.name}" amewashwa.`,
        error: (err) =>
          err instanceof ApiError ? err.message : "Imeshindwa kusasisha hali.",
      });
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, is_active: !u.is_active } : u,
        ),
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
    } finally {
      setTogglingId(null);
    }
  }

  async function handleDelete(user: AdminUser) {
    if (!token) return;
    const confirmed = await confirm({
      title: "Futa Mtumiaji",
      message: `Una uhakika unataka kufuta "${user.name}"? Hatua hii haiwezi kutenduliwa.`,
      confirmLabel: "Futa",
    });
    if (!confirmed) return;

    setDeletingId(user.id);
    try {
      await toast.promise(deleteUser(token, user.id), {
        loading: "Inafuta mtumiaji...",
        success: `"${user.name}" amefutwa.`,
        error: (err) =>
          err instanceof ApiError ? err.message : "Imeshindwa kufuta mtumiaji.",
      });
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
    } finally {
      setDeletingId(null);
    }
  }

  async function handleResetPassword(user: AdminUser) {
    if (!token) return;
    const confirmed = await confirm({
      title: "Weka Upya Nenosiri",
      message: `Una uhakika unataka kumtengenezea "${user.name || user.username}" nenosiri jipya la muda? Nenosiri lake la sasa litaacha kufanya kazi mara moja.`,
      confirmLabel: "Weka Upya",
    });
    if (!confirmed) return;

    setResettingId(user.id);
    try {
      const result = await toast.promise(resetUserPassword(token, user.id), {
        loading: "Inatengeneza nenosiri jipya...",
        success: "Nenosiri jipya la muda limetengenezwa.",
        error: (err) =>
          err instanceof ApiError && err.status === 401
            ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
            : "Imeshindwa kuweka upya nenosiri.",
      });
      setResetResult({ user: result.user, password: result.temporary_password });
      handleSaved(result.user);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
    } finally {
      setResettingId(null);
    }
  }

  function handleSaved(saved: AdminUser) {
    setUsers((prev) => {
      const exists = prev.some((u) => u.id === saved.id);
      return exists
        ? prev.map((u) => (u.id === saved.id ? saved : u))
        : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Watumiaji</h1>
          <p className="text-ink-muted">
            Simamia watumiaji wa dashibodi na majukumu yao.
          </p>
        </div>
        {hasPermission("users.create") && (
          <button
            type="button"
            onClick={() => setPanelUser(null)}
            className="flex items-center gap-2 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark"
          >
            <Plus size={16} /> Ongeza Mtumiaji
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Jina</th>
              <th className="px-4 py-3 font-semibold">Barua Pepe</th>
              <th className="px-4 py-3 font-semibold">Mawasiliano</th>
              <th className="px-4 py-3 font-semibold">Jukumu</th>
              <th className="px-4 py-3 font-semibold">Hali</th>
              <th className="px-4 py-3 font-semibold">Vitendo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading &&
              Array.from({ length: 3 }).map((_, i) => (
                <tr key={i}>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-32" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-24" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-20" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-6 w-16 rounded-full" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-12" />
                  </td>
                </tr>
              ))}
            {!loading &&
              users.map((user) => (
                <tr key={user.id} className="text-ink">
                  <td className="px-4 py-3 font-medium">
                    {user.name}
                    {user.must_change_password && (
                      <span className="ml-2 rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
                        Nenosiri Jipya
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{user.email}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {COMMUNICATION_CHANNEL_LABELS[
                      user.default_communication_channel
                    ] ?? "—"}
                    {user.phone && (
                      <span className="block text-xs">{user.phone}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {user.role_name || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => handleToggleActive(user)}
                      disabled={!hasPermission("users.edit") || togglingId === user.id}
                      className={`rounded-full px-3 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                        STATUS_TONE_CLASSES[user.is_active ? "success" : "neutral"]
                      }`}
                    >
                      {user.is_active ? "Anaonekana" : "Amezimwa"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <ActionMenu
                      items={(
                        [
                          hasPermission("users.edit") && {
                            label: "Hariri",
                            onClick: () => setPanelUser(user),
                          },
                          hasPermission("users.resetPassword") && {
                            label: "Weka Upya Nenosiri",
                            onClick: () => void handleResetPassword(user),
                            disabled: resettingId === user.id,
                          },
                          hasPermission("users.delete") && {
                            label: "Futa",
                            onClick: () => void handleDelete(user),
                            disabled: deletingId === user.id,
                            danger: true,
                          },
                        ] as (ActionMenuItem | false)[]
                      ).filter((item): item is ActionMenuItem => Boolean(item))}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {!loading && users.length === 0 && (
        <p className="text-ink-muted">Bado hakuna watumiaji waliongezwa.</p>
      )}

      {panelUser !== undefined && (
        <UserFormPanel
          user={panelUser}
          onClose={() => setPanelUser(undefined)}
          onSaved={handleSaved}
        />
      )}

      {resetResult && (
        <ResetPasswordModal
          user={resetResult.user}
          temporaryPassword={resetResult.password}
          onClose={() => setResetResult(null)}
        />
      )}
    </div>
  );
}
