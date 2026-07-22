import { useCallback, useEffect, useState } from "react";
import type { Grupa, Shipment } from "./types/shipment";
import { fetchShipments } from "./modules/repository/shipmentsRepository";
import { Dashboard } from "./modules/dashboard/Dashboard";
import { GroupView } from "./modules/dashboard/GroupView";
import { SorterTable } from "./modules/dashboard/SorterTable";
import { ImportScreen } from "./modules/import/ImportScreen";
import { RoutesAdmin } from "./modules/referenceData/RoutesAdmin";

type View =
  | { screen: "dashboard" }
  | { screen: "group"; grupa: Grupa }
  | { screen: "sorter"; grupa: Grupa; sortujacy: string }
  | { screen: "import" }
  | { screen: "reference-data" };

export default function App() {
  const [view, setView] = useState<View>({ screen: "dashboard" });
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setShipments(await fetchShipments());
      setLoadError(null);
    } catch {
      setLoadError("Nie udalo sie wczytac danych z Supabase. Sprawdz konfiguracje .env.");
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="app">
      <nav className="nav">
        <button className="nav-link" onClick={() => setView({ screen: "dashboard" })}>
          Dashboard
        </button>
        <button className="nav-link" onClick={() => setView({ screen: "import" })}>
          Import
        </button>
        <button className="nav-link" onClick={() => setView({ screen: "reference-data" })}>
          Dane referencyjne
        </button>
      </nav>

      {loadError && <p className="error">{loadError}</p>}

      {view.screen === "dashboard" && (
        <Dashboard shipments={shipments} onSelectGrupa={(grupa) => setView({ screen: "group", grupa })} />
      )}

      {view.screen === "group" && (
        <GroupView
          shipments={shipments}
          grupa={view.grupa}
          onSelectSortujacy={(sortujacy) => setView({ screen: "sorter", grupa: view.grupa, sortujacy })}
          onBack={() => setView({ screen: "dashboard" })}
        />
      )}

      {view.screen === "sorter" && (
        <SorterTable
          shipments={shipments}
          grupa={view.grupa}
          sortujacy={view.sortujacy}
          onBack={() => setView({ screen: "group", grupa: view.grupa })}
        />
      )}

      {view.screen === "import" && (
        <ImportScreen
          onSaved={() => {
            reload();
            setView({ screen: "dashboard" });
          }}
        />
      )}

      {view.screen === "reference-data" && <RoutesAdmin />}
    </div>
  );
}
