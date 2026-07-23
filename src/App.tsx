import { useCallback, useEffect, useState } from "react";
import type { Grupa, Shipment } from "./types/shipment";
import { fetchShipments } from "./modules/repository/shipmentsRepository";
import { Dashboard } from "./modules/dashboard/Dashboard";
import { GroupView } from "./modules/dashboard/GroupView";
import { TrasaListView } from "./modules/dashboard/TrasaListView";
import { SorterTable } from "./modules/dashboard/SorterTable";
import { hasTrasaLevel } from "./modules/dashboard/grouping";
import { ImportScreen } from "./modules/import/ImportScreen";
import { RoutesAdmin } from "./modules/referenceData/RoutesAdmin";
import { useNavigation } from "./navigation/useNavigation";

type View =
  | { screen: "dashboard" }
  | { screen: "group"; grupa: Grupa }
  | { screen: "sorter"; grupa: Grupa; sortujacy: string }
  | { screen: "trasa"; grupa: Grupa; sortujacy: string; trasa: string }
  | { screen: "import" }
  | { screen: "reference-data" };

const HOME: View = { screen: "dashboard" };

export default function App() {
  const nav = useNavigation<View>(HOME);
  const view = nav.current;
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
        <button className="nav-link" onClick={() => nav.navigate({ screen: "dashboard" })}>
          Dashboard
        </button>
        <button className="nav-link" onClick={() => nav.navigate({ screen: "import" })}>
          Import
        </button>
        <button className="nav-link" onClick={() => nav.navigate({ screen: "reference-data" })}>
          Dane referencyjne
        </button>
      </nav>

      {loadError && <p className="error">{loadError}</p>}

      {view.screen === "dashboard" && (
        <Dashboard
          shipments={shipments}
          onSelectGrupa={(grupa) => nav.navigate({ screen: "group", grupa })}
        />
      )}

      {view.screen === "group" && (
        <GroupView
          shipments={shipments}
          grupa={view.grupa}
          onSelectSortujacy={(sortujacy) =>
            nav.navigate({ screen: "sorter", grupa: view.grupa, sortujacy })
          }
          onBack={nav.goBack}
        />
      )}

      {/* P1/P3: sortujacy ma jawne przypisanie bramy -> dodatkowy poziom
          "trasa" przed tabela. P2/COY004: sortujacy nadal wyliczany z 3.
          litery trasy -> od razu tabela, jak dotychczas. */}
      {view.screen === "sorter" &&
        (hasTrasaLevel(view.grupa) ? (
          <TrasaListView
            shipments={shipments}
            grupa={view.grupa}
            sortujacy={view.sortujacy}
            onSelectTrasa={(trasa) =>
              nav.navigate({ screen: "trasa", grupa: view.grupa, sortujacy: view.sortujacy, trasa })
            }
            onBack={nav.goBack}
          />
        ) : (
          <SorterTable
            shipments={shipments}
            grupa={view.grupa}
            sortujacy={view.sortujacy}
            onBack={nav.goBack}
          />
        ))}

      {view.screen === "trasa" && (
        <SorterTable
          shipments={shipments}
          grupa={view.grupa}
          sortujacy={view.sortujacy}
          trasa={view.trasa}
          onBack={nav.goBack}
        />
      )}

      {view.screen === "import" && (
        <ImportScreen
          onSaved={() => {
            reload();
            nav.replace({ screen: "dashboard" });
          }}
        />
      )}

      {view.screen === "reference-data" && <RoutesAdmin />}
    </div>
  );
}
