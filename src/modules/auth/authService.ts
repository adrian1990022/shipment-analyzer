import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../lib/supabaseClient";

// Jedyny modul poza lib/supabaseClient.ts, ktory dotyka supabase.auth.*.
// AuthProvider korzysta wylacznie z tych funkcji -- nigdy z klienta
// Supabase bezposrednio.

// Login -> syntetyczny e-mail, bo Supabase Auth wymaga e-maila, a
// logujemy sie loginem. To samo przeksztalcenie zyje po stronie
// serwera w api-lib/adminAuth.ts (tworzenie/edycja kont) -- musza sie
// zgadzac, inaczej login przestalby dzialac.
export function synthesizeEmail(username: string): string {
  return `${username.trim().toLowerCase()}@shipment-analyzer.local`;
}

export async function login(username: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: synthesizeEmail(username),
    password,
  });
  if (error) throw error;
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback: (session: Session | null) => void): () => void {
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => callback(session));
  return () => subscription.unsubscribe();
}
