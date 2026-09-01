import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, getToken, getUser, saveAuth, clearAuth } from "./api";

type User = {
  id: string;
  email: string;
  full_name: string;
  role: "citizen" | "manager" | "admin";
  phone?: string;
  address?: {
    province?: string | null;
    district?: string | null;
    ward?: string | null;
    street?: string | null;
  } | null;
  created_at: string;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (
    email: string,
    password: string,
    full_name: string,
    phone?: string
  ) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (u: User | null) => void;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const u = await api("/auth/me");
      setUser(u);
    } catch {
      await clearAuth();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const cached = await getUser();
      if (cached) setUser(cached);
      await refresh();
    })();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const data = await api("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    await saveAuth(data.access_token, data.user);
    setUser(data.user);
    return data.user as User;
  };

  const register = async (
    email: string,
    password: string,
    full_name: string,
    phone?: string
  ) => {
    const data = await api("/auth/register", {
      method: "POST",
      body: { email, password, full_name, phone },
      auth: false,
    });
    await saveAuth(data.access_token, data.user);
    setUser(data.user);
    return data.user as User;
  };

  const logout = async () => {
    await clearAuth();
    setUser(null);
  };

  return (
    <Ctx.Provider value={{ user, loading, login, register, logout, refresh, setUser }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
