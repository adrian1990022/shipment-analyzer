import { useMemo, useState } from "react";
import type { Grupa, Shipment } from "../../types/shipment";
import { shipmentsForSorter, shipmentsForTrasa, shipmentsInGrupa } from "./grouping";
import { parseWeightDimension } from "./parseWeightDimension";
import { formatTimeAndDate, isShipmentHandled, toLocalDateKey } from "../normalizer/normalize";

type SortKey = "trasa" | "consigneeName" | "lastPhyCpDt";

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
// powinno sie zdarzyc dla wierszy, ktore przeszly filterByScanCutoff -- ale
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
  // Domyslnie po czasie skanu, najstarsze pierwsze (prosba Adriana
  // 2026-09-25) -- klikniecie naglowka nadal zmienia sortowanie.
  const [sortKey, setSortKey] = useState<SortKey>("lastPhyCpDt");
  const [sortAsc, setSortAsc] = useState(true);

  const rows = useMemo(() => {
    const inGroup = shipmentsInGrupa(shipments, grupa);
    let forSorter = shipmentsForSorter(inGroup, sortujacy);
    if (trasa) forSorter = shipmentsForTrasa(forSorter, trasa);
    const sorted = [...forSorter].sort((a, b) => {
      // Obsluzone zawsze na samym dole, niezaleznie od wybranej kolumny
      // sortowania -- na gorze zostaje to, czym trzeba sie jeszcze zajac.
      const aHandled = isShipmentHandled(a, handledMap);
      if (aHandled !== isShipmentHandled(b, handledMap)) return aHandled ? 1 : -1;
      // lastPhyCpDt to ISO string (albo null) -- porownanie leksykograficzne
      // ISO odpowiada porownaniu chronologicznemu, ?? "" zabezpiecza null.
      const cmp = (a[sortKey] ?? "").localeCompare(b[sortKey] ?? "");
      return sortAsc ? cmp : -cmp;
    });
    return sorted;
  }, [shipments, grupa, sortujacy, trasa, sortKey, sortAsc, handledMap]);

  // Liczony nad "rows" -- dokladnie tym, co widac w tabeli -- wiec
  // automatycznie respektuje aktywne zawezenie (grupa/sortujacy/trasa) i
  // sortowanie, bez dodatkowego zapytania (funkcja dodatkowa, Sprint UX 1.1).
  const { handledCount, total } = useMemo(() => {
    let count = 0;
    for (const s of rows) {
      if (isShipmentHandled(s, handledMap)) count += 1;
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

  // Karty zamiast tabeli (2026-09-25, wzorem kafelka "Przed wyjazdem" w
  // kurier_appp) -- tabela z 12 kolumnami nie miescila sie na telefonie.
  // Naglowkow kolumn juz nie ma, wiec sortowanie przeszlo na przyciski.
  const sortOptions: { key: SortKey; label: string }[] = [
    { key: "lastPhyCpDt", label: "Czas" },
    { key: "consigneeName", label: "Consignee" },
    ...(showTrasaColumn ? [{ key: "trasa" as SortKey, label: "Trasa" }] : []),
  ];

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
      {total > 0 && (
        <div className="sort-bar">
          <span className="sort-bar-label">Sortuj:</span>
          {sortOptions.map(({ key, label }) => (
            <button
              key={key}
              className={`sort-button${sortKey === key ? " sort-button--active" : ""}`}
              onClick={() => toggleSort(key)}
            >
              {label} {sortKey === key && (sortAsc ? "↑" : "↓")}
            </button>
          ))}
        </div>
      )}
      <div className="shipment-cards">
        {rows.map((s) => {
          const shipmentDate = toLocalDateKey(s.lastPhyCpDt);
          const isHandled = isShipmentHandled(s, handledMap);
          return (
            <article
              // Klucz z trasa: przy dublu Chute ID ta sama przesylka moze byc
              // na liscie dwa razy (P2/COY004 lacza kilka tras).
              key={`${s.shipmentId}|${s.trasa}`}
              className={`shipment-card${isHandled ? " shipment-card--handled" : ""}`}>
              <div className="shipment-card-head">
                <span className="shipment-card-id">
                  {showTrasaColumn && <span className="shipment-card-trasa">{s.trasa}</span>}
                  {s.shipmentId}
                </span>
                <span className="shipment-card-time">{formatTimeAndDate(s.lastPhyCpDt)}</span>
              </div>
              <div className="shipment-card-name">{s.consigneeName || "—"}</div>
              <div className="shipment-card-addr">{[s.rcvrAddr1, s.rcvrCity].filter(Boolean).join(", ") || "—"}</div>
              {/* Uklad zwarty: wymiary | (Niezeskanowane nad Total Pcs), nizej
                  Last CP (zawsze 2-literowy kod) obok Remarks. */}
              <dl className="shipment-card-details">
                <div>
                  <dt>Weight / Dimension</dt>
                  <dd>
                    <WeightDimensionCell value={s.weightDimension} />
                  </dd>
                </div>
                <div className="shipment-card-stack">
                  <div>
                    <dt>Niezeskanowane</dt>
                    <dd>{s.wystapilo}</dd>
                  </div>
                  <div>
                    <dt>Total Pcs</dt>
                    <dd>{s.shpTotPcs ?? "—"}</dd>
                  </div>
                </div>
              </dl>
              <dl className="shipment-card-details shipment-card-row">
                <div>
                  <dt>Last CP</dt>
                  <dd>{s.lastPhyCp || "—"}</dd>
                </div>
                {s.remarks && (
                  <div className="shipment-card-grow">
                    <dt>Remarks</dt>
                    <dd>{s.remarks}</dd>
                  </div>
                )}
              </dl>
              <div className="shipment-card-foot">
                <HandledSwitch checked={isHandled} disabled={!shipmentDate} onChange={() => onToggleHandled(s)} />
                <span className="shipment-card-status">{isHandled ? "✓ Obsłużono" : "Obsłużono"}</span>
              </div>
            </article>
          );
        })}
      </div>
      {rows.length === 0 && <p className="hint">Brak przesylek.</p>}
    </div>
  );
}
