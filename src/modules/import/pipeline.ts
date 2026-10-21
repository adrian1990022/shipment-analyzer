import { fetchRoutes } from "../repository/routesRepository";
import { fetchSorterNameByTrasa } from "../repository/sorterRepository";
import { fetchRouteBase } from "../repository/routeBaseRepository";
import { analyzeImport } from "./analyzeImport";
import type { ImportResult } from "../../types/shipment";

// Re-eksport -- historyczne miejsce importu dla ImportScreen/testow.
export { PipelineError } from "./analyzeImport";

// Import w shipment: dane referencyjne z wlasnej bazy (routes +
// sorter_routes + baza przypisan tras), cala reszta w czystym analyzeImport -- tym samym, ktorego
// kopie ma kurier_appp (panel admina -> Import danych -> Przesylki).
export async function runImportPipeline(fileA: File, fileB: File, cutoff: Date): Promise<ImportResult> {
  return analyzeImport(fileA, fileB, cutoff, async () => {
    const [routes, sorterNameByTrasa, routeBase] = await Promise.all([
      fetchRoutes(),
      fetchSorterNameByTrasa(),
      fetchRouteBase(),
    ]);
    return { routes, sorterNameByTrasa, routeBase };
  });
}
