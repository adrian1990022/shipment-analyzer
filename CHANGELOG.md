# Changelog

Rejestr zmian w Shipment Analyzer — po co, żeby łatwo wrócić do dowolnego
stanu aplikacji. Każdy wpis tutaj odpowiada jednemu commitowi w gita
(`git log` pokaże dokładny diff; `git checkout <hash> -- .` albo
`git revert <hash>` pozwala się cofnąć do/po danej zmianie).

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
