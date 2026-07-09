import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  FileText,
  FolderOpen,
  Images,
  LayoutGrid,
  LogOut,
  Package,
  Plus,
  ScrollText,
  Settings,
  Shield,
  ShoppingCart,
  Tag,
  User,
  Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ThemeToggle } from "../ThemeToggle";
import { BrandLogo } from "../BrandLogo";

// While a forced password change is pending, only these two routes stay
// reachable — everything else redirects here. Matches the task's "show
// dashboard, block everything else until changed."
const PASSWORD_GATE_ALLOWED_PATHS = ["/admin", "/admin/profile"];

// permission: undefined means always visible (Dashboard); otherwise the nav
// entry only renders when the current user's role grants that key.
const navItems = [
  { to: "/admin", end: true, label: "Muhtasari", icon: LayoutGrid },
  { to: "/admin/products", end: false, label: "Bidhaa", icon: Package, permission: "products.view" },
  { to: "/admin/products/new", end: false, label: "Ongeza", icon: Plus, permission: "products.create" },
  { to: "/admin/orders", end: false, label: "Oda", icon: ShoppingCart, permission: "orders.view" },
];

const contentNavItems = [
  { to: "/admin/categories", end: false, label: "Kategoria", icon: Tag, permission: "categories.view" },
  { to: "/admin/pages", end: false, label: "Kurasa Tuli", icon: FileText, permission: "pages.view" },
  { to: "/admin/sliders", end: false, label: "Slaidi", icon: Images, permission: "sliders.view" },
  { to: "/admin/media", end: false, label: "Media", icon: FolderOpen, permission: "media.view" },
];

const managementNavItems = [
  { to: "/admin/roles", end: false, label: "Majukumu", icon: Shield, permission: "roles.view" },
  { to: "/admin/users", end: false, label: "Watumiaji", icon: Users, permission: "users.view" },
];

// No permission key on purpose — audit logs are STRICTLY SuperAdmin-only
// (enforced by the backend's RequireSuperAdmin middleware), so this is
// gated directly on roleName rather than the usual hasPermission check,
// which would imply it's a grantable permission other roles could get.
const auditLogNavItem = {
  to: "/admin/audit-logs",
  end: false,
  label: "Kumbukumbu za Mfumo",
  icon: ScrollText,
};

const settingsNavItem = {
  to: "/admin/settings",
  end: false,
  label: "Mipangilio",
  icon: Settings,
  permission: "settings.view",
};

