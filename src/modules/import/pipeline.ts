import { readWorkbookRows, readHeaders } from "../parser/parseWorkbook";
import { detectReportType, reportKindLabel } from "../parser/detectReportType";
import { parsePanoramaRows } from "../parser/parsePanorama";
import { parseSherlocRows } from "../parser/parseSherloc";
import { joinReports } from "../joiner/joinReports";
import { filterToday } from "../dateFilter/filterToday";
import { mapRoutes } from "../mapper/mapRoutes";
import { summarize } from "../analyzer/summarize";
import { fetchRoutes } from "../repository/routesRepository";
import type { ImportResult } from "../../types/shipment";

export class PipelineError extends Error {}

// Caly pipeline az do momentu akceptacji dziala WYLACZNIE w pamieci
// przegladarki -- nic nie jest zapisywane do Supabase (poza odczytem
// tabeli routes, potrzebnym do mapowania). Zapis nastepuje dopiero
// przez repository.replaceShipments, wywolane po akceptacji przez uzytkownika.
export async function runImportPipeline(
  fileA: File,
  fileB: File
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
  const { todayRows } = filterToday(joinedRows);

  const routes = await fetchRoutes();
  const { shipments, unmappedChuteIds, unmappedRowCount } = mapRoutes(todayRows, routes);

  const summary = summarize({
    totalRows: panoramaRows.length,
    matchedRows: matchedCount,
    unmatchedRows: unmatchedCount,
    unmappedRows: unmappedRowCount,
    shipments,
    panoramaFilename,
    sherlocFilename,
  });

  return { summary, shipments, unmappedChuteIds };
}
