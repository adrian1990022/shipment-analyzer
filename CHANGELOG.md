# Changelog

Rejestr zmian w Shipment Analyzer — po co, żeby łatwo wrócić do dowolnego
stanu aplikacji. Każdy wpis tutaj odpowiada jednemu commitowi w gita
(`git log` pokaże dokładny diff; `git checkout <hash> -- .` albo
`git revert <hash>` pozwala się cofnąć do/po danej zmianie).

## 2026-10-21 — Baza przypisań tras zamiast Chute ID

- **Trasa przesyłki pochodzi wyłącznie z bazy przypisań tras** (plik
  „Route | AWB/BkgRef”, Shipment ID z Panoramy = AWB/BkgRef), dla wszystkich
  przesyłek z Panoramy, w obu aplikacjach (decyzja Adriana). `mapRoutes.ts`:
  numer spoza bazy → kafelek **„Nieprzypisane”** (przesyłka zostaje, bez
  trasy i sortującego); trasa z „O” na 3. miejscu → **COY004**; trasa znana
  w `routes` → jej grupa; trasa spoza `routes` → „Nieprzypisane” (nieznana
  trasa, trasa zachowana). Chute ID, dubel i fallback sortującego z 3. litery
  przestały działać — sortujący tylko z `sorter_routes`, inaczej „Brak
  sortującego”.
- **Import zablokowany** bez bazy albo z bazą nie z dzisiaj (analiza +
  `import_shipments`).
- **Karta „Baza przypisań tras”** na ekranie Import: status, liczba
  rekordów, data; wgranie nowego pliku → podsumowanie walidacji → zapis
  (zastępuje całą bazę). `routeBase/parseRouteBase.ts` (+ testy),
  `repository/routeBaseRepository.ts` (+ testy), odczyt pliku
  `readWorkbookRowsAsText` (bez utraty zer wiodących i cyfr długich numerów).
- **Dashboard**: kafelek „Nieprzypisane” (lista z powodem i Chute ID),
  COY004 grupowany po trasie (trasy „O” nie mają sortujących).
- Podsumowanie importu: przypisane z bazy / brak w bazie / nieznana trasa /
  bez sortującego + lista nieprzypisanych.
- Baza: migracja `0016_baza_przypisan_tras.sql` — `route_assignments`,
  `route_assignment_meta`, `replace_route_assignments` (wszystko albo
  nic), `shipments.przypisanie`, grupa `NIEPRZYPISANE`, nowa wersja
  `import_shipments`. Tylko admin (RLS), bez dostępu anon.

## 2026-10-13 — Lista obecności sortujących (ekran Import)

- **Nowa karta „Lista obecności sortujących”** na ekranie Import
  (`attendance/AttendanceImport.tsx`): wybór miesiąca (bieżący / poprzedni),
  wklejenie kolumny z Excela („Jan Kowalski_1”, „Jan Kowalski_2”…),
  „Sprawdź” → podgląd (rozpoznani z liczbą dni, nieznane imiona
  i nazwiska, niejednoznaczne, błędne wpisy, powtórzenia, „dane do dnia”),
  „Zapisz” → cały miesiąc naraz.
- Rozpoznawanie: `attendance/parseAttendance.ts` (+ testy) — dopasowanie do
  „Imię i nazwisko” sortującego bez względu na wielkość liter i spacje,
  polskie znaki muszą się zgadzać.
- Baza (migracja `0015_sorter_attendance.sql`, uruchomiona i sprawdzona):
  `sorter_attendance` (sortujący, dzień), `sorter_attendance_months` (do
  którego dnia sięgają dane), funkcja `import_sorter_attendance` (wszystko
  albo nic, retencja bieżący + poprzedni miesiąc). Tylko admin (RLS).
- Odczyt: kurier_appp, kafelek „Sortujący” (`api/sortujacy.js`) — sortujący
  pokazywani w loopie z kolumny „Loop”.

## 2026-10-13 — Sortujący: kolumna „Loop”

- **Nowa kolumna „Loop”** na ekranie „Sortujący”, przed nazwą — zwykle
  litera loopa kuriera (A, B, …), ale wolny tekst do 20 znaków (np.
  „zastępca”). Edycja w tabeli jak pozostałe (dwuklik / ✎) z podpowiedziami:
  wartości już użyte + „zastępca”. Sortowalna (puste na końcu, wielkość
  liter bez znaczenia). Pole też w formularzu „Dodaj/Edytuj”.
