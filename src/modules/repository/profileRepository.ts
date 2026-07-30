import { supabase } from "../../lib/supabaseClient";
import { reportError } from "../monitoring/reportError";
import type { Profile } from "../../types/auth";

interface ProfileRow {
  id: string;
  username: string;
  role: "admin" | "user";
  created_at: string;
  updated_at: string;
}

function fromRow(row: ProfileRow): Profile {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, role, created_at, updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    reportError(error, { module: "profileRepository", stage: "fetchOwnProfile" });
    throw error;
  }
  return data ? fromRow(data as ProfileRow) : null;
}

// Do panelu "Uzytkownicy" -- RLS i tak ograniczy zwyklego usera do
// wlasnego wiersza, nawet gdyby to wywolal (patrz profiles_select_admin
// w 0006_auth.sql), wiec brak tu dodatkowej logiki uprawnien.
export async function fetchAllProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, role, created_at, updated_at")
    .order("username");
  if (error) {
    reportError(error, { module: "profileRepository", stage: "fetchAllProfiles" });
    throw error;
  }
  return (data ?? []).map((row) => fromRow(row as ProfileRow));
}
