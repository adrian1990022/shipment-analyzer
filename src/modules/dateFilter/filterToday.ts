import type { JoinedRow } from "../joiner/joinReports";
import { isSameLocalDay, parseFlexibleDate } from "../normalizer/normalize";

export interface DateFilterResult {
  todayRows: JoinedRow[];
  todayCount: number;
  skippedCount: number;
}

// Analizujemy tylko rekordy z biezacego dnia (Last Phy Cp dt), wg zegara
// urzadzenia, na ktorym wykonywany jest import.
export function filterToday(rows: JoinedRow[], referenceDate: Date = new Date()): DateFilterResult {
  let todayCount = 0;
  let skippedCount = 0;

  const todayRows = rows.filter((row) => {
    const parsed = parseFlexibleDate(row.panorama.lastPhyCpDt);
    const isToday = parsed !== null && isSameLocalDay(parsed, referenceDate);
    if (isToday) todayCount += 1;
    else skippedCount += 1;
    return isToday;
  });

  return { todayRows, todayCount, skippedCount };
}