- Baza: `sorters.loop` (opcjonalne, migracja `0014_sorters_loop.sql` —
  uruchomiona i sprawdzona). Backup zapisuje/odtwarza `loop`; starsze pliki
  bez niego nadal się wgrywają.
- Etap 1 z planu „obecność sortujących w kurier_appp”: docelowo kurier
  pokaże sortującego w loopie o tym kodzie. Wklejanie obecności, kafelek
  w kurierze i zastępcy — jeszcze nie zrobione (czekają na decyzję Adriana).

## 2026-10-12 — Sortujący: „Imię i nazwisko” + edycja w tabeli

- **Nowa kolumna „Imię i nazwisko”** na ekranie „Sortujący” (między nazwą
  a trasami), sortowalna (puste zawsze na końcu). Baza: `sorters.full_name`
  (opcjonalne, max 100 znaków, migracja `0013_sorters_full_name.sql` —
  uruchomiona i sprawdzona). Tylko na tym ekranie — dashboard, mapper
  i kurier_appp dalej używają nazwy roboczej (`name`).
- **Edycja w tabeli** (`sorters/EditableCell.tsx`): dwuklik w nazwę albo
  imię i nazwisko (lub ✎ — na iPhonie podwójne stuknięcie bywa
  powiększeniem) → pole tekstowe; Enter / kliknięcie obok zapisuje, Esc
  anuluje. Pusta nazwa odrzucana (wraca poprzednia), puste imię
  i nazwisko = wyczyszczone. Błąd zapisu → komunikat + poprzednia wartość.
- Formularz „Dodaj/Edytuj” ma pole „Imię i nazwisko”.
  `updateSorterName` zastąpione przez `updateSorterDetails` (tylko
  podane pola).
- **Backup danych referencyjnych** zapisuje i odtwarza `fullName`; pliki
  sprzed tej zmiany (bez `fullName`) nadal się wgrywają (puste imię
  i nazwisko) — `schemaVersion` bez zmian.

## 2026-10-12 — Poprawki po audycie QA (kurier_appp/RAPORT_QA_2026-10-11.md)

- **Stronicowanie**: `fetchShipments` i `fetchHandledMap` pobierają dane
  stronami (`src/lib/fetchAllPages.ts` + test) — PostgREST oddaje max 1000
  wierszy i nadmiar ucinał PO CICHU (lista przesyłek byłaby niepełna bez
  żadnego błędu).
- **`shipment_actions` tylko dla istniejących przesyłek** (migracja
  `0012_shipment_actions_istniejaca_przesylka.sql`, uruchomiona i
  sprawdzona): zwykły user nie zapisze już „obsłużono” dla nieistniejącego
  `shipment_id` (insert i update). Admin i funkcje serwerowe bez zmian.
- **CSP w trybie Report-Only** w `vercel.json` (decyzja Adriana — nic nie
  blokuje, tylko loguje naruszenia w konsoli przeglądarki). Wymuszanie =
  zmiana nazwy nagłówka na `Content-Security-Policy` po sprawdzeniu konsoli.

## 2026-09-28 — Atomowy zapis importu + import z panelu admina kurier_appp

- **Zapis „wszystko albo nic”**: nowa funkcja bazy `import_shipments`
  (migracja `0011_import_shipments_rpc.sql`) — wpis w `imports` + podmiana
  całej tabeli `shipments` + czyszczenie `shipment_actions` starszych niż
  `p_prune_before`, w jednej transakcji. Zastępuje `replaceShipments`
  (4+ osobne zapytania z przeglądarki) i `pruneShipmentActions`
  (usunięte). Odświeżenie ekranu w trakcie importu nie pokazuje już
  pustej/niepełnej listy, a nieudany zapis zostawia poprzednie dane
  nietknięte (ImportScreen pokazuje wtedy komunikat zamiast cicho wracać
  do podsumowania). `SECURITY INVOKER` — RLS działa jak dotąd (import
  tylko dla admina).
- **Analiza wydzielona do czystego modułu** `import/analyzeImport.ts`
  (dane referencyjne wstrzykiwane funkcją, wołaną dopiero po walidacji
  plików) + `import/importPayload.ts` (budowa argumentów `import_shipments`).
  `pipeline.ts` to teraz cienka nakładka ładująca routes/sortujących z
  bazy shipment.
