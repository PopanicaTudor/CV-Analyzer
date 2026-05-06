import { createContext, useContext, useEffect, useMemo, useState } from "react";

import { api, clearAuth, getStoredTokens, getStoredUser, storeAuth } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());
  const [tokens, setTokens] = useState(() => getStoredTokens());

  useEffect(() => {
    const syncAuth = () => {
      setUser(getStoredUser());
      setTokens(getStoredTokens());
    };
    window.addEventListener("cvap-auth-change", syncAuth);
    return () => window.removeEventListener("cvap-auth-change", syncAuth);
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(tokens?.access),
      async login(identifier, password) {
        const isEmail = identifier.includes("@");
        const payload = isEmail ? { email: identifier, password } : { username: identifier, password };
        const data = await api.login(payload);
        storeAuth({ access: data.access, refresh: data.refresh }, data.user);
        setUser(data.user);
        setTokens({ access: data.access, refresh: data.refresh });
      },
      async register(payload) {
        const data = await api.register(payload);
        storeAuth({ access: data.access, refresh: data.refresh }, data.user);
        setUser(data.user);
        setTokens({ access: data.access, refresh: data.refresh });
      },
      logout() {
        clearAuth();
        setUser(null);
        setTokens(null);
      },
    }),
    [tokens?.access, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