export function AdminLayout() {
  const { logout, mustChangePassword, hasPermission, roleName } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isSuperAdmin = roleName === "SuperAdmin";

  function handleLogout() {
    logout();
    navigate("/admin/login", { replace: true });
  }

  if (mustChangePassword && !PASSWORD_GATE_ALLOWED_PATHS.includes(location.pathname)) {
    return <Navigate to="/admin/profile" replace />;
  }

  function visible<T extends { permission?: string }>(items: T[]): T[] {
    return items.filter((item) => !item.permission || hasPermission(item.permission));
  }

  const visibleNavItems = visible(navItems);
  const visibleContentNavItems = visible(contentNavItems);
  const visibleManagementNavItems = visible(managementNavItems);
  const settingsVisible = !settingsNavItem.permission || hasPermission(settingsNavItem.permission);

  // Locked nav items stay visible but greyed out and unclickable — the
  // AdminLayout guard above would redirect them right back anyway, but a
  // dead-looking link is more confusing than one that's visibly disabled.
  function isLocked(to: string) {
    return mustChangePassword && !PASSWORD_GATE_ALLOWED_PATHS.includes(to);
  }

  function linkClassFor(to: string) {
    return ({ isActive }: { isActive: boolean }) =>
      `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
        isLocked(to)
          ? "pointer-events-none opacity-40"
          : isActive
            ? "bg-brand-accent text-white"
            : "text-ink-muted hover:bg-surface-hover hover:text-ink"
      }`;
  }

  function mobileLinkClassFor(to: string) {
    return ({ isActive }: { isActive: boolean }) =>
      `flex flex-1 flex-col items-center gap-1 py-3 text-xs font-semibold ${
        isLocked(to)
          ? "pointer-events-none opacity-40"
          : isActive
            ? "text-brand-accent"
            : "text-ink-muted"
      }`;
  }

  // Sidebar icons stay neutral gray on light mode (matching every other
  // muted-gray icon in the app, e.g. the homepage category rail) and turn
  // solid white in dark mode for visibility against the near-black
  // background; the active nav pill already turns the whole row white, so
  // the icon just follows that in that state instead of the default.
  function iconClassFor(isActive: boolean) {
    return isActive ? "text-white" : "text-ink-muted dark:text-white";
  }

  return (
    <div className="flex min-h-screen bg-page">
      <aside className="hidden w-64 flex-col border-r border-line p-6 sm:flex">
        <div className="mb-10 flex items-center justify-between">
          <div className="flex flex-col items-center gap-0.5">
            <BrandLogo className="h-5 w-auto" />
            <span className="block text-sm font-extrabold tracking-wide text-ink">
              DASHIBODI
            </span>
          </div>
          <ThemeToggle />
        </div>
        <nav className="flex flex-col gap-2">
          {visibleNavItems.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClassFor(item.to)}>
              {({ isActive }) => (
                <>
                  <item.icon size={20} className={iconClassFor(isActive)} /> {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {visibleContentNavItems.length > 0 && (
          <>
            <p className="mb-2 mt-8 px-4 text-xs font-bold uppercase tracking-widest text-ink-muted">
              Maudhui
            </p>
            <nav className="flex flex-col gap-2">
              {visibleContentNavItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={linkClassFor(item.to)}>
                  {({ isActive }) => (
                    <>
                      <item.icon size={20} className={iconClassFor(isActive)} /> {item.label}
                    </>
                  )}
                </NavLink>
              ))}
            </nav>
          </>
        )}

        {(visibleManagementNavItems.length > 0 || isSuperAdmin) && (
          <>
            <p className="mb-2 mt-8 px-4 text-xs font-bold uppercase tracking-widest text-ink-muted">
              Usimamizi
            </p>
            <nav className="flex flex-col gap-2">
              {visibleManagementNavItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={linkClassFor(item.to)}>
                  {({ isActive }) => (
                    <>
                      <item.icon size={20} className={iconClassFor(isActive)} /> {item.label}
                    </>
                  )}
                </NavLink>
              ))}
              {isSuperAdmin && (
                <NavLink
                  to={auditLogNavItem.to}
                  end={auditLogNavItem.end}
                  className={linkClassFor(auditLogNavItem.to)}
                >
                  {({ isActive }) => (
                    <>
                      <auditLogNavItem.icon size={20} className={iconClassFor(isActive)} />{" "}
                      {auditLogNavItem.label}
                    </>
                  )}
                </NavLink>
              )}
            </nav>
          </>
        )}

        <div className="mt-auto flex flex-col gap-2">
          <NavLink to="/admin/profile" className={linkClassFor("/admin/profile")}>
            {({ isActive }) => (
              <>
                <User size={20} className={iconClassFor(isActive)} /> Wasifu Wangu
              </>
            )}
          </NavLink>
          {settingsVisible && (
            <NavLink
              to={settingsNavItem.to}
              end={settingsNavItem.end}
              className={linkClassFor(settingsNavItem.to)}
            >
              {({ isActive }) => (
                <>
                  <settingsNavItem.icon size={20} className={iconClassFor(isActive)} />{" "}
                  {settingsNavItem.label}
                </>
              )}
            </NavLink>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-ink-muted hover:bg-surface-hover"
          >
            <LogOut size={20} className="text-ink-muted dark:text-white" /> Toka
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col pb-16 sm:pb-0">
        <header className="flex items-center justify-between border-b border-line px-4 py-4 sm:hidden">
          <div className="flex items-center gap-2">
            <BrandLogo className="h-5 w-auto" />
            <span className="text-sm font-extrabold text-ink">Dashibodi</span>
          </div>
          <div className="flex items-center gap-3">
            <NavLink
              to="/admin/profile"
              aria-label="Wasifu Wangu"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-hover text-ink-muted"
            >
              <User size={16} />
            </NavLink>
            <ThemeToggle />
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Toka"
              className="text-ink-muted hover:text-brand-accent"
            >
              <LogOut size={20} />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-8">
          {mustChangePassword && location.pathname === "/admin" && (
            <div className="mb-6 flex items-center gap-3 rounded-xl border border-brand-accent/40 bg-brand-accent/10 p-4 text-sm text-ink">
              <AlertTriangle size={20} className="shrink-0 text-brand-accent" />
              <span>
                <span className="font-bold text-brand-accent">
                  Lazima ubadilishe nenosiri lako.
                </span>{" "}
                Sehemu nyingine za dashibodi zimefungwa hadi ubadilishe
                nenosiri lako la muda.{" "}
                <NavLink to="/admin/profile" className="font-bold underline">
                  Bofya hapa kubadilisha
                </NavLink>
              </span>
            </div>
          )}
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface sm:hidden">
        {visibleNavItems.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={mobileLinkClassFor(item.to)}>
            <item.icon size={20} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
