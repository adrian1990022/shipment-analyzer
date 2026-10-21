import { readWorkbookRows, readHeaders } from "../parser/parseWorkbook";
import { detectReportType, reportKindLabel } from "../parser/detectReportType";
import { parsePanoramaRows } from "../parser/parsePanorama";
import { parseSherlocRows } from "../parser/parseSherloc";
import { joinReports } from "../joiner/joinReports";
import { filterByScanCutoff } from "../dateFilter/filterByScanCutoff";
import { dedupeByShipmentId } from "../dedup/dedupeByShipmentId";
import { mapRoutes } from "../mapper/mapRoutes";
import { summarize } from "../analyzer/summarize";
import { toLocalDateKey } from "../normalizer/normalize";
import type { ImportResult, RouteBaseRef, RouteRef } from "../../types/shipment";

export class PipelineError extends Error {}

// Dane referencyjne potrzebne do mapowania (routes + przypisania
// sortujacych + baza przypisan tras; routeBase = null, gdy bazy nie
// wgrano). Wstrzykiwane z zewnatrz jako funkcja ladujaca, zeby ten
// modul byl CZYSTY (bez Supabase): shipment laduje je z wlasnej bazy
// (pipeline.ts), a kurier_appp -- ktory ma kopie tego modulu
// (scripts/sync-shipment-pipeline.mjs w kurier_appp) -- przez swoja funkcje
// serwerowa. Wolana dopiero PO walidacji plikow: zly plik nie odpytuje bazy.
export interface ReferenceData {
  routes: RouteRef[];
  sorterNameByTrasa: Map<string, string>;
  routeBase: RouteBaseRef | null;
}

function formatDayMonthYear(dateKey: string): string {
  const [y, m, d] = dateKey.split("-");
  return `${d}.${m}.${y}`;
}

// Decyzja Adriana 2026-10-21: bez bazy przypisan tras albo z baza nie z
// dzisiaj (dzien wg zegara urzadzenia = czas polski) importu nie ma --
// trasy pochodza wylacznie z bazy. Ta sama regula jest w bazie
// (import_shipments, migracja 0016).
export function assertRouteBaseCurrent(routeBase: RouteBaseRef | null, now: Date = new Date()): RouteBaseRef {
  if (!routeBase) {
    throw new PipelineError("Baza przypisań tras nie została jeszcze wgrana — wgraj ją przed importem przesyłek.");
  }
  const baseDay = toLocalDateKey(routeBase.uploadedAt);
  if (baseDay !== toLocalDateKey(now.toISOString())) {
    throw new PipelineError(
      `Baza przypisań tras jest z ${baseDay ? formatDayMonthYear(baseDay) : "nieznanego dnia"} — wgraj dzisiejszą bazę przed importem przesyłek.`
    );
  }
  return routeBase;
}

// Caly pipeline az do momentu akceptacji dziala WYLACZNIE w pamieci
// przegladarki -- nic nie jest zapisywane. Zapis nastepuje dopiero po
// akceptacji przez uzytkownika (import_shipments, patrz importPayload.ts).
// cutoff = wpisana przy imporcie godzina minus 15 minut (buildScanCutoff).
export async function analyzeImport(
  fileA: File,
  fileB: File,
  cutoff: Date,
  loadReference: () => Promise<ReferenceData>,
  now: Date = new Date()
): Promise<ImportResult> {
  const rowsA = await readWorkbookRows(fileA);
  const rowsB = await readWorkbookRows(fileB);

  const detectedA = detectReportType(readHeaders(rowsA));
  const detectedB = detectReportType(readHeaders(rowsB));

  if (!detectedA) {
    throw new PipelineError(
      `Nie rozpoznano typu raportu w pliku "${fileA.name}". Sprawdz, czy plik zawiera kolumny raportu Panorama lub Sherloc.`
    );
  }
  if (!detectedB) {
    throw new PipelineError(
      `Nie rozpoznano typu raportu w pliku "${fileB.name}". Sprawdz, czy plik zawiera kolumny raportu Panorama lub Sherloc.`
    );
  }
  if (detectedA.kind === detectedB.kind) {
    throw new PipelineError(
      `Oba pliki rozpoznano jako ten sam raport (${reportKindLabel(detectedA.kind)}). Potrzebny jest jeden plik Panorama i jeden Sherloc.`
    );
  }

  const panoramaRaw = detectedA.kind === "panorama" ? rowsA : rowsB;
  const sherlocRaw = detectedA.kind === "sherloc" ? rowsA : rowsB;
  const panoramaFilename = detectedA.kind === "panorama" ? fileA.name : fileB.name;
  const sherlocFilename = detectedA.kind === "sherloc" ? fileA.name : fileB.name;

  const panoramaRows = parsePanoramaRows(panoramaRaw);
  const sherlocRows = parseSherlocRows(sherlocRaw);

  if (panoramaRows.length === 0) {
    throw new PipelineError(`Plik Panorama ("${panoramaFilename}") nie zawiera zadnych wierszy z Shipment ID.`);
  }

  const reference = await loadReference();
  const routeBase = assertRouteBaseCurrent(reference.routeBase, now);

  const { rows: joinedRows, matchedCount, unmatchedCount } = joinReports(panoramaRows, sherlocRows);
  // Najpierw deduplikacja (reprezentant = najnowszy skan), potem regula
  // 15 minut -- liczy sie OSTATNI skan przesylki. Starsze przesylki, takze
  // z poprzednich dni, zostaja w wyniku (od 2026-09-25).
  const { rows: dedupedAll, occurrenceCounts } = dedupeByShipmentId(joinedRows);
  const { keptRows: dedupedRows, recentCount, noDateCount } = filterByScanCutoff(dedupedAll, cutoff);

  const { shipments, przypisanieCounts, bezSortujacegoRows } = mapRoutes(
    dedupedRows,
    reference.routes,
    occurrenceCounts,
    reference.sorterNameByTrasa,
    routeBase.routeByAwb
  );

  const summary = summarize({
    totalRows: panoramaRows.length,
    matchedRows: matchedCount,
    unmatchedRows: unmatchedCount,
    // "Bez trasy" od 2026-10-21 = przesylki NIEPRZYPISANE (brak w bazie +
    // nieznana trasa) -- nie wypadaja juz z wyniku, kolumna imports.unmapped_rows.
    unmappedRows: przypisanieCounts.brak_w_bazie + przypisanieCounts.nieznana_trasa,
    recentSkippedRows: recentCount,
    noDateRows: noDateCount,
    cutoffAt: cutoff.toISOString(),
    shipments,
    przypisanieCounts,
    bezSortujacegoRows,
    routeBaseUploadedAt: routeBase.uploadedAt,
    panoramaFilename,
    sherlocFilename,
  });

  return { summary, shipments };
}
