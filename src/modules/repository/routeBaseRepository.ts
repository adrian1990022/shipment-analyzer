import { supabase } from "../../lib/supabaseClient";
import { fetchAllPages } from "../../lib/fetchAllPages";
import { reportError } from "../monitoring/reportError";
import type { RouteBaseRef, RouteBaseStatus } from "../../types/shipment";
import type { RouteAssignment } from "../routeBase/parseRouteBase";

// Baza przypisan tras (migracja 0016): route_assignments + jeden wiersz
// route_assignment_meta. Tylko admin (RLS).

interface MetaRow {
  uploaded_at: string;
  filename: string | null;
  record_count: number;
  zrodlo: "shipment" | "kurier";
}

export async function fetchRouteBaseStatus(): Promise<RouteBaseStatus | null> {
  const { data, error } = await supabase
    .from("route_assignment_meta")
    .select("uploaded_at, filename, record_count, zrodlo")
    .maybeSingle();
  if (error) {
    reportError(error, { module: "routeBaseRepository", stage: "fetchRouteBaseStatus" });
    throw error;
  }
  if (!data) return null;
  const row = data as MetaRow;
  return {
    uploadedAt: row.uploaded_at,
    filename: row.filename,
    recordCount: row.record_count,
    zrodlo: row.zrodlo,
  };
}

// Cala baza do pamieci -- raz na import (4-6 tys. par, stronami po 1000),
// dopasowanie dzieje sie potem w mapRoutes bez zapytan per przesylka.
// null = baza jeszcze nie wgrana.
export async function fetchRouteBase(): Promise<RouteBaseRef | null> {
  const status = await fetchRouteBaseStatus();
  if (!status) return null;
  let rows: unknown[];
  try {
    rows = await fetchAllPages(() => supabase.from("route_assignments").select("awb, route").order("awb"));
  } catch (error) {
    reportError(error, { module: "routeBaseRepository", stage: "fetchRouteBase" });
    throw error;
  }
  const routeByAwb = new Map<string, string>();
  for (const row of rows as { awb: string; route: string }[]) routeByAwb.set(row.awb, row.route);
  return { routeByAwb, uploadedAt: status.uploadedAt };
}

// Podmiana CALEJ bazy jednym wywolaniem (replace_route_assignments --
// wszystko albo nic; przy bledzie poprzednia baza zostaje). Zwraca liczbe
// zapisanych rekordow.
export async function replaceRouteBase(filename: string, assignments: RouteAssignment[]): Promise<number> {
  const { data, error } = await supabase.rpc("replace_route_assignments", {
    p_filename: filename,
    p_rows: assignments,
    p_zrodlo: "shipment",
  });
  if (error) {
    reportError(error, { module: "routeBaseRepository", stage: "replaceRouteBase" });
    throw error;
  }
  return data as number;
}
