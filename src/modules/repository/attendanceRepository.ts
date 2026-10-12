import { supabase } from "../../lib/supabaseClient";
import { reportError } from "../monitoring/reportError";
import type { AttendanceEntry } from "../attendance/parseAttendance";

export interface AttendanceMonthInfo {
  month: string; // "RRRR-MM-01"
  lastDay: string; // "RRRR-MM-DD"
  importedAt: string;
}

// Zapis CALEGO miesiaca listy obecnosci naraz (funkcja bazy
// import_sorter_attendance, migracja 0015 -- wszystko albo nic). Zwraca
// liczbe zapisanych wpisow.
export async function saveAttendanceMonth(month: string, lastDay: string, entries: AttendanceEntry[]): Promise<number> {
  const { data, error } = await supabase.rpc("import_sorter_attendance", {
    p_month: month,
    p_last_day: lastDay,
    p_entries: entries,
  });
  if (error) {
    reportError(error, { module: "attendanceRepository", stage: "saveAttendanceMonth" });
    throw error;
  }
  return data as number;
}

// Wgrane miesiace (biezacy + poprzedni -- retencja), najnowszy pierwszy.
export async function fetchAttendanceMonths(): Promise<AttendanceMonthInfo[]> {
  const { data, error } = await supabase
    .from("sorter_attendance_months")
    .select("month, last_day, imported_at")
    .order("month", { ascending: false });
  if (error) {
    reportError(error, { module: "attendanceRepository", stage: "fetchAttendanceMonths" });
    throw error;
  }
  return (data ?? []).map((r) => ({ month: r.month, lastDay: r.last_day, importedAt: r.imported_at }));
}
