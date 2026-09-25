import { readWorkbookRows, readHeaders } from "../parser/parseWorkbook";
import { detectReportType, reportKindLabel } from "../parser/detectReportType";
import { parsePanoramaRows } from "../parser/parsePanorama";
import { parseSherlocRows } from "../parser/parseSherloc";
import { joinReports } from "../joiner/joinReports";
import { filterByScanCutoff } from "../dateFilter/filterByScanCutoff";
import { dedupeByShipmentId } from "../dedup/dedupeByShipmentId";
import { mapRoutes } from "../mapper/mapRoutes";
import { summarize } from "../analyzer/summarize";
import { fetchRoutes } from "../repository/routesRepository";
import { fetchSorterNameByTrasa } from "../repository/sorterRepository";
import type { ImportResult } from "../../types/shipment";

export class PipelineError extends Error {}

// Caly pipeline az do momentu akceptacji dziala WYLACZNIE w pamieci
// przegladarki -- nic nie jest zapisywane do Supabase (poza odczytem
// tabeli routes, potrzebnym do mapowania). Zapis nastepuje dopiero
// przez repository.replaceShipments, wywolane po akceptacji przez uzytkownika.
// cutoff = wpisana przy imporcie godzina minus 15 minut (buildScanCutoff).
export async function runImportPipeline(
  fileA: File,
  fileB: File,
  cutoff: Date
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

  const { rows: joinedRows, matchedCount, unmatchedCount } = joinReports(panoramaRows, sherlocRows);
  // Najpierw deduplikacja (reprezentant = najnowszy skan), potem regula
  // 15 minut -- liczy sie OSTATNI skan przesylki. Starsze przesylki, takze
  // z poprzednich dni, zostaja w wyniku (od 2026-09-25).
  const { rows: dedupedAll, occurrenceCounts } = dedupeByShipmentId(joinedRows);
  const { keptRows: dedupedRows, recentCount, noDateCount } = filterByScanCutoff(dedupedAll, cutoff);

  const [routes, sorterNameByTrasa] = await Promise.all([fetchRoutes(), fetchSorterNameByTrasa()]);
  const { shipments, unmappedChuteIds, unmappedRowCount } = mapRoutes(
    dedupedRows,
    routes,
    occurrenceCounts,
    sorterNameByTrasa
  );

  const summary = summarize({
    totalRows: panoramaRows.length,
    matchedRows: matchedCount,
    unmatchedRows: unmatchedCount,
    unmappedRows: unmappedRowCount,
    recentSkippedRows: recentCount,
    noDateRows: noDateCount,
    cutoffAt: cutoff.toISOString(),
    shipments,
    panoramaFilename,
    sherlocFilename,
  });

  return { summary, shipments, unmappedChuteIds };
}