- **Import z kurier_appp**: panel admina kuriera (Import danych →
  Przesyłki) wgrywa raporty tą samą logiką — ma wygenerowaną kopię
  modułów analizy (skrypt `kurier_appp/pwa/scripts/sync-shipment-pipeline.mjs`)
  i zapisuje przez `import_shipments` kluczem service_role po sprawdzeniu
  roli admina kuriera. **Po każdej zmianie modułów analizy tutaj trzeba
  uruchomić ten skrypt w kurier_appp** (patrz README, sekcja Pipeline).

## 2026-09-25 — Import: starsze przesyłki zostają, reguła 15 minut

- **Zniesiony filtr „tylko dzisiaj”** (`dateFilter/filterToday.ts`
  usunięty). Przesyłki z poprzednich dni zostają w raporcie — na prośbę
  Adriana, będą wykorzystywane.
- **Reguła 15 minut** (`dateFilter/filterByScanCutoff.ts`): na ekranie
  Import nowe pole „Godzina raportu” (nad wyborem plików, domyślnie
  bieżąca godzina). Pomijane są przesyłki z ostatnim skanem w ciągu 15 min
  przed tą godziną **albo później**; wszystko starsze zostaje. Przesyłki
  bez daty ostatniego skanu nadal są pomijane (nie da się ocenić reguły).
  Podsumowanie importu pokazuje obie liczby pominiętych.
- **Deduplikacja**: reprezentantem Shipment ID jest teraz wiersz z
  **najnowszym** skanem (wcześniej pierwszy w pliku), bo reguła 15 minut
  dotyczy ostatniego skanu. Kolejność: deduplikacja → reguła 15 minut.
- **Retencja „Obsłużono”**: `pruneShipmentActions` usuwa tylko wpisy
  starsze niż najstarsza przesyłka w imporcie (wcześniej: wszystko sprzed
  dzisiaj — przy zachowanych starszych przesyłkach kasowałoby ich
  oznaczenia). Przesyłka, która dostanie nowy skan w nowym dniu, ma nowy
  klucz `(shipment_id, shipment_date)` i wraca jako nieobsłużona.
- `ImportSummary.todayRows` → `resultRows` (w bazie dalej kolumna
  `imports.today_rows`) + `recentSkippedRows`, `noDateRows`, `cutoffAt`.

## 2026-09-25 — „Dubel” Chute ID: jedna brama → kilka tras

- Decyzja Adriana (opcja A): jeden Chute ID może być przypisany do kilku
  tras; przesyłka z takiej bramy trafia przy imporcie na **każdą** z nich
  (`mapRoutes` tworzy osobny rekord `Shipment` per trasa, ten sam
  `shipmentId` — więc „Obsłużono” jest wspólne dla wszystkich kopii, także
  w kurier_appp). Liczniki grup/importu liczą każdą kopię.
- Migracja `0010_routes_dubel_chute_id.sql`: `unique(chute_id)` →
  `unique(chute_id, trasa)`; `upsertRoute` robi `onConflict` na tej
  parze. **Musi być uruchomiona przed wdrożeniem kodu** (inaczej zapis
  trasy zwraca błąd).
- „Dane referencyjne”: wiersze dubla podświetlone na czerwono
  (`--dubel-bg` + czerwony pasek), liczone po wszystkich trasach
  (nie tylko po aktywnym filtrze grupy) tym samym kluczem co Mapper.
- Karty przesyłek: klucz React `shipmentId|trasa` (ta sama przesyłka może
  być dwa razy na liście P2/COY004).

## 2026-09-25 — Karty przesyłek zamiast tabeli + wyraźniejsze „Obsłużono”

- `SorterTable`: tabela z 12 kolumnami zastąpiona **kartami** (wzorem
  kafelka „Przed wyjazdem” w kurier_appp) — mieszczą się na ekranie
  telefonu, bez przewijania w bok. Na karcie: Shipment ID (+ trasa w
  widokach bez poziomu trasy), godzina i data skanu (`HH:mm · DD.MM`,
  nowe `formatTimeAndDate`), Consignee, ulica i miasto, Weight/Dimension
  w osobnych liniach, Niezeskanowane, Total Pcs, Last CP, Remarks,
  przełącznik „Obsłużono”. Sortowanie przeniesione z nagłówków kolumn na
  przyciski „Sortuj: Czas / Consignee / Trasa”.
