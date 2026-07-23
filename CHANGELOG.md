# Changelog

Rejestr zmian w Shipment Analyzer — po co, żeby łatwo wrócić do dowolnego
stanu aplikacji. Każdy wpis tutaj odpowiada jednemu commitowi w gita
(`git log` pokaże dokładny diff; `git checkout <hash> -- .` albo
`git revert <hash>` pozwala się cofnąć do/po danej zmianie).

## 2026-07-24 — Shp Tot Pcs, deduplikacja Shipment ID

- Parser Panorama wczytuje dodatkowo kolumnę **"Shp Tot Pcs"**.
- Nowy krok pipeline'u: deduplikacja po Shipment ID (między filtrem dat
  a mapowaniem tras) — jeśli ten sam Shipment ID wystąpił w dzisiejszych
  danych kilka razy, zostaje jeden wiersz, a liczba wystąpień trafia do
  nowego pola `wystapilo`.
- Tabela z błędami ma dwie nowe kolumny: **Shp Tot Pcs** i **Wystąpiło**.
- Wymaga migracji `0003_shp_tot_pcs_wystapilo.sql` (nowe kolumny w
  `shipments`).

## 2026-07-24 — Podgląd tras na kafelku, mniej redundancji w tabeli

- Kafelek sortującego (P1/P2/P3) pokazuje teraz listę obsługiwanych tras
  pod numerem (mniejsza czcionka, kolor akcentu) — bez klikania.
- Tabela przesyłek nie pokazuje kolumny Trasa, gdy jest już zawężona do
  jednej trasy (P1/P3, poziom trasa) — redundantne, bo widać ją wyżej.
  Dla P2/COY004 (kilka tras w jednej tabeli) kolumna zostaje.

## 2026-07-24 — Naprawa dopasowania nagłówków w parserze

- "Weight / Dimension" zapisywało się jako puste — realny nagłówek Panoramy
  ma spację przed "/" ("Weight (KG) /Dimension (CM)"), a parser wymagał
  dokładnego dopasowania tekstu.
- Dopasowanie nagłówków kolumn (Panorama i Sherloc) jest teraz odporne na
  różnice w spacjach/wielkości liter (`parseWorkbook.normalizeHeader`) —
  ta sama klasa błędu (jak wcześniej przy dacie) nie powinna już wracać.

## 2026-07-23 — Nawigacja wstecz, poziom Trasa, sortujący z bramy

- Przyciski "wstecz" powiększone, wyglądają jak pełne buttony (nie link tekstowy).
- Fizyczny/gestowy przycisk wstecz na telefonie cofa ekran w aplikacji
  (History API — `src/navigation/useNavigation.ts`), zamiast zamykać PWA.
- Nowy poziom nawigacji dla **P1 i P3**: grupa → sortujący → **trasa** →
  tabela (`TrasaListView.tsx`). P2 i COY004 zostają płaskie (sortujący →
  od razu tabela), bo nie mają jeszcze jawnego przypisania sortującego.
- `routes` ma nową kolumnę `sortujacy` (migracja `0002_routes_sortujacy.sql`)
  — jawne przypisanie Bramy do sortującego. Puste = Mapper nadal liczy
  sortującego ze starej reguły MVP (3. litera trasy).
- Wgrane 45 przypisań sortujących (1–17) dla P1/P3 + 4 nowe bramy
  (P1L23, P1L24, P3R65, P3L86) z podanymi trasami.

## 2026-07-22/23 — Poprawki po pierwszym uruchomieniu

- Naprawiony deploy na Vercel: zmienne środowiskowe `VITE_SUPABASE_URL` /
  `VITE_SUPABASE_ANON_KEY` zapisywały się jako puste w dashboardzie Vercela;
  ustawione poprawnie przez CLI.
- Wgrane dane referencyjne `routes`: 68 bram (Chute ID → Trasa → Grupa),
  potem korekta 11 bram (P1R09–P1R15, P3L70–P3L73) po błędnym
  sparsowaniu wieloznacznych danych wejściowych.
- Jaśniejsza paleta kolorów (czytelność) + sortowanie po kolumnie Trasa
  w "Dane referencyjne".

## 2026-07-22 — Pierwsza wersja (initial commit)

- Szkielet: React + TypeScript + Vite + PWA (`vite-plugin-pwa`).
- Schemat Supabase: `routes` (referencyjne), `shipments` (bieżący dzień,
  nadpisywany co import), `imports` (metadane/liczniki, bez treści
  raportów) — `supabase/migrations/0001_init.sql`.
- Pełny pipeline: parser → normalizer → joiner → dateFilter → mapper →
  analyzer → repository, z regułą "UI nie woła Supabase bezpośrednio".
- Import: dwa pliki (auto-rozpoznanie Panorama/Sherloc) → podsumowanie →
  akceptacja → zapis.
- Dashboard: kafelki P1/P2/P3/COY004 → sortujący → tabela, sortowalna po
  Trasa i Consignee Name.
- Prosty ekran administracji tabelą `routes`.
- Repo GitHub (`adrian1990022/shipment-analyzer`) + wdrożenie na Vercel.
