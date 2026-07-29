import type { VercelRequest, VercelResponse } from "@vercel/node";
import { AdminAuthError, requireAdmin } from "../api-lib/adminAuth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { supabaseAdmin, callerId } = await requireAdmin(req.headers.authorization);

    const { userId } = req.body ?? {};
    if (typeof userId !== "string" || !userId) {
      res.status(400).json({ error: "Brak identyfikatora uzytkownika." });
      return;
    }
    if (userId === callerId) {
      res.status(400).json({ error: "Nie mozesz usunac wlasnego konta." });
      return;
    }

    // profiles ma "on delete cascade" na auth.users.id -- wiersz profilu
    // znika sam, bez osobnego zapytania.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) {
      res.status(400).json({ error: "Nie udalo sie usunac uzytkownika." });
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
