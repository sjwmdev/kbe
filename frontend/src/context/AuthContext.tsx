import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";
import { fetchProfile, loginAdmin } from "../lib/api";

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  /** True until the initial /me rehydration (or its absence) has resolved —
   * guards that redirect based on roleName must wait for this, since
   * roleName starts empty on every hard reload regardless of the real role. */
  profileLoading: boolean;
  roleName: string;
  permissions: string[];
  mustChangePassword: boolean;
  hasPermission: (key: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  /** Swaps in a freshly issued token + session info (e.g. after a password change). */
  applySession: (session: {
    token: string;
    role: string;
    permissions: string[];
    must_change_password: boolean;
  }) => void;
  logout: () => void;
}

const TOKEN_STORAGE_KEY = "kalour_admin_token";

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  );
  const [roleName, setRoleName] = useState("");
  const [permissions, setPermissions] = useState<string[]>([]);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  // Only true when there's a token to rehydrate — with no token there's
  // nothing to wait for, so it starts false in that case.
  const [profileLoading, setProfileLoading] = useState(token !== null);

  useEffect(() => {
    if (token) {
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      setRoleName("");
      setPermissions([]);
      setMustChangePassword(false);
    }
  }, [token]);

  // A token surviving a page refresh only carries the JWT itself — role/
  // permissions/must_change_password live in React state, so rehydrate them
  // from the server instead of silently losing RBAC context on reload.
  useEffect(() => {
    if (!token) {
      setProfileLoading(false);
      return;
    }
    let cancelled = false;

    fetchProfile(token)
      .then((profile) => {
        if (cancelled) return;
        setRoleName(profile.role);
        setPermissions(profile.permissions);
        setMustChangePassword(profile.must_change_password);
      })
      .catch(() => {
        // Invalid/expired token — clear it so ProtectedRoute sends them to login.
        if (!cancelled) setToken(null);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(email: string, password: string) {
    const session = await loginAdmin(email, password);
    setToken(session.token);
    setRoleName(session.role);
    setPermissions(session.permissions);
    setMustChangePassword(session.must_change_password);
    setProfileLoading(false);
  }

  function applySession(session: {
    token: string;
    role: string;
    permissions: string[];
    must_change_password: boolean;
  }) {
    setToken(session.token);
    setRoleName(session.role);
    setPermissions(session.permissions);
    setMustChangePassword(session.must_change_password);
    setProfileLoading(false);
  }

  function logout() {
    setToken(null);
  }

  const hasPermission = useCallback(
    (key: string) => permissions.includes(key),
    [permissions],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: token !== null,
      profileLoading,
      roleName,
      permissions,
      mustChangePassword,
      hasPermission,
      login,
      applySession,
      logout,
    }),
    [token, profileLoading, roleName, permissions, mustChangePassword, hasPermission],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
