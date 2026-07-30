import { supabase } from "../../lib/supabaseClient";
import type { ReferenceBackup } from "../../types/backup";

// Jedyny plik, ktory wola RPC replace_reference_data (patrz migracja
// 0008_backup_restore.sql). Cala funkcja SQL dziala jako jedna
// transakcja -- blad w dowolnym miejscu cofa WSZYSTKO, wiec ten
// pojedynczy request.rpc(...) jest realnie transakcyjny (w
// przeciwienstwie do sekwencji osobnych .from() z przegladarki).
export async function replaceReferenceData(backup: ReferenceBackup): Promise<void> {
  const { error } = await supabase.rpc("replace_reference_data", { payload: backup });
  if (error) throw error;
}
