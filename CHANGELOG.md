# Changelog

Rejestr zmian w Shipment Analyzer — po co, żeby łatwo wrócić do dowolnego
stanu aplikacji. Każdy wpis tutaj odpowiada jednemu commitowi w gita
(`git log` pokaże dokładny diff; `git checkout <hash> -- .` albo
`git revert <hash>` pozwala się cofnąć do/po danej zmianie).

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
