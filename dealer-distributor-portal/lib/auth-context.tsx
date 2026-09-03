import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { TabKey, TranslationKey } from "@gss/shared";
import { translate } from "@gss/shared";
import { storage } from "./storage";
import { cacheThemePreference } from "./theme";
import { api, LoginResponse } from "./api";

const STORAGE_KEY = "gss_auth";

interface AuthState {
  token: string;
  user: LoginResponse["user"];
  outlet: LoginResponse["outlet"];
}

interface AuthContextValue {
  auth: AuthState | null;
  loading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasTab: (tab: TabKey) => boolean;
  t: (key: TranslationKey) => string;
  updateUserPreferences: (partial: Partial<LoginResponse["user"]>) => Promise<void>;
  updateOutlet: (partial: Partial<LoginResponse["outlet"]>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    storage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!stored) return;
        const parsed = JSON.parse(stored) as AuthState;
        if (!Array.isArray(parsed.user?.tabs) || typeof parsed.user?.themeId !== "string") {
          // Cached session predates a field the app now depends on (e.g. tabs, themeId) — force a
          // fresh login rather than silently rendering with that field missing.
          storage.deleteItem(STORAGE_KEY);
          return;
        }
        cacheThemePreference(parsed.user.themeId, parsed.user.fontScale, parsed.user.customBackground, parsed.user.customTextColor);
        setAuth(parsed);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(phone: string, password: string) {
    const res = await api.login(phone, password);
    const next: AuthState = { token: res.token, user: res.user, outlet: res.outlet };
    await storage.setItem(STORAGE_KEY, JSON.stringify(next));
    cacheThemePreference(next.user.themeId, next.user.fontScale, next.user.customBackground, next.user.customTextColor);
    setAuth(next);
  }

  async function logout() {
    await storage.deleteItem(STORAGE_KEY);
    setAuth(null);
  }

  function hasTab(tab: TabKey): boolean {
    return auth?.user.tabs?.includes(tab) ?? false;
  }

  function t(key: TranslationKey): string {
    return translate(auth?.user.languageCode ?? "en", key);
  }

  async function updateUserPreferences(partial: Partial<LoginResponse["user"]>) {
    if (!auth) return;
    const next: AuthState = { ...auth, user: { ...auth.user, ...partial } };
    await storage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (partial.themeId !== undefined || partial.fontScale !== undefined || partial.customBackground !== undefined || partial.customTextColor !== undefined) {
      cacheThemePreference(next.user.themeId, next.user.fontScale, next.user.customBackground, next.user.customTextColor);
    }
    setAuth(next);
  }

  async function updateOutlet(partial: Partial<LoginResponse["outlet"]>) {
    if (!auth) return;
    const next: AuthState = { ...auth, outlet: { ...auth.outlet, ...partial } };
    await storage.setItem(STORAGE_KEY, JSON.stringify(next));
    setAuth(next);
  }

  return (
    <AuthContext.Provider value={{ auth, loading, login, logout, hasTab, t, updateUserPreferences, updateOutlet }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
