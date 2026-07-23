import { supabase } from "../../lib/supabaseClient";
import type { RouteRef } from "../../types/shipment";

interface RouteRow {
  id: number;
  chute_id: string;
  trasa: string;
  grupa: "P1" | "P2" | "P3";
  sortujacy: string | null;
  created_at: string;
  updated_at: string;
}

function fromRow(row: RouteRow): RouteRef {
  return {
    id: row.id,
    chuteId: row.chute_id,
    trasa: row.trasa,
    grupa: row.grupa,
    sortujacy: row.sortujacy,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchRoutes(): Promise<RouteRef[]> {
  const { data, error } = await supabase
    .from("routes")
    .select("id, chute_id, trasa, grupa, sortujacy, created_at, updated_at")
    .order("chute_id", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => fromRow(row as RouteRow));
}

export async function upsertRoute(input: {
  chuteId: string;
  trasa: string;
  grupa: "P1" | "P2" | "P3";
  sortujacy?: string | null;
}): Promise<void> {
  const { error } = await supabase.from("routes").upsert(
    {
      chute_id: input.chuteId,
      trasa: input.trasa,
      grupa: input.grupa,
      sortujacy: input.sortujacy?.trim() || null,
    },
    { onConflict: "chute_id" }
  );
  if (error) throw error;
}

export async function deleteRoute(id: number): Promise<void> {
  const { error } = await supabase.from("routes").delete().eq("id", id);
  if (error) throw error;
}
