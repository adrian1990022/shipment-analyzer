import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Ten plik NIE jest w katalogu api/, wiec Vercel go nie routuje jako
// osobny endpoint -- to wspolna biblioteka dla api/admin-*.ts.
//
// SUPABASE_SERVICE_ROLE_KEY istnieje WYLACZNIE tutaj (zmienna
// srodowiskowa Vercel, serwerowa, nigdy nie trafia do bundla klienckiego).
// Zaden komponent React ani modul we src/ nie ma do niej dostepu.

export class AdminAuthError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`adminAuth: brak zmiennej srodowiskowej ${name}`);
    throw new Error(`Brak zmiennej srodowiskowej ${name}`);
  }
  return value;
}

function createAdminClient(): SupabaseClient {
  const url = requiredEnv("VITE_SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Weryfikuje, ze wywolujacy ma wazna sesje Supabase ORAZ role admin w
// profiles, zanim jakikolwiek endpoint api/admin-*.ts wykona operacje
// uprzywilejowana. Rzuca AdminAuthError (401/403) w przeciwnym razie.
export async function requireAdmin(
  authorizationHeader: string | undefined
): Promise<{ supabaseAdmin: SupabaseClient; callerId: string }> {
  if (!authorizationHeader?.startsWith("Bearer ")) {
    throw new AdminAuthError(401, "Brak autoryzacji.");
  }
  const jwt = authorizationHeader.slice("Bearer ".length);
  const supabaseAdmin = createAdminClient();

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(jwt);
  if (userError || !userData.user) {
    console.error("adminAuth: getUser failed", userError);
    throw new AdminAuthError(401, "Sesja wygasla lub jest nieprawidlowa.");
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .single();

  if (profileError || profile?.role !== "admin") {
    console.error("adminAuth: profile lookup failed lub brak roli admin", profileError, profile);
    throw new AdminAuthError(403, "Brak uprawnien administratora.");
  }

  return { supabaseAdmin, callerId: userData.user.id };
}

// Login -> syntetyczny e-mail. Supabase Auth wymaga e-maila, a chcemy
// logowania loginem -- to jedyne miejsce, gdzie ten szczegol istnieje
// (patrz tez src/modules/auth/authService.ts, ktory robi to samo po
// stronie klienta przy logowaniu).
export function synthesizeEmail(username: string): string {
  return `${username.trim().toLowerCase()}@shipment-analyzer.local`;
}

const USERNAME_PATTERN = /^[a-z0-9._-]{3,32}$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_PATTERN.test(username.trim().toLowerCase());
}

export function isValidPassword(password: string): boolean {
  return typeof password === "string" && password.length >= 8;
}
