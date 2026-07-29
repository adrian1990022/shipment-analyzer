import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import * as authService from "./authService";
import { fetchOwnProfile } from "../repository/profileRepository";
import type { Profile } from "../../types/auth";

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  // Prawda podczas poczatkowego sprawdzania sesji ORAZ przy kazdej
  // zmianie (login/logout) -- dopoki nie wiemy kim jest uzytkownik (i
  // jaka ma role), UI nie powinien pokazywac ani apki, ani ekranu
  // logowania.
  loading: boolean;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    // Jedna funkcja obslugujaca zarowno pierwsze sprawdzenie sesji przy
    // starcie, jak i kazde kolejne zdarzenie logowania/wylogowania --
    // jedna sciezka kodu, zeby stan nigdy sie nie rozjechal (ten sam
    // wzorzec co w navigation/useNavigation.ts).
    async function syncProfile(nextSession: Session | null) {
      setLoading(true);
      if (!nextSession) {
        if (!cancelled) {
          setSession(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      try {
        const p = await fetchOwnProfile(nextSession.user.id);
        if (!cancelled) {
          setSession(nextSession);
          setProfile(p);
        }
      } catch {
        if (!cancelled) {
          setSession(nextSession);
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    authService.getSession().then(syncProfile);
    const unsubscribe = authService.onAuthStateChange(syncProfile);

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  async function login(username: string, password: string) {
    await authService.login(username, password);
    // Stan (session/profile) aktualizuje sie sam przez onAuthStateChange
    // powyzej -- nie duplikujemy tu logiki.
  }

  async function logout() {
    await authService.logout();
  }

  const value: AuthContextValue = {
    session,
    profile,
    loading,
    isAdmin: profile?.role === "admin",
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth musi byc uzyty wewnatrz AuthProvider.");
  return ctx;
}
