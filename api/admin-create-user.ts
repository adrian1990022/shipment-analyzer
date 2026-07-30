import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  AdminAuthError,
  isValidPassword,
  isValidUsername,
  requireAdmin,
  synthesizeEmail,
} from "../api-lib/adminAuth.js";
import { reportError } from "../api-lib/sentry.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { supabaseAdmin } = await requireAdmin(req.headers.authorization);

    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || !isValidUsername(username)) {
      res.status(400).json({
        error: "Nieprawidlowy login (litery, cyfry, kropka, podkreslnik, myslnik, 3-32 znaki).",
      });
      return;
    }
    if (typeof password !== "string" || !isValidPassword(password)) {
      res.status(400).json({ error: "Haslo musi miec co najmniej 8 znakow." });
      return;
    }

    const normalizedUsername = username.trim().toLowerCase();
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: synthesizeEmail(normalizedUsername),
      password,
      email_confirm: true,
    });

    if (createError || !created.user) {
      reportError(createError, { module: "api/admin-create-user", stage: "auth.admin.createUser" });
      res.status(400).json({ error: "Nie udalo sie utworzyc uzytkownika. Login moze byc juz zajety." });
      return;
    }

    // Nowy uzytkownik zawsze dostaje role "user" -- brak wyboru roli
    // w tym formularzu, celowo (spec).
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      id: created.user.id,
      username: normalizedUsername,
      role: "user",
    });

    if (profileError) {
      reportError(profileError, { module: "api/admin-create-user", stage: "profiles.insert" });
      // Bez profilu konto Auth byloby sierotą (uzytkownik istnieje, ale
      // apka nie wie jaka ma role) -- wycofaj utworzone konto.
      await supabaseAdmin.auth.admin.deleteUser(created.user.id);
      res.status(400).json({ error: "Nie udalo sie utworzyc uzytkownika." });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    reportError(err, { module: "api/admin-create-user", stage: "handler" });
    res.status(500).json({ error: "Blad serwera." });
  }
}
