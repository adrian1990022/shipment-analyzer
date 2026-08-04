import type { Grupa, Shipment } from "../../types/shipment";
import { shipmentsForSorter, shipmentsInGrupa, trasyInSorter } from "./grouping";

export function TrasaListView({
  shipments,
  grupa,
  sortujacy,
  handledMap,
  onSelectTrasa,
  onBack,
}: {
  shipments: Shipment[];
  grupa: Grupa;
  sortujacy: string;
  handledMap: Map<string, boolean>;
  onSelectTrasa: (trasa: string) => void;
  onBack: () => void;
}) {
  const inSorter = shipmentsForSorter(shipmentsInGrupa(shipments, grupa), sortujacy);
  const trasy = trasyInSorter(inSorter, handledMap);

  return (
    <div className="screen">
      <button className="back" onClick={onBack}>
        ← {grupa}
      </button>
      <h1>
        {grupa} / sortujący {sortujacy}
      </h1>
      {trasy.length === 0 && <p className="hint">Brak tras dla tego sortującego.</p>}
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
