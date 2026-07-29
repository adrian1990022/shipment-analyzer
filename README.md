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
    referenceData/             UI administracji tabela routes
    sorters/                   UI zarzadzania sortujacymi (sorters + sorter_routes)
    users/                     UI zarzadzania kontami (admin-only)
    auth/                      AuthProvider, LoginScreen, AdminRoute, authService
    import/                    orkiestracja pipeline'u + ekran importu
    dashboard/                 kafelki grup -> sortujacy -> tabela
  types/                       modele danych (Report, Shipment, auth)
api/                           Vercel Serverless Functions (admin-create-user,
                                admin-change-password, admin-delete-user)
api-lib/                       wspolny kod dla api/* (poza katalogiem api/,
                                zeby Vercel go nie routowal) -- tu i TYLKO
                                tu zyje SUPABASE_SERVICE_ROLE_KEY
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
