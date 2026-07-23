import type { Grupa, Shipment } from "../../types/shipment";
import { shipmentsInGrupa, sortersInGrupa } from "./grouping";

export function GroupView({
  shipments,
  grupa,
  onSelectSortujacy,
  onBack,
}: {
  shipments: Shipment[];
  grupa: Grupa;
  onSelectSortujacy: (sortujacy: string) => void;
  onBack: () => void;
}) {
  const inGroup = shipmentsInGrupa(shipments, grupa);
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
            <span className="tile-title">{sortujacy}</span>
            <span className="tile-trasy">{trasy.join(", ")}</span>
            <span className="tile-count">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
