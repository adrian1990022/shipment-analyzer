import { useMemo, useState } from "react";
import type { Grupa, Shipment } from "../../types/shipment";
import { shipmentsForSorter, shipmentsForTrasa, shipmentsInGrupa } from "./grouping";

type SortKey = "trasa" | "consigneeName";

export function SorterTable({
  shipments,
  grupa,
  sortujacy,
  trasa,
  onBack,
}: {
  shipments: Shipment[];
  grupa: Grupa;
  sortujacy: string;
  // Podany tylko dla P1/P3 (poziom trasa) -- zawezanie do jednej trasy.
  trasa?: string;
  onBack: () => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("trasa");
  const [sortAsc, setSortAsc] = useState(true);

  const rows = useMemo(() => {
    const inGroup = shipmentsInGrupa(shipments, grupa);
    let forSorter = shipmentsForSorter(inGroup, sortujacy);
    if (trasa) forSorter = shipmentsForTrasa(forSorter, trasa);
    const sorted = [...forSorter].sort((a, b) => {
      const cmp = a[sortKey].localeCompare(b[sortKey]);
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [shipments, grupa, sortujacy, trasa, sortKey, sortAsc]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc((v) => !v);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  }

  return (
    <div className="screen">
      <button className="back" onClick={onBack}>
        ← {trasa ? `sortujący ${sortujacy}` : `Grupa ${grupa}`}
      </button>
      <h1>
        {grupa} / {sortujacy}
        {trasa ? ` / ${trasa}` : ""}
      </h1>
      <table className="data-table">
        <thead>
          <tr>
            <th className="sortable" onClick={() => toggleSort("trasa")}>
              Trasa {sortKey === "trasa" && (sortAsc ? "↑" : "↓")}
            </th>
            <th>Shipment ID</th>
            <th>Last Phy Cp</th>
            <th className="sortable" onClick={() => toggleSort("consigneeName")}>
              Consignee Name {sortKey === "consigneeName" && (sortAsc ? "↑" : "↓")}
            </th>
            <th>Weight / Dimension</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.shipmentId}>
              <td>{s.trasa}</td>
              <td>{s.shipmentId}</td>
              <td>{s.lastPhyCp}</td>
              <td>{s.consigneeName}</td>
              <td>{s.weightDimension}</td>
              <td>{s.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="hint">Brak przesylek.</p>}
    </div>
  );
}
