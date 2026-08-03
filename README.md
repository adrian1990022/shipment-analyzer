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
`npm test` — testy jednostkowe (Vitest). `npm run test:coverage` — z
raportem pokrycia (patrz sekcja [Testy](#testy)).

## Konfiguracja Supabase

1. Utwórz nowy projekt na [supabase.com](https://supabase.com) (plan Free).
2. Otwórz **SQL Editor** i uruchom zawartość pliku
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   Tworzy tabele `routes`, `imports`, `shipments`, indeksy i polityki RLS.
3. W **Project Settings → API** skopiuj `Project URL` i `anon public key`
   do `.env`.
4. W zakładce **Dane referencyjne** w aplikacji uzupełnij mapowanie
   Chute ID → Trasa → Grupa (P1/P2/P3), zanim zrobisz pierwszy import.

### Logowanie: konfiguracja jednorazowa

1. Uruchom `supabase/migrations/0006_auth.sql` (tabela `profiles`,
   funkcja `is_admin()`) — RLS reszty tabel na razie zostaje bez zmian.
2. Załóż swoje konto admina **bez użycia `service_role`**: Supabase
   Dashboard → Authentication → Users → Add User (e-mail
   `twojlogin@shipment-analyzer.local`, hasło wg uznania, "Auto Confirm
   User" = tak), potem w SQL Editor:
   ```sql
   insert into public.profiles (id, username, role)
   values ('<uuid nowego usera>', 'twojlogin', 'admin');
   ```
3. W **Vercel → Project Settings → Environment Variables** dodaj
   samodzielnie (nie przez czat) `SUPABASE_SERVICE_ROLE_KEY` — klucz z
   Supabase **Project Settings → API → service_role**. To jedyny sekret
   w projekcie na tyle wrażliwy (pełny bypass RLS + admin auth nad całą
   bazą), żeby uzasadnić ten dodatkowy krok ostrożności zamiast wklejenia
   go do czatu jak `anon key`.
4. Zaloguj się w aplikacji, potwierdź że widzisz pełny panel. Dopiero
   teraz uruchom `supabase/migrations/0007_lock_down_rls.sql` — to
   nieodwracalny krok zamykający anonimowy dostęp do danych.
5. Uruchom `supabase/migrations/0008_backup_restore.sql` — dodaje
   funkcję `replace_reference_data`, potrzebną do importu kopii
   zapasowej (patrz [Backup / restore](#backup--restore-danych-referencyjnych)).
6. Uruchom `supabase/migrations/0009_shipment_actions.sql` — dodaje
   tabelę `shipment_actions`, potrzebną do oznaczania przesyłek jako
   „Obsłużono” (patrz [Obsłużono](#obsłużono--stan-operacyjny-shipment_actions)).

### Dlaczego tak, a nie inaczej (żeby każdą decyzję dało się wyjaśnić)

- **`routes.grupa` jest jawną kolumną**, a nie wyliczana z prefiksu
  trasy — unika to "magii" (ukrytej reguły w kodzie) i pozwala w pełni
  zarządzać przypisaniem kafelka z poziomu UI.
- **Chute ID = `COY004` nie korzysta z tabeli `routes`** — trafia od
  razu do osobnego kafelka `COY004` (`trasa = "COY004"`), zgodnie ze
  specyfikacją.
- **Sortujący przypisywany relacyjnie** — tabele `sorters` +
  `sorter_routes` (zakładka "Sortujący", `SorterRepository`) są głównym
  źródłem: jedna trasa → jeden sortujący (`sorter_routes.route unique`).
  Gdy trasa nie ma przypisania, obowiązuje stary fallback MVP — trzecia
  litera trasy (`mapRoutes.ts`, `sorterFromTrasa`) — celowo prosty,
  zachowuje zgodność z danymi sprzed wprowadzenia relacji.
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
- **`shipment_actions` (stan „Obsłużono”) ma osobne, szersze RLS niż
  `shipments`** — admin pełny dostęp, ale zwykły zalogowany `user`
  (operator na hali) też może czytać/tworzyć/aktualizować (nie tylko
  czytać, jak przy `shipments`), bo to on na co dzień przełącza Switch.
  Usuwanie zostaje tylko dla admina — `pruneShipmentActions` jest
  wołane wyłącznie z `ImportScreen`, który i tak wymaga roli admina.

## Pipeline

```
Walidacja (pliki wybrane, format czytelny)
  → Rozpoznanie raportu (po nagłówkach: Panorama vs Sherloc)
  → Parser (surowe kolumny → typowane wiersze, BEZ wiedzy o trasach)
  → Normalizacja (klucz joina, daty, liczby)
  → Join (Panorama.Shipment ID = Sherloc.HWB No)
  → Filtrowanie dat (tylko dzisiejszy Last Phy Cp dt)
  → Deduplikacja po Shipment ID (jeden wiersz, liczba wystąpień w polu "wystapilo")
  → Mapowanie tras (Chute ID → Trasa → Grupa, przez tabelę routes)
  → Przypisanie sortującego (jawnie z routes, fallback: 3. litera trasy)
  → Podsumowanie (liczniki, do wglądu przed zapisem)
  → [akceptacja użytkownika]
  → Zapis do Supabase (repository.replaceShipments)
  → Dashboard (czyta z Supabase)
```

Do momentu akceptacji nic nie jest zapisywane — `runImportPipeline`
(`src/modules/import/pipeline.ts`) działa wyłącznie w pamięci (poza
odczytem tabeli `routes`, potrzebnym do mapowania).

## Testy

```bash
npm test              # jednorazowy przebieg (CI-friendly)
npm run test:watch    # tryb watch przy pracy nad kodem
npm run test:coverage # jak wyzej + raport pokrycia (text + HTML w coverage/)
```

Vitest, środowisko `node` (nie `jsdom`) — testowana jest wyłącznie
**logika biznesowa** (Parser, Normalizer, Join, Date Filter, Deduplicate,
Mapper, Analyzer, Repository, Backup), nigdzie nie renderujemy
komponentów React (`.tsx`). Konfiguracja progów pokrycia w
[`vitest.config.ts`](vitest.config.ts): 90% globalnie (statements/branches/
functions/lines) dla katalogów objętych `coverage.include`, ze 100%
wymaganym dla `parser/**`, `mapper/**`, `joiner/**`, `dateFilter/**` —
moduły, gdzie regresja wprost oznacza błędne dane w produkcji (to już
raz się zdarzyło: literówka w nagłówku kolumny przechodziła niezauważona
przez ręczne testy).

Parser testowany na **prawdziwych plikach `.xlsx`** budowanych w pamięci
przez SheetJS (`src/test/xlsxFixture.ts`), nie na atrapach formatu —
dokładnie po to, żeby łapać różnice wielkości liter/spacji w nagłówkach.
Repository mockuje `lib/supabaseClient` (`src/test/supabaseMock.ts`),
nie łączy się z prawdziwą bazą.

## Monitoring (Sentry)

Błędy zgłaszane do [Sentry](https://sentry.io) — front-end (React) i
Vercel Serverless Functions (`api/*.ts`) osobnymi SDK (`@sentry/react` /
`@sentry/node`), ale jedna zmienna środowiskowa:

```
VITE_SENTRY_DSN=https://xxxxx@xxxxx.ingest.sentry.io/xxxxx
```

Opcjonalna — brak DSN po prostu wyłącza monitoring (np. lokalny dev bez
konta Sentry), aplikacja działa normalnie. Sam DSN **nie jest sekretem**
w stylu `SUPABASE_SERVICE_ROLE_KEY` — Sentry projektuje go jako
bezpieczny do ujawnienia w kodzie klienckim (pozwala tylko *wysyłać*
zdarzenia, nie czytać danych), więc może trafić do `.env`/Vercel tak
samo jak `VITE_SUPABASE_ANON_KEY`.

**Architektura** (jeden punkt wejścia, jak `supabaseClient`):
- `src/lib/sentry.ts` — jedyny plik klienta wołający `Sentry.init(...)`.
- `src/modules/monitoring/reportError.ts` — jedyna funkcja, przez którą
  reszta kodu zgłasza błędy (`reportError(err, { module, stage })`).
  Nikt inny nie importuje `@sentry/react` bezpośrednio.
- `src/modules/monitoring/ErrorBoundary.tsx` — globalny Error Boundary
  (owija `AppShell` w `App.tsx`) — użytkownik widzi czytelny komunikat
  PL, **nigdy stack trace**.
- `api-lib/sentry.ts` — analogiczny `reportError` dla `api/*.ts`.

**Co jest wysyłane:** wyłącznie informacje techniczne — treść/stack
błędu, `module`/`stage` (np. `shipmentsRepository`/`fetchShipments`,
`import`/`pipeline`, `react`/`render`), środowisko i release (krótki SHA
gita, wstrzykiwany przez `vite.config.ts` przy buildzie — grupuje
zdarzenia per-deploy).

**Co NIGDY nie jest wysyłane:** Shipment ID, dane odbiorcy (nazwa,
adres), loginy, hasła, treść raportów. Zapewnione projektowo —
`reportError` nigdy nie dostaje surowych obiektów domenowych
(`Shipment`/`Profile`/`User`), tylko `{module, stage}` — plus
`beforeSend` w `lib/sentry.ts` jako dodatkowa obrona (usuwa
cookies/nagłówek `Authorization`/podejrzane klucze typu `password`,
`shipmentId`, `username`, `address`, `token`, `login`, gdyby ktoś kiedyś
pomyłkowo przekazał je dalej).

**Świadomie NIE zgłaszane do Sentry** (to oczekiwane wyniki, nie
incydenty): `PipelineError` (zły plik, nierozpoznane nagłówki — user
widzi komunikat, ale to nie błąd aplikacji), zwykłe odpowiedzi 4xx z
`api/admin-*.ts` (np. "login zajęty").

## Backup / restore danych referencyjnych

Zakładka **Dane referencyjne** (admin) ma sekcję "Kopia zapasowa" —
eksport/import **wyłącznie** `routes` + `sorters` + `sorter_routes`
(świadomie NIE obejmuje `shipments`, `imports`, `users`/`profiles`).

Format JSON: `{ appVersion, schemaVersion, createdAt, createdBy, routes,
sorters, sorterRoutes }`. `sorterRoutes[].sorterId` referencjonuje
sortującego po **id z chwili eksportu**, nie po nazwie — imiona nie są
unikalne (w danych bywają dwie osoby o tym samym imieniu), więc
referencja po nazwie łączyłaby ich przypisania tras w jedno.

**Prawdziwa transakcyjność** — nie "najlepsze starania". Import to
jedno wywołanie funkcji Postgres `replace_reference_data`
(`supabase/migrations/0008_backup_restore.sql`) przez `supabase.rpc(...)`:
całe jej ciało to jedna transakcja SQL, błąd w dowolnym miejscu (zła
`grupa`, zerwana referencja) cofa WSZYSTKO. Cała logika (budowanie
JSON, walidacja, wersjonowanie) żyje w `ReferenceBackupService`
(`src/modules/backup/referenceBackupService.ts`) — komponenty React
nie znają formatu pliku.

### Jak odtworzyć dane z kopii zapasowej — krok po kroku

1. Zaloguj się jako administrator, wejdź w **Dane referencyjne**.
2. W sekcji "Kopia zapasowa" kliknij **Importuj kopię zapasową** i
   wybierz plik `.json` wcześniej pobrany przyciskiem "Eksportuj kopię
   zapasową".
3. Aplikacja waliduje plik PRZED jakąkolwiek zmianą w bazie (poprawność
   JSON, zgodność `schemaVersion`, kompletność pól, spójność referencji
   — każdy `sorterRoutes[].sorterId` musi istnieć w `sorters`, każda
   `route` w `routes`). Jeśli plik jest niepoprawny, zobaczysz listę
   błędów i **nic nie zostanie zaimportowane**.
4. Potwierdź okno "Obecna konfiguracja zostanie zastąpiona. Czy
   kontynuować?" — to ostatni moment na anulowanie.
5. Import zastępuje CAŁĄ zawartość `routes`/`sorters`/`sorter_routes`
   danymi z pliku, w jednej transakcji. Błąd w trakcie (np. uszkodzone
   dane) oznacza, że **nic się nie zmienia** — poprzedni stan zostaje
   nietknięty.
6. Po sukcesie zobaczysz podsumowanie liczbowe (ile tras/sortujących/
   przypisań zaimportowano) i lista w tabeli odświeży się automatycznie.

Jeśli import się nie powiedzie z innego powodu (np. utrata połączenia
w trakcie), stan bazy jest gwarantowany identyczny jak przed próbą —
transakcja SQL gwarantuje brak częściowego zapisu. Możesz bezpiecznie
spróbować ponownie.

## Obsłużono — stan operacyjny `shipment_actions`

Na ekranie tabeli błędów każdy wiersz ma przełącznik „Obsłużono” —
informacja "ktoś już się tym zajmuje", **nie** "problem rozwiązany".
Nad tabelą widać też licznik `Obsłużono: X / Y przesyłek`, liczony nad
aktualnie widocznym (przefiltrowanym/posortowanym) zestawem wierszy.

Stan **nie** jest zapisywany w tabeli `shipments` — ta jest nadpisywana
w całości przy każdym imporcie (`replaceShipments`: delete-all +
insert), więc przetrwanie stanu po reimporcie tego samego dnia
wymagałoby dodatkowej logiki scalania. Zamiast tego osobna tabela
`shipment_actions` (`id`, `shipment_id`, `shipment_date`, `handled`,
`updated_at`, `unique(shipment_id, shipment_date)`), powiązana z
`shipments` logicznie (po złożonym kluczu), nie kluczem obcym.

**Odczyt/scalanie**: `ShipmentActionRepository.fetchHandledMap()` pobiera
CAŁY stan jednym zapytaniem przy `reload()` (logowanie, po imporcie) —
żadnych dodatkowych zapytań per wiersz tabeli. Wynik to `Map<string,
boolean>` po kluczu złożonym `shipmentId|shipmentDate`, łączona w
pamięci z `Shipment[]` przy renderowaniu (`SorterTable.tsx`).

**Zapis**: przełączenie Switcha wywołuje `ShipmentActionRepository.setHandled`
(optymistyczny update w UI, `upsert` po `(shipment_id, shipment_date)`,
revert w UI jeśli zapis się nie powiedzie).

**Retencja — brak historii**: aplikacja pracuje wyłącznie na bieżącym
dniu, więc po każdym zaakceptowanym imporcie `ImportScreen` wywołuje
`pruneShipmentActions(dzisiaj)` (best-effort — błąd nie maskuje udanego
zapisu `shipments`), które usuwa wpisy z `shipment_date` różnym od
dzisiejszego. Pierwsze wywołanie danego dnia realnie czyści wczorajsze
wpisy; kolejne wywołania tego samego dnia (ponowny import) są no-opem,
więc dzisiejszy stan „Obsłużono” przetrwa.

## Struktura katalogów

```
src/
  lib/supabaseClient.ts        jedyny plik, ktory tworzy klienta Supabase
  modules/
    parser/                    odczyt pliku, rozpoznanie typu, parsowanie kolumn
    normalizer/                klucz joina, parsowanie dat/liczb
    joiner/                    Panorama + Sherloc -> JoinedRow[]
    dateFilter/                filtr do biezacego dnia
    dedup/                     deduplikacja po Shipment ID + licznik wystapien
    mapper/                    Chute ID -> Trasa -> Grupa -> Sortujacy
    analyzer/                  liczenie podsumowania importu
    repository/                JEDYNE moduly importujace supabaseClient
                                (w tym shipmentActionRepository.ts -- stan "Obsluzono")
    referenceData/             UI administracji tabela routes
    sorters/                   UI zarzadzania sortujacymi (sorters + sorter_routes)
    users/                     UI zarzadzania kontami (admin-only)
    auth/                      AuthProvider, LoginScreen, AdminRoute, authService
    import/                    orkiestracja pipeline'u + ekran importu
    dashboard/                 kafelki grup -> sortujacy -> tabela
    backup/                    eksport/import routes+sorters+sorter_routes (JSON)
    monitoring/                reportError (jedyne wejscie do Sentry) + ErrorBoundary
  types/                       modele danych (Report, Shipment, auth, backup)
  test/                        wspolne fixture'y/mocki dla testow (xlsx, Supabase)
api/                           Vercel Serverless Functions (admin-create-user,
                                admin-change-password, admin-delete-user)
api-lib/                       wspolny kod dla api/* (poza katalogiem api/,
                                zeby Vercel go nie routowal) -- tu i TYLKO
                                tu zyje SUPABASE_SERVICE_ROLE_KEY; sentry.ts to
                                jedyne miejsce w api/** wolajace Sentry.* bezposrednio
```

Zasada modularności: **UI nigdy nie importuje `supabaseClient`
bezpośrednio** — zawsze przez `modules/repository/*` (albo
`modules/auth/authService.ts` dla `supabase.auth.*`). Parser nie zna
tras; Mapper jest jedynym modułem, który zna tabelę `routes`.

### Logowanie i role (admin / user)

Supabase Auth + RLS, żadnego własnego systemu logowania. Logowanie
loginem (nie e-mailem) — login jest deterministycznie mapowany na
syntetyczny e-mail `${login}@shipment-analyzer.local`, którego
użytkownik nigdy nie widzi (Supabase Auth wymaga e-maila natywnie).

Operacje administracyjne na kontach (tworzenie, zmiana hasła,
usuwanie) wymagają klucza `service_role`, który ma pełny dostęp do bazy
i auth — **nigdy nie trafia do kodu klienckiego**. Żyje wyłącznie jako
zmienna środowiskowa trzech Vercel Serverless Functions (`api/admin-*.ts`),
które same weryfikują, że wywołujący ma ważną sesję i rolę `admin` w
`profiles`, zanim wykonają operację. `UserRepository`
(`modules/repository/userRepository.ts`) woła te endpointy przez
`fetch`, nigdy nie dotyka `service_role` bezpośrednio.

RLS: funkcja `is_admin()` (`security definer`, żeby uniknąć rekurencji
przy sprawdzaniu roli z tabeli `profiles`) używana we wszystkich
politykach. Admin ma pełny dostęp do wszystkiego; zwykły `user` ma
tylko odczyt `shipments` (do Dashboardu) — reszta tabel jest dla niego
niedostępna.

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