- Kolor „Obsłużono”: `--handled-bg` z prawie białego `#f0fdf4` na
  `#bbf7d0` + zielony pasek/obramowanie karty + napis „✓ Obsłużono”.
  Powód: w telefonach z wymuszonym trybem ciemnym przeglądarka sama
  przyciemnia stronę i stare, prawie białe tło było nie do odróżnienia
  od zwykłej karty.
- `parseWeightDimension` dopisuje zero przed ułamkiem (`.538` → `0.538`).

## 2026-09-25 — Tabela przesyłek: sortowanie po czasie, obsłużone na dole

- `SorterTable`: domyślne sortowanie po **Czas** (`lastPhyCpDt`, najstarsze
  pierwsze) we wszystkich widokach tabeli (wcześniej Trasa albo Consignee
  Name). Kliknięcie nagłówka nadal zmienia sortowanie.
- Przesyłki oznaczone **„Obsłużono”** zawsze spadają na sam dół listy,
  niezależnie od wybranej kolumny sortowania — i od razu po przełączeniu.
- Stan „Obsłużono” jest od 2026-09-25 przełączany także z aplikacji
  kurier_appp (kafelek „Przed wyjazdem”, przez jej funkcję serwerową z
  kluczem `service_role` tego projektu) — ta sama tabela `shipment_actions`.

## 2026-07-31 — Sprint UX 1.1: czytelność i obsługa błędów

Bez zmian w pipeline'ie biznesowym (Parser→Normalizer→Join→Date
Filter→Deduplicate→Mapper→Analyzer→Repository) — same dodatki UI/
operacyjne nad istniejącym wynikiem.

- **Kolumna „Czas”** na ekranie tabeli błędów (przed „Remarks”) —
  `HH:mm` wyliczane przy renderowaniu z `Last Phy Cp dt`
  (`formatTimeHHmm` w `normalizer/normalize.ts`), bez zapisu nowej
  kolumny w bazie. Puste/niepoprawne → `—`.
- **Oznaczanie „Obsłużono”** — Switch na końcu każdego wiersza,
  informacja "ktoś już się tym zajmuje" (NIE "rozwiązane"). Zapis
  natychmiastowy (optymistyczny update + revert przy błędzie), wiersz
  dostaje jasnozielone tło (`--handled-bg`, bez zmiany koloru tekstu,
  bez animacji), stan przetrwa odświeżenie strony i ponowny import tego
  samego dnia.
  - Nowa tabela `shipment_actions` (migracja `0009_shipment_actions.sql`)
    — celowo NIE w `shipments` (które jest nadpisywane w całości przy
    każdym imporcie). Klucz złożony `(shipment_id, shipment_date)`.
    RLS: admin pełny dostęp, zwykły zalogowany „user” (operator) może
    czytać/tworzyć/aktualizować, ale nie usuwać — spójne z istniejącym
    wzorcem `shipments_admin_all` + `shipments_user_select` z `0007`.
  - Retencja: brak historii — `ImportScreen` po każdym udanym imporcie
    wywołuje `pruneShipmentActions` (best-effort, błąd nie maskuje
    udanego zapisu `shipments`), które usuwa wpisy z innym
    `shipment_date` niż dzisiejszy. Pierwsze wywołanie danego dnia
    realnie czyści, kolejne tego samego dnia są no-opem.
  - Nowy moduł `ShipmentActionRepository` (jedyny plik wołający
    Supabase dla tego stanu) + 13 nowych testów.
- **Licznik „Obsłużono: X / Y przesyłek”** nad tabelą — liczony nad już
  przefiltrowanym/posortowanym zestawem wierszy (respektuje aktywne
  zawężenie grupy/sortera/trasy), zero dodatkowych zapytań (stan
  `handled` pobierany raz na `reload()`, łączony w pamięci).
- **Jasny motyw** — pełna podmiana palety (`src/styles.css`) na jasną,
  zgodną z estetyką Microsoft 365/Stripe/Linear/Notion (tło `#F8FAFC`,
  karty `#FFFFFF`, tekst `#1F2937`, akcent `#2563EB`). Wyższe wiersze
  tabel, wyraźniejsze nagłówki, naprzemienne kolory wierszy, delikatny
  hover. Sam układ aplikacji bez zmian — wyłącznie warstwa wizualna.
- 8 nowych testów w `normalize.test.ts` (`formatTimeHHmm`,
  `toLocalDateKey`) + 13 w `shipmentActionRepository.test.ts` — razem
  175 testów w projekcie, progi pokrycia (90% global / 100%
  `normalizer/**` i pozostałe already-100% katalogi) bez zmian.

