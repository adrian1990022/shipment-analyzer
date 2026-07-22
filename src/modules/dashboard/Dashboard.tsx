import type { Grupa, Shipment } from "../../types/shipment";
import { GRUPY, countByGrupa } from "./grouping";

export function Dashboard({
  shipments,
  onSelectGrupa,
}: {
  shipments: Shipment[];
  onSelectGrupa: (grupa: Grupa) => void;
}) {
  const counts = countByGrupa(shipments);

  return (
    <div className="screen">
      <h1>Dashboard</h1>
      {shipments.length === 0 && (
        <p className="hint">Brak danych z dzisiejszego dnia. Wykonaj import raportow.</p>
      )}
      <div className="tiles">
        {GRUPY.map((grupa) => (
          <button key={grupa} className="tile" onClick={() => onSelectGrupa(grupa)}>
            <span className="tile-title">{grupa}</span>
            <span className="tile-count">{counts[grupa]}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
