import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ChevronDown, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import {
  ApiError,
  createRole,
  fetchPermissions,
  fetchRolePermissions,
  updateRole,
  updateRolePermissions,
} from "../../lib/api";
import type { Permission, Role } from "../../types/rbac";

const MODULE_LABELS: Record<string, string> = {
  products: "Bidhaa",
  categories: "Kategoria",
  orders: "Oda",
  notifications: "Arifa",
  media: "Vyombo vya Habari",
  pages: "Kurasa Tuli",
  sliders: "Slaidi",
  settings: "Mipangilio",
  roles: "Majukumu",
  users: "Watumiaji",
};

const ACTION_LABELS: Record<string, string> = {
  view: "Angalia",
  create: "Ongeza",
  edit: "Hariri",
  delete: "Futa",
  upload: "Pakia",
  manage: "Simamia",
  restore: "Rejesha",
  forceDelete: "Futa Kabisa",
  resetPassword: "Weka Upya Nenosiri",
};

// Preferred display order. Modules the API returns that aren't listed here
// still render (appended alphabetically, raw key as the label) — the
// catalog in the backend is the source of truth, and a missing entry here
// must never silently hide a module's permissions (that's exactly how the
// notifications group went missing).
const MODULE_ORDER = [
  "products",
  "categories",
  "orders",
  "notifications",
  "media",
  "pages",
  "sliders",
  "settings",
  "roles",
  "users",
];

interface RolePermissionsPanelProps {
  role: Role | null;
  onClose: () => void;
  onSaved: (role: Role) => void;
}

export function RolePermissionsPanel({
  role,
  onClose,
  onSaved,
}: RolePermissionsPanelProps) {
  const { token, logout } = useAuth();
  const toast = useToast();
  const isEditMode = Boolean(role);

  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    Promise.all([
      fetchPermissions(token),
      role ? fetchRolePermissions(token, role.id) : Promise.resolve<string[]>([]),
    ])
      .then(([allPermissions, grantedIds]) => {
        if (cancelled) return;
        setPermissions(allPermissions);
        setSelected(new Set(grantedIds));
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          toast.error("Muda wa kuingia umeisha. Tafadhali ingia tena.");
          logout();
          return;
        }
        toast.error("Imeshindwa kupakia ruhusa.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, role?.id]);

  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    (acc[p.module] ??= []).push(p);
    return acc;
  }, {});
  const modules = [
    ...MODULE_ORDER.filter((m) => grouped[m]?.length),
    ...Object.keys(grouped)
      .filter((m) => !MODULE_ORDER.includes(m))
      .sort(),
  ];

  function toggleModule(moduleKey: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(moduleKey)) next.delete(moduleKey);
      else next.add(moduleKey);
      return next;
    });
  }

  function togglePermission(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    setSaving(true);
    try {
      const saved = await toast.promise(
        (async () => {
          const savedRole = isEditMode
            ? await updateRole(token, role!.id, { name, description })
            : await createRole(token, { name, description });
          await updateRolePermissions(token, savedRole.id, Array.from(selected));
          return savedRole;
        })(),
        {
          loading: isEditMode ? "Inahifadhi jukumu..." : "Inaongeza jukumu...",
          success: isEditMode ? "Jukumu limehifadhiwa." : "Jukumu limeongezwa.",
          error: (err) =>
            err instanceof ApiError && err.status === 401
              ? "Muda wa kuingia umeisha. Tafadhali ingia tena."
              : "Imeshindwa kuhifadhi jukumu.",
        },
      );
      onSaved(saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4 animate-[modal-backdrop-in_0.15s_ease-out]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl animate-[modal-pop-in_0.2s_cubic-bezier(0.34,1.56,0.64,1)]"
      >
        <div className="flex items-center justify-between border-b border-line p-5">
          <h2 className="text-lg font-bold text-ink">
            {isEditMode ? "Hariri Jukumu" : "Ongeza Jukumu Jipya"}
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

        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-y-auto"
        >
          <div className="flex flex-col gap-4 p-5">
            <label className="block">
              <span className="mb-1 block text-sm text-ink-muted">
                Jina la Jukumu
              </span>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface-hover px-4 py-2.5 text-ink outline-none focus:border-brand-accent"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm text-ink-muted">Maelezo</span>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface-hover px-4 py-2.5 text-ink outline-none focus:border-brand-accent"
              />
            </label>
          </div>

          <div className="border-t border-line px-5 py-4">
            <h3 className="mb-3 text-sm font-bold text-ink">Ruhusa</h3>

            {loading && <p className="text-sm text-ink-muted">Inapakia...</p>}

            {!loading && (
              <div className="flex flex-col gap-2">
                {modules.map((moduleKey) => {
                  const items = grouped[moduleKey];
                  const isOpen = expanded.has(moduleKey);
                  const grantedCount = items.filter((p) =>
                    selected.has(p.id),
                  ).length;

                  return (
                    <div
                      key={moduleKey}
                      className="overflow-hidden rounded-lg border border-line"
                    >
                      <button
                        type="button"
                        onClick={() => toggleModule(moduleKey)}
                        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-ink hover:bg-surface-hover"
                      >
                        <span>
                          {MODULE_LABELS[moduleKey] ?? moduleKey}
                          <span className="ml-2 text-xs font-normal text-ink-muted">
                            {grantedCount}/{items.length}
                          </span>
                        </span>
                        <ChevronDown
                          size={16}
                          className={`text-ink-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>

                      {isOpen && (
                        <div className="flex flex-col gap-2 border-t border-line px-4 py-3">
                          {items.map((permission) => (
                            <label
                              key={permission.id}
                              className="flex items-center gap-2 text-sm text-ink"
                            >
                              <input
                                type="checkbox"
                                checked={selected.has(permission.id)}
                                onChange={() => togglePermission(permission.id)}
                                className="h-4 w-4 accent-brand-accent"
                              />
                              {ACTION_LABELS[permission.action] ?? permission.action}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-auto flex items-center justify-end gap-3 border-t border-line p-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink-muted transition hover:bg-surface-hover hover:text-ink"
            >
              Ghairi
            </button>
            <button
              type="submit"
              disabled={saving || loading}
              className="rounded-full bg-brand-accent px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-accent-dark disabled:opacity-60"
            >
              {saving ? "Inahifadhi..." : "Hifadhi"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
