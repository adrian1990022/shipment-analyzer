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
import { SortersAdmin } from "./modules/sorters/SortersAdmin";
import { SorterAddScreen } from "./modules/sorters/SorterAddScreen";
import { SorterEditScreen } from "./modules/sorters/SorterEditScreen";
import { UsersAdmin } from "./modules/users/UsersAdmin";
import { AuthProvider, useAuth } from "./modules/auth/AuthProvider";
import { LoginScreen } from "./modules/auth/LoginScreen";
import { AdminRoute } from "./modules/auth/AdminRoute";
import { useNavigation } from "./navigation/useNavigation";
import { ErrorBoundary } from "./modules/monitoring/ErrorBoundary";

type View =
  | { screen: "dashboard" }
  | { screen: "group"; grupa: Grupa }
  | { screen: "sorter"; grupa: Grupa; sortujacy: string }
  | { screen: "trasa"; grupa: Grupa; sortujacy: string; trasa: string }
  | { screen: "import" }
  | { screen: "reference-data" }
  | { screen: "sorters" }
  | { screen: "sorters-add" }
  | { screen: "sorters-edit"; sorterId: number }
  | { screen: "users" };

const HOME: View = { screen: "dashboard" };

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </ErrorBoundary>
  );
}

function AppShell() {
  const { session, profile, loading, isAdmin, logout } = useAuth();
  const nav = useNavigation<View>(HOME);
  const view = nav.current;
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setShipments(await fetchShipments());
      setLoadError(null);
    } catch {
      setLoadError("Nie udalo sie wczytac danych z Supabase.");
    }
  }, []);

  // Laduje dane dopiero po zalogowaniu i czysci je po wylogowaniu --
  // inaczej w tej samej karcie po zmianie konta widac by bylo dane
  // poprzedniego uzytkownika. Zaleznosc to id usera (stabilny), nie caly
  // obiekt session -- ten zmienia sie tez przy cichym odswiezeniu tokenu,
  // co nie powinno wywolywac ponownego fetchowania.
  const userId = session?.user.id ?? null;
  useEffect(() => {
    if (userId) {
      reload();
    } else {
      setShipments([]);
    }
  }, [userId, reload]);

  // Reset nawigacji po wylogowaniu, zeby kolejne logowanie (nawet innym
  // kontem, w tej samej karcie) zaczynalo od Dashboardu, a nie od
  // jakiegos glebokiego ekranu sprzed wylogowania.
  useEffect(() => {
    if (!userId) nav.replace(HOME);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) {
    return (
      <div className="app">
        <p className="hint">Wczytywanie...</p>
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (!profile) {
    return (
      <div className="app">
        <p className="error">
          Zalogowano, ale nie znaleziono profilu użytkownika. Skontaktuj się z administratorem.
        </p>
        <button onClick={logout}>Wyloguj</button>
      </div>
    );
  }

  function goDashboard() {
    nav.replace({ screen: "dashboard" });
  }

  return (
    <div className="app">
      <div className="topbar">
        <nav className="nav">
          <button className="nav-link" onClick={() => nav.navigate({ screen: "dashboard" })}>
            Dashboard
          </button>
          {isAdmin && (
            <>
              <button className="nav-link" onClick={() => nav.navigate({ screen: "import" })}>
                Import
              </button>
              <button className="nav-link" onClick={() => nav.navigate({ screen: "reference-data" })}>
                Dane referencyjne
              </button>
              <button className="nav-link" onClick={() => nav.navigate({ screen: "sorters" })}>
                Sortujący
              </button>
              <button className="nav-link" onClick={() => nav.navigate({ screen: "users" })}>
                Użytkownicy
              </button>
            </>
          )}
        </nav>

        <details className="user-menu">
          <summary>
            👤 {profile.username} <span className="user-role">— {isAdmin ? "Administrator" : "Użytkownik"}</span>
          </summary>
          <div className="user-menu-dropdown">
            <button className="secondary" onClick={logout}>
              Wyloguj
            </button>
          </div>
        </details>
      </div>

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
        <AdminRoute onDenied={goDashboard}>
          <ImportScreen
            onSaved={() => {
              reload();
              nav.replace({ screen: "dashboard" });
            }}
          />
        </AdminRoute>
      )}

      {view.screen === "reference-data" && (
        <AdminRoute onDenied={goDashboard}>
          <RoutesAdmin />
        </AdminRoute>
      )}

      {view.screen === "sorters" && (
        <AdminRoute onDenied={goDashboard}>
          <SortersAdmin
            onAdd={() => nav.navigate({ screen: "sorters-add" })}
            onEdit={(sorterId) => nav.navigate({ screen: "sorters-edit", sorterId })}
          />
        </AdminRoute>
      )}

      {view.screen === "sorters-add" && (
        <AdminRoute onDenied={goDashboard}>
          <SorterAddScreen onDone={nav.goBack} onBack={nav.goBack} />
        </AdminRoute>
      )}

      {view.screen === "sorters-edit" && (
        <AdminRoute onDenied={goDashboard}>
          <SorterEditScreen sorterId={view.sorterId} onDone={nav.goBack} onBack={nav.goBack} />
        </AdminRoute>
      )}

      {view.screen === "users" && (
        <AdminRoute onDenied={goDashboard}>
          <UsersAdmin />
        </AdminRoute>
      )}
    </div>
  );
}