## 2026-07-30 — Sprint Stabilizacyjny 1.0, część 2: monitoring błędów (Sentry)

- `@sentry/react` (front-end) + `@sentry/node` (Vercel Serverless
  Functions), jedna zmienna `VITE_SENTRY_DSN` dla obu środowisk.
  Opcjonalna — brak DSN wyłącza monitoring, aplikacja działa normalnie.
- Jeden punkt wejścia: `src/lib/sentry.ts` (init) i
  `modules/monitoring/reportError.ts` (jedyna funkcja, przez którą
  reszta kodu zgłasza błędy — nikt inny nie woła `Sentry.*`
  bezpośrednio), analogicznie `api-lib/sentry.ts` dla `api/*.ts`.
- Globalny Error Boundary (`modules/monitoring/ErrorBoundary.tsx`)
  owija `AppShell` — czytelny komunikat PL, bez stack trace.
- `reportError` wpięty w: wszystkie `repository/*.ts` (błędy komunikacji
  z Supabase), `api/admin-*.ts` + `api-lib/adminAuth.ts` (błędy
  serwerowe), `ImportScreen` (nieoczekiwane błędy parsera/pipeline —
  `PipelineError`, czyli oczekiwana walidacja pokazywana użytkownikowi,
  świadomie NIE jest raportowana), `userRepository` (tylko awarie
  sieciowe do endpointów admina, nie zwykłe 400).
- Brak PII projektowo — `reportError` dostaje wyłącznie `{module, stage}`,
  nigdy surowych obiektów `Shipment`/`Profile`/`User`. `beforeSend` w
  `lib/sentry.ts` jako dodatkowa obrona (usuwa cookies/`Authorization`/
  podejrzane klucze `extra.*`).
- Release = krótki SHA gita wstrzykiwany przez `vite.config.ts`
  (`define`) — grupuje zdarzenia per-deploy bez Sentry CLI/auth tokena.

## 2026-07-30 — Sprint Stabilizacyjny 1.0, część 3: backup/restore danych referencyjnych

