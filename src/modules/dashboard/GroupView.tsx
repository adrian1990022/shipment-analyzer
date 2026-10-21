import type { Grupa, Shipment } from "../../types/shipment";
import { shipmentsInGrupa, sorterLabel, sortersInGrupa, trasyInSorter } from "./grouping";

// Kafelki wewnatrz grupy: P1/P2/P3 -- sortujacy; COY004 -- trasy (2026-10-21,
// trasy "O" nie maja sortujacych). NIEPRZYPISANE tu nie trafia (od razu
// lista, patrz groupLayout).
export function GroupView({
  shipments,
  grupa,
  handledMap,
  onSelectSortujacy,
  onSelectTrasa,
  onBack,
}: {
  shipments: Shipment[];
  grupa: Grupa;
  handledMap: Map<string, boolean>;
  onSelectSortujacy: (sortujacy: string) => void;
  onSelectTrasa: (trasa: string) => void;
  onBack: () => void;
}) {
  const inGroup = shipmentsInGrupa(shipments, grupa);

  if (grupa === "COY004") {
    const trasy = trasyInSorter(inGroup, handledMap);
    return (
      <div className="screen">
        <button className="back" onClick={onBack}>
          ← Dashboard
        </button>
        <h1>Grupa {grupa}</h1>
        {trasy.length === 0 && <p className="hint">Brak przesylek w tej grupie.</p>}
        <div className="tiles">
          {trasy.map(({ trasa, count, allHandled }) => (
            <button
              key={trasa}
              className={`tile ${allHandled ? "tile--handled" : "tile--pending"}`}
              onClick={() => onSelectTrasa(trasa)}
            >
              <span className="tile-title">{trasa}</span>
              <span className="tile-count">{count}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const sorters = sortersInGrupa(inGroup);

  return (
    <div className="screen">
      <button className="back" onClick={onBack}>
        ← Dashboard
      </button>
      <h1>Grupa {grupa}</h1>
      {sorters.length === 0 && <p className="hint">Brak przesylek w tej grupie.</p>}
      <div className="tiles">
        {sorters.map(({ sortujacy, count, trasy }) => (
          <button key={sortujacy} className="tile" onClick={() => onSelectSortujacy(sortujacy)}>
            <span className="tile-title">{sorterLabel(sortujacy)}</span>
            <span className="tile-trasy">{trasy.join(", ")}</span>
            <span className="tile-count">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
