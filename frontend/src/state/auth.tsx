import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import type { AuthUser } from "../api/authApi";
import { fetchMe, login as apiLogin, logoutLocal, register as apiRegister } from "../api/authApi";
import { getAuthToken, setUnauthorizedHandler } from "../api/client";

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider(props: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    logoutLocal();
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      logoutLocal();
      setUser(null);
      navigate("/login", { replace: true });
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

  const login = useCallback(async (email: string, password: string) => {
    const { user: loggedIn } = await apiLogin(email, password);
    setUser(loggedIn);
    navigate("/", { replace: true });
  }, [navigate]);

  const register = useCallback(async (email: string, password: string) => {
    const { user: registered } = await apiRegister(email, password);
    setUser(registered);
    navigate("/", { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout }),
    [user, loading, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{props.children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
