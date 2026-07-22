# Shipment Analyzer

PWA do codziennej analizy błędów sortowania przesyłek. Łączy dzienne
raporty **Panorama** i **Sherloc**, filtruje do bieżącego dnia, mapuje
trasy i pokazuje wynik w prostym dashboardzie (kafelek grupy → sortujący →
tabela przesyłek).

## Stos technologiczny

React + TypeScript + Vite + vite-plugin-pwa, Supabase (Postgres + JS
client) jako jedyny backend. Parsowanie plików (.xlsx/.xls/.csv) w
przeglądarce (`xlsx` / SheetJS) — nic nie jest wysyłane na żaden własny
serwer.

## Uruchomienie

```bash
npm install
cp .env.example .env   # uzupełnij VITE_SUPABASE_URL i VITE_SUPABASE_ANON_KEY
npm run dev
```

`npm run build` — build produkcyjny (PWA, service worker).
`npm run typecheck` — tylko sprawdzenie typów.

## Konfiguracja Supabase

1. Utwórz nowy projekt na [supabase.com](https://supabase.com) (plan Free).
2. Otwórz **SQL Editor** i uruchom zawartość pliku
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   Tworzy tabele `routes`, `imports`, `shipments`, indeksy i polityki RLS.
3. W **Project Settings → API** skopiuj `Project URL` i `anon public key`
   do `.env`.
4. W zakładce **Dane referencyjne** w aplikacji uzupełnij mapowanie
   Chute ID → Trasa → Grupa (P1/P2/P3), zanim zrobisz pierwszy import.

### Dlaczego tak, a nie inaczej (żeby każdą decyzję dało się wyjaśnić)

- **`routes.grupa` jest jawną kolumną**, a nie wyliczana z prefiksu
  trasy — unika to "magii" (ukrytej reguły w kodzie) i pozwala w pełni
  zarządzać przypisaniem kafelka z poziomu UI.
- **Chute ID = `COY004` nie korzysta z tabeli `routes`** — trafia od
  razu do osobnego kafelka `COY004` (`trasa = "COY004"`), zgodnie ze
  specyfikacją.
- **Sortujący = trzecia litera trasy** — to literalna reguła MVP ze
  specyfikacji, celowo prosta i tymczasowa (patrz `mapRoutes.ts`,
  `sorterFromTrasa`). Do zamiany, gdy pojawi się właściwe źródło danych
  o przypisaniu sortujących.
- **Nie zapisujemy oryginalnych raportów** — cały pipeline (parsowanie,
  join, filtr daty, mapowanie) działa w pamięci przeglądarki; do
  Supabase trafia wyłącznie wynik końcowy, po akceptacji użytkownika.
  Tabela `imports` przechowuje tylko metadane/liczniki, nie treść plików.
- **Każdy zaakceptowany import całkowicie zastępuje `shipments`**
  (delete-all + insert), zgodnie z regułą "jeden bieżący dzień = jeden
  zestaw danych".
- **"Bieżący dzień" liczony jest wg zegara urządzenia**, na którym
  wykonywany jest import (filtr po `Last Phy Cp dt`).
- **Rekordy z Chute ID spoza tabeli `routes`** (i różnym od `COY004`)
  są pomijane w zapisywanym wyniku, a ich liczba i lista Chute ID są
  pokazane w podsumowaniu importu przed zapisem — użytkownik może
  uzupełnić `routes` i zaimportować ponownie.
- **RLS jest włączone, ale polityki na razie pozwalają na pełny dostęp**
  (`using (true)`) — narzędzie nie ma na razie logowania (jeden
  użytkownik). Gdy pojawi się potrzeba wielu kont, zastąpić polityki
  wersjami opartymi o `auth.uid()`.

## Pipeline

```
Walidacja (pliki wybrane, format czytelny)
  → Rozpoznanie raportu (po nagłówkach: Panorama vs Sherloc)
  → Parser (surowe kolumny → typowane wiersze, BEZ wiedzy o trasach)
  → Normalizacja (klucz joina, daty, liczby)
  → Join (Panorama.Shipment ID = Sherloc.HWB No)
  → Filtrowanie dat (tylko dzisiejszy Last Phy Cp dt)
  → Mapowanie tras (Chute ID → Trasa → Grupa, przez tabelę routes)
  → Przypisanie sortującego (3. litera trasy)
  → Podsumowanie (liczniki, do wglądu przed zapisem)
  → [akceptacja użytkownika]
  → Zapis do Supabase (repository.replaceShipments)
  → Dashboard (czyta z Supabase)
```

Do momentu akceptacji nic nie jest zapisywane — `runImportPipeline`
(`src/modules/import/pipeline.ts`) działa wyłącznie w pamięci (poza
odczytem tabeli `routes`, potrzebnym do mapowania).

## Struktura katalogów

```
src/
  lib/supabaseClient.ts        jedyny plik, ktory tworzy klienta Supabase
  modules/
    parser/                    odczyt pliku, rozpoznanie typu, parsowanie kolumn
    normalizer/                klucz joina, parsowanie dat/liczb
    joiner/                    Panorama + Sherloc -> JoinedRow[]
    dateFilter/                filtr do biezacego dnia
    mapper/                    Chute ID -> Trasa -> Grupa -> Sortujacy
    analyzer/                  liczenie podsumowania importu
    repository/                JEDYNE moduly importujace supabaseClient
    referenceData/             UI administracji tabela routes
    import/                    orkiestracja pipeline'u + ekran importu
    dashboard/                 kafelki grup -> sortujacy -> tabela
  types/                       modele danych (Report, Shipment)
```

Zasada modularności: **UI nigdy nie importuje `supabaseClient`
bezpośrednio** — zawsze przez `modules/repository/*`. Parser nie zna
tras; Mapper jest jedynym modułem, który zna tabelę `routes`.

## Rozbudowa

Miejsca przygotowane pod przyszłe funkcje bez przebudowy architektury:

- `shipments` przechowuje też pola z Sherloc (`receiverName`,
  `rcvrAddr1`, `rcvrPostcode`, `rcvrCity`) i `shpCalcWgt` — nieużywane
  jeszcze w dashboardzie, gotowe pod np. wykrywanie rozbieżności wagi
  lub porównanie Consignee Name vs Receiver Name.
- `imports` to gotowa historia importów (liczniki), można dodać ekran
  trendu dzień-do-dnia bez zmian w reszcie pipeline'u.
- Sortowanie w tabeli sortującego jest już wydzielone (`SorterTable.tsx`)
  i łatwo rozszerzalne o kolejne kolumny.