- Nowa sekcja "Kopia zapasowa" na dole ekranu **Dane referencyjne**:
  eksport (`routes`/`sorters`/`sorter_routes` jako plik JSON) i import
  z podglądem błędów walidacji, potwierdzeniem ("Obecna konfiguracja
  zostanie zastąpiona...") i podsumowaniem liczb po imporcie.
- **Prawdziwa transakcyjność importu** — nie "najlepsze starania".
  Supabase REST nie ma pojęcia transakcji obejmującej kilka osobnych
  zapytań z przeglądarki, więc cały import robi jedna funkcja SQL
  (`replace_reference_data`, migracja `0008_backup_restore.sql`)
  wywoływana przez `supabase.rpc(...)` — błąd w dowolnym miejscu (zła
  `grupa`, zerwana referencja) cofa WSZYSTKO w ramach jednej transakcji
  Postgresa.
- Format: `{ appVersion, schemaVersion, createdAt, createdBy, routes,
  sorters, sorterRoutes }` — `sorterRoutes` referencjonuje sortujących
  po **id z chwili eksportu** (`sorterId`), nie po nazwie. Import mapuje
  "id z eksportu" → "nowe id" (kolumny identity nadają nowe ID przy
  każdym imporcie) w ramach jednej transakcji SQL.
- Nowe moduły: `ReferenceBackupService` (cała logika — eksport,
  walidacja, wersjonowanie; komponenty React nie znają formatu JSON) i
  `backupRepository` (jedyny plik wołający RPC).
- 20 nowych testów (walidacja: brak pól, zła wersja schematu, zerwane
  referencje, zdeformowane wpisy w tablicach, rozróżnianie sortujących
  o tej samej nazwie po id).

**Dwie poprawki znalezione podczas weryfikacji na prawdziwych danych
produkcyjnych (przed wdrożeniem, żadne dane nie ucierpiały):**

- Postgres odrzuca `DELETE` bez `WHERE` nawet gdy to trywialne `WHERE
  true` (błąd `21000`) — migracja używa `WHERE id >= 0`, ten sam
  sprawdzony wzorzec co w `shipmentsRepository.replaceShipments`.
- Pierwsza wersja referencjonowała sortujących po nazwie (`sorterName`).
  W realnych danych imiona **nie są unikalne** (dwaj sortujący o imieniu
  "Piotrek", dwaj "Dima") — import po nazwie połączyłby przypisania
  tras różnych osób w jedną. Naprawione przez referencjonowanie po
  `sorterId` (patrz wyżej). Zweryfikowane round-tripem na prawdziwych
  danych: obie pary zachowały osobne przypisania tras po imporcie.

## 2026-07-30 — Sprint Stabilizacyjny 1.0, część 1: testy jednostkowe

Bez zmian w pipeline'ie biznesowym — same testy chroniące go przed
regresją.

- Vitest + `@vitest/coverage-v8`. Środowisko `node` (nie `jsdom`) —
  cała testowana logika jest czystym TS, bez potrzeby DOM-a.
- 134 testy dla: Parser, Normalizer, Join, Date Filter, Deduplicate,
  Mapper, Analyzer (`summarize` + `dashboard/grouping.ts`), Repository
  (`shipments`/`routes`/`sorter`/`profile`/`user`, Supabase mockowany —
  nigdy nie dotyka prawdziwej bazy), oraz integracyjne testy całego
  `runImportPipeline`.
- Testy parsera używają **prawdziwych plików .xlsx** budowanych w
  pamięci tą samą biblioteką co produkcyjnie (`src/test/xlsxFixture.ts`)
  — w tym scenariusz z niespójnymi spacjami w nagłówku, dokładnie ta
  klasa błędu, którą naprawialiśmy ręcznie dwa razy wcześniej (data,
  potem Weight/Dimension).
- Pokrycie: 97.68% instrukcji / 91.53% gałęzi / 100% funkcji / 99.2%
  linii globalnie (próg 90%), **100% dla Parser/Mapper/Joiner/Date
  Filter** (wymagane osobno). Dwa miejsca celowo wyłączone z liczenia
  pokrycia (`/* v8 ignore next */`) jako faktycznie nieosiągalne przy
  realnym wejściu — udokumentowane w kodzie dlaczego.
- Nowe skrypty: `npm test`, `npm run test:watch`, `npm run test:coverage`.

## 2026-07-30 — Poprawki znalezione przy weryfikacji logowania

Przy end-to-end teście funkcji `api/admin-*.ts` (przez curl, z prawdziwym
kontem admina) wyszły dwa błędy:

- `ERR_MODULE_NOT_FOUND` dla `api-lib/adminAuth` — Node ESM (repo ma
  `"type": "module"`) wymaga jawnego rozszerzenia `.js` w imporcie
  relatywnym; działało w lokalnym typecheck (tam liczą się typy, nie
  runtime resolution), ale nie na Vercelu. Wszystkie trzy endpointy
  kończyły się 500 zanim doszły do jakiejkolwiek logiki.
- Brak `console.error` przy błędach w `api/admin-*.ts` — Vercel logs
  pokazywały pusty `message`, więc diagnoza pierwszego błędu wymagała
  zgadywania. Dodane logowanie w każdym punkcie awarii.

Po poprawkach pełny łańcuch (logowanie → dodanie użytkownika → zmiana
hasła → blokada samo-usunięcia → usunięcie z kasowaniem profilu →
403 dla nie-admina) zweryfikowany end-to-end i działa.

## 2026-07-29 — Logowanie i zarządzanie użytkownikami (Supabase Auth + RLS)

Domyka punkt z audytu bezpieczeństwa 2026-07-26, który wtedy został
świadomie odłożony (RLS otwarte, brak logowania).

- Supabase Auth, logowanie loginem (nie e-mailem — login mapowany
  deterministycznie na syntetyczny e-mail `@shipment-analyzer.local`,
  nigdy pokazywany użytkownikowi).
- Dwie role: `admin` (pełny dostęp do wszystkiego) i `user` (tylko
  Dashboard — podgląd/filtrowanie/sortowanie, bez importu i zarządzania).
- Nowa tabela `profiles` (login + rola), funkcja `is_admin()`
  (`security definer`, unika rekurencji RLS przy sprawdzaniu roli z tej
  samej tabeli, którą polityka chroni).
- Nowa zakładka **Użytkownicy** (tylko admin): lista, dodawanie
  (zawsze rola `user`, bez wyboru), zmiana hasła bez e-maila, usuwanie
  z potwierdzeniem.
- **Kluczowa decyzja architektoniczna:** operacje admina na kontach
  wymagają klucza `service_role` (pełny bypass RLS + admin auth) —
  taki klucz nigdy nie może trafić do kodu przeglądarki. Rozwiązanie:
  trzy wąskie Vercel Serverless Functions (`api/admin-*.ts`), które same
  weryfikują sesję i rolę admina, zanim wykonają operację uprzywilejowaną.
  `UserRepository` w froncie woła je przez `fetch`, nigdy nie dotyka
  `service_role`.
- Menu użytkownika w prawym górnym rogu (login, rola, "Wyloguj").
  Ekrany admina dodatkowo owinięte `AdminRoute` — obrona w głąb, gdyby
  stan nawigacji jakoś tam trafił bez nav-linka (przekierowanie na
  Dashboard).
- **Wdrożenie dwuetapowe, żeby nie zablokować dostępu:** migracja
  `0006_auth.sql` (profiles + is_admin, RLS reszty tabel bez zmian) →
  kod wdrożony i przetestowany z prawdziwym logowaniem → dopiero wtedy
  `0007_lock_down_rls.sql` (usuwa `using (true)`, zamyka anonimowy
  dostęp). Pipeline (Parser→...→Repository) bez zmian.

## 2026-07-29 — Filtr po grupie w "Dane referencyjne"

- Nad tabelą doszła rozwijana lista "Filtruj po grupie" (Wszystkie /
  P1 / P2 / P3) — zawęża widoczne wiersze, działa razem z sortowaniem
  po kolumnach.

## 2026-07-29 — Sortowanie po każdej kolumnie (Dane referencyjne, Sortujący)

- "Dane referencyjne": każda kolumna (Chute ID, Trasa, Grupa) ma teraz
  klikalny nagłówek — sortowanie pojedynczo po jednej na raz.
- "Sortujący": doszło sortowanie po kolumnie "Trasy" — po pierwszej
  (alfabetycznie) trasie danego sortującego. Obok, jak dotąd, po nazwie.

## 2026-07-29 — Sortujący: lista tras w tabeli, poprawka nawigacji, kolory w selektorze

- Lista sortujących: kolumna "Liczba przypisanych tras" zastąpiona
  kolumną "Trasy" — wypisuje przypisane trasy po przecinku, mniejszą
  czcionką, zamiast samej liczby.
- Naprawiona nawigacja wstecz: ekrany dodawania/edycji sortującego
  (`sorters-add`, `sorters-edit`) są teraz częścią historii nawigacji
  (`useNavigation`), a nie lokalnego stanu komponentu — wcześniej cofanie
  z edycji trafiało na Dashboard zamiast do listy Sortujący, bo hardware
  back nie "widział" wewnętrznego przełącznika trybu.
- Selektor tras w formularzu (dodawanie/edycja) pokazuje teraz też trasy
  przypisane innym sortującym — na czerwono (zajęta, wybór i zapis
  przejmuje ją) — obok wolnych, na zielono. `replaceSorterRoutes` używa
  teraz upsert po `route` zamiast insert, żeby przejęcie nie wywalało
  błędu unique constraint.

## 2026-07-29 — Poprawka sortowania: "Sortujący 2" przed "Sortujący 10"

- Sortowanie po nazwie sortującego (lista) i kafelki sortujących na
  Dashboardzie (P1/P3) używały zwykłego porównania tekstowego, więc
  "Sortujący 10" wypadał przed "Sortujący 2". Zamienione na
  `Intl.Collator` z opcją `numeric: true` (`normalizer/normalize.ts`,
  `naturalCompare`) — rozpoznaje liczby wewnątrz tekstu i porównuje je
  liczbowo, działa tak samo dobrze dla samych numerów jak i prawdziwych
  imion bez cyfr.

## 2026-07-29 — Czytelniejsza edycja sortującego, sortowanie listy

- Lista w zakładce Sortujący: kliknięcie nagłówka "Nazwa sortującego"
  sortuje alfabetycznie (drugie kliknięcie odwraca).
- Ekran edycji: między nazwą a selektorem tras pojawia się osobne okienko
  "Przypisane trasy" — pokazuje wyłącznie trasy już przypisane do tego
  sortującego, każda z przyciskiem usunięcia. Selektor niżej służy już
  tylko do dokładania nowych (nie miesza się z długą listą istniejących).
  Rozwiązuje nieczytelność przy dużej liczbie tras.

## 2026-07-28 — Zarządzanie sortującymi (nowa zakładka, relacja zamiast kolumny)

- Nowa zakładka **Sortujący**: lista (nazwa / liczba tras / status
  aktywny-nieaktywny / edytuj-usuń), formularz dodawania z multi-select
  tras (tylko wolne trasy z `routes`, bez ręcznego wpisywania), edycja
  (zmiana nazwy, dodawanie/usuwanie tras, dezaktywacja).
- Nowe tabele Supabase: `sorters` (osoba) i `sorter_routes` (trasa →
  sortujący, `route unique` wymusza "jedna trasa = jeden sortujący").
  Brak twardego FK do `routes.trasa`, bo ta kolumna nie jest unikalna w
  `routes` (kilka bram może mieć tę samą trasę) — spójność pilnowana w
  UI (dropdown tylko z realnych wartości `routes.trasa`).
- Nowy moduł `SorterRepository` — jedyne miejsce, które zna te dwie
  tabele; logika przypisania nie siedzi w komponentach.
- Mapper: przypisanie sortującego czyta teraz `sorters`/`sorter_routes`
  zamiast `routes.sortujacy`. Brak przypisania dla trasy → stary
  fallback (3. litera trasy) — bez zmian, zachowuje zgodność z P2 i
  dowolną trasą jeszcze nieprzypisaną.
- Dashboard pokazuje nazwę sortującego (np. "Sortujący 5") zamiast
  surowego numeru z `routes.sortujacy` — źródło to wyłącznie nowa relacja.
- **Migracja danych**: 45 starych przypisań `routes.sortujacy`
  (P1: 1–10, P3: 11–17) przeniesione do 17 nowych rekordów `sorters`
  (tymczasowe nazwy "Sortujący 1".."17" — do zmiany na prawdziwe imiona
  w nowej zakładce) i 31 przypisań tras. **7 tras pominiętych** — miały
  sprzeczne dane w starym systemie (ta sama trasa przypisana do dwóch
  różnych sortujących pod różnymi bramami): WAFA, WAFB, WAFD, WAFE,
  WAFF, WAFX, WALB. Wracają na fallback (3. litera trasy), dopóki ktoś
  ręcznie nie przypisze ich w zakładce Sortujący.
- `routes.sortujacy` usunięte z kodu aplikacji. Migracja `0005` (drop
  kolumny w bazie) czeka na uruchomienie po weryfikacji, że wszystko
  działa na produkcji — jedno źródło prawdy zamiast dwóch, docelowo.

## 2026-07-26 — Audyt bezpieczeństwa: łatane zależności i nagłówki

- `xlsx` (SheetJS) miał 2 niezałatane luki wysokiego ryzyka w wersji z npm
  (prototype pollution, ReDoS) — przełączone na oficjalnie załataną wersję
  0.20.3 z CDN SheetJS (npm nie publikuje już poprawek do tej paczki).
  Wersja przypięta na sztywno (nie "latest"), żeby build był powtarzalny.
- Dodany `vercel.json` z nagłówkami bezpieczeństwa (X-Content-Type-Options,
  X-Frame-Options, Referrer-Policy, Permissions-Policy) — wcześniej ich
  brakowało.
- Drobna łatka `brace-expansion` (dev-dependency, tylko etap builda).
- **Świadomie odłożone (decyzja Adriana, 2026-07-26):** tabele Supabase
  mają RLS otwarte dla każdego z kluczem anon (`using (true)`) i aplikacja
  nie ma logowania — każdy ze znajomym adresem/kluczem może odczytać i
  skasować dane, w tym PII odbiorców z Sherloc. Zapytany, czy wdrożyć
  Supabase Auth + RLS oparte o `auth.uid()`, Adrian wybrał zostawienie tego
  otwartego na razie. Do podjęcia w przyszłości — plan jest gotowy
  (patrz `supabase/migrations/0001_init.sql`, sekcja RLS).

## 2026-07-26 — Czytelny Weight / Dimension

- Kolumna Weight/Dimension pokazuje teraz rozbite dane zamiast surowego
  tekstu `< R > < 3.05 > < 32 X 10 X 32.5 >`:
  waga / długość / wysokość / szerokość, każde w osobnej linii
  (`parseWeightDimension.ts`). Gdy format się nie zgadza, wraca do
  pokazania surowej wartości zamiast zgadywać.

## 2026-07-26 — Zmiana etykiety kolumny

- Nagłówek kolumny w tabeli zmieniony z "Shp Tot Pcs" na "Total Pcs"
  (tylko etykieta — dane i nazwa pola bez zmian).

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
