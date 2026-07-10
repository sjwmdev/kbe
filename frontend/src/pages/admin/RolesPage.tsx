import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import { useConfirm } from "../../context/ConfirmContext";
import { ApiError, deleteRole, fetchRoles } from "../../lib/api";
import type { Role } from "../../types/rbac";
import { Skeleton } from "../../components/Skeleton";
import { RolePermissionsPanel } from "../../components/admin/RolePermissionsPanel";
import { ActionMenu, type ActionMenuItem } from "../../components/admin/ActionMenu";

export function RolesPage() {
  const { token, logout, hasPermission } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [panelRole, setPanelRole] = useState<Role | null | undefined>(undefined);

  useEffect(() => {
    loadRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  function loadRoles() {
    if (!token) return;
    setLoading(true);
    fetchRoles(token)
      .then(setRoles)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
          logout();
          return;
        }
        toast.error("Imeshindwa kupakia majukumu.");
      })
      .finally(() => setLoading(false));
  }

  async function handleDelete(role: Role) {
    if (!token) return;
    const confirmed = await confirm({
      title: "Futa Jukumu",
      message: `Una uhakika unataka kufuta jukumu "${role.name}"? Hatua hii haiwezi kutenduliwa.`,
      confirmLabel: "Futa",
    });
    if (!confirmed) return;

    setDeletingId(role.id);
    try {
      await toast.promise(deleteRole(token, role.id), {
        loading: "Inafuta jukumu...",
        success: `"${role.name}" imefutwa.`,
        error: (err) =>
          err instanceof ApiError && err.status === 401
            ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
            : "Imeshindwa kufuta jukumu.",
      });
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
    } finally {
      setDeletingId(null);
    }
  }

  function handleSaved(saved: Role) {
    setRoles((prev) => {
      const exists = prev.some((r) => r.id === saved.id);
      return exists
        ? prev.map((r) => (r.id === saved.id ? saved : r))
        : [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
    });
    setPanelRole(undefined);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-extrabold text-ink">Majukumu</h1>
          <p className="text-ink-muted">
            Simamia majukumu na ruhusa za watumiaji wa dashibodi.
          </p>
        </div>
        {hasPermission("roles.create") && (
          <button
            type="button"
            onClick={() => setPanelRole(null)}
            className="flex items-center gap-2 rounded-full bg-brand-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark"
          >
            <Plus size={16} /> Ongeza Jukumu
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line shadow-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-hover text-ink-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Jina</th>
              <th className="px-4 py-3 font-semibold">Maelezo</th>
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
                    <Skeleton className="h-4 w-40" />
                  </td>
                  <td className="px-4 py-3">
                    <Skeleton className="h-4 w-12" />
                  </td>
                </tr>
              ))}
            {!loading &&
              roles.map((role) => (
                <tr key={role.id} className="text-ink">
                  <td className="px-4 py-3 font-medium">{role.name}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {role.description || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <ActionMenu
                      items={(
                        [
                          hasPermission("roles.edit") && {
                            label: "Hariri",
                            onClick: () => setPanelRole(role),
                          },
                          hasPermission("roles.delete") && {
                            label: "Futa",
                            onClick: () => void handleDelete(role),
                            disabled: deletingId === role.id,
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

      {!loading && roles.length === 0 && (
        <p className="text-ink-muted">Bado hakuna majukumu yaliyoongezwa.</p>
      )}

      {panelRole !== undefined && (
        <RolePermissionsPanel
          role={panelRole}
          onClose={() => setPanelRole(undefined)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
