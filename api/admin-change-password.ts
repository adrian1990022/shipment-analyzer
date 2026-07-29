import type { VercelRequest, VercelResponse } from "@vercel/node";
import { AdminAuthError, isValidPassword, requireAdmin } from "../api-lib/adminAuth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { supabaseAdmin } = await requireAdmin(req.headers.authorization);

    const { userId, newPassword } = req.body ?? {};
    if (typeof userId !== "string" || !userId) {
      res.status(400).json({ error: "Brak identyfikatora uzytkownika." });
      return;
    }
    if (typeof newPassword !== "string" || !isValidPassword(newPassword)) {
      res.status(400).json({ error: "Haslo musi miec co najmniej 8 znakow." });
      return;
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });
    if (error) {
      res.status(400).json({ error: "Nie udalo sie zmienic hasla." });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Blad serwera." });
  }
}
