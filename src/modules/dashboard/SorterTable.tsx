import { useMemo, useState } from "react";
import type { Grupa, Shipment } from "../../types/shipment";
import { shipmentsForSorter, shipmentsForTrasa, shipmentsInGrupa } from "./grouping";
import { parseWeightDimension } from "./parseWeightDimension";
import { buildHandledKey } from "../repository/shipmentActionRepository";
import { formatTimeHHmm, toLocalDateKey } from "../normalizer/normalize";

type SortKey = "trasa" | "consigneeName";

function WeightDimensionCell({ value }: { value: string }) {
  const parsed = parseWeightDimension(value);
  if (!parsed) return <>{value}</>;
  return (
    <div className="weight-dimension">
      <div>waga: {parsed.weightKg} kg</div>
      <div>długość: {parsed.lengthCm} cm</div>
      <div>wysokość: {parsed.heightCm} cm</div>
      <div>szerokość: {parsed.widthCm} cm</div>
    </div>
  );
}

// "Obsluzono" = ktos juz sie tym zajmuje, NIE "problem rozwiazany" (Sprint
// UX 1.1). shipmentDate === null (brak/niepoprawna Last Phy Cp dt) nie
// powinno sie zdarzyc dla wierszy, ktore przeszly filterToday -- ale
// defensywnie wylaczamy Switch zamiast zgadywac date.
function HandledSwitch({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} />
      <span className="switch-track" />
    </label>
  );
}

export function SorterTable({
  shipments,
  grupa,
  sortujacy,
  trasa,
  handledMap,
  onToggleHandled,
  onBack,
}: {
  shipments: Shipment[];
  grupa: Grupa;
  sortujacy: string;
  // Podany tylko dla P1/P3 (poziom trasa) -- zawezanie do jednej trasy.
  trasa?: string;
  handledMap: Map<string, boolean>;
  onToggleHandled: (shipment: Shipment) => void;
  onBack: () => void;
}) {
  // Gdy tabela jest juz zawezona do jednej trasy, kolumna Trasa jest
  // redundantna -- widac ja na poprzednim kafelku (TrasaListView).
  const showTrasaColumn = !trasa;
  const [sortKey, setSortKey] = useState<SortKey>(showTrasaColumn ? "trasa" : "consigneeName");
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

  // Liczony nad "rows" -- dokladnie tym, co widac w tabeli -- wiec
  // automatycznie respektuje aktywne zawezenie (grupa/sortujacy/trasa) i
  // sortowanie, bez dodatkowego zapytania (funkcja dodatkowa, Sprint UX 1.1).
  const { handledCount, total } = useMemo(() => {
    let count = 0;
    for (const s of rows) {
      const shipmentDate = toLocalDateKey(s.lastPhyCpDt);
      if (shipmentDate && handledMap.get(buildHandledKey(s.shipmentId, shipmentDate))) count += 1;
    }
    return { handledCount: count, total: rows.length };
  }, [rows, handledMap]);

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
      {total > 0 && (
        <div className={`handled-counter${handledCount === total ? " handled-counter--complete" : ""}`}>
          {handledCount === total ? "✓ " : ""}
          Obsłużono: {handledCount} / {total} przesyłek
        </div>
      )}
      <table className="data-table">
        <thead>
          <tr>
            {showTrasaColumn && (
              <th className="sortable" onClick={() => toggleSort("trasa")}>
                Trasa {sortKey === "trasa" && (sortAsc ? "↑" : "↓")}
              </th>
            )}
            <th>Shipment ID</th>
            <th>Last Phy Cp</th>
            <th className="sortable" onClick={() => toggleSort("consigneeName")}>
              Consignee Name {sortKey === "consigneeName" && (sortAsc ? "↑" : "↓")}
            </th>
            <th>Weight / Dimension</th>
            <th>Czas</th>
            <th>Remarks</th>
            <th>Total Pcs</th>
            <th>Wystąpiło</th>
            <th>Obsłużono</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const shipmentDate = toLocalDateKey(s.lastPhyCpDt);
            const isHandled = shipmentDate
              ? (handledMap.get(buildHandledKey(s.shipmentId, shipmentDate)) ?? false)
              : false;
            return (
              <tr key={s.shipmentId} className={isHandled ? "row-handled" : undefined}>
                {showTrasaColumn && <td>{s.trasa}</td>}
                <td>{s.shipmentId}</td>
                <td>{s.lastPhyCp}</td>
                <td>{s.consigneeName}</td>
                <td>
                  <WeightDimensionCell value={s.weightDimension} />
                </td>
                <td>{formatTimeHHmm(s.lastPhyCpDt)}</td>
                <td>{s.remarks}</td>
                <td>{s.shpTotPcs ?? ""}</td>
                <td>{s.wystapilo}</td>
                <td>
                  <HandledSwitch
                    checked={isHandled}
                    disabled={!shipmentDate}
                    onChange={() => onToggleHandled(s)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length === 0 && <p className="hint">Brak przesylek.</p>}
    </div>
  );
}
