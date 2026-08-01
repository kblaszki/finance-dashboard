import { useCallback, useContext, useEffect, useMemo, useState, createContext } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { AuthUser } from "../api/authApi";
import { fetchMe, login as apiLogin, logoutLocal, register as apiRegister } from "../api/authApi";
import { getAuthToken, setUnauthorizedHandler } from "../api/client";

const DEFAULT_AFTER_AUTH = "/dashboard";

type AuthLocationState = {
  from?: string;
};

function resolveReturnPath(state: AuthLocationState | null): string {
  const from = state?.from;
  if (from && from.startsWith("/") && !from.startsWith("//")) {
    return from;
  }
  return DEFAULT_AFTER_AUTH;
}

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (login: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const logout = useCallback(() => {
    logoutLocal();
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logoutLocal();
      setUser(null);
      const returnTo = window.location.pathname + window.location.search;
      const safeReturn =
        returnTo.startsWith("/") && !returnTo.startsWith("//") && returnTo !== "/login"
          ? returnTo
          : undefined;
      navigate("/login", {
        replace: true,
        state: safeReturn ? { from: safeReturn } : undefined,
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate]);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const me = await fetchMe();
        setUser(me);
      } catch {
        logoutLocal();
        setUser(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const refreshUser = useCallback(async () => {
    const me = await fetchMe();
    setUser(me);
  }, []);

  const login = useCallback(
    async (loginId: string, password: string) => {
      const { user: loggedIn } = await apiLogin(loginId, password);
      setUser(loggedIn);
      const returnPath = resolveReturnPath(location.state as AuthLocationState | null);
      navigate(returnPath, { replace: true });
    },
    [navigate, location.state],
  );

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      const { user: registered } = await apiRegister(email, username, password);
      setUser(registered);
      navigate(DEFAULT_AFTER_AUTH, { replace: true });
    },
    [navigate],
  );

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshUser }),
    [user, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
