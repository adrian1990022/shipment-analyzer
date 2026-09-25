-- "Dubel" Chute ID (2026-09-25, decyzja Adriana -- opcja A): jedna brama
-- (Chute ID) moze byc przypisana do KILKU tras. Przesylka z takiej bramy
-- trafia przy imporcie na kazda z tych tras (Mapper, mapRoutes.ts), a
-- wiersze dubla sa podswietlane na czerwono w "Dane referencyjne".
--
-- Zamiast unikalnego chute_id -- unikalna PARA (chute_id, trasa): ta sama
-- brama z ta sama trasa dalej nie moze wystapic dwa razy (upsertRoute
-- robi onConflict na tej parze, czyli ponowny zapis tylko zmienia grupe).
--
-- KOLEJNOSC WDROZENIA: uruchomic PRZED wdrozeniem kodu -- nowy kod
-- (onConflict "chute_id,trasa") wymaga tego ograniczenia, bez niego zapis
-- trasy w "Dane referencyjne" zwroci blad.

alter table public.routes drop constraint if exists routes_chute_id_key;

alter table public.routes
  add constraint routes_chute_id_trasa_key unique (chute_id, trasa);

comment on table public.routes is
  'Dane referencyjne: Chute ID -> Trasa -> Grupa (P1/P2/P3). Jeden Chute ID moze miec kilka tras ("dubel", od 0010) -- przesylka trafia wtedy na kazda z nich. Chute ID = COY004 NIE korzysta z tej tabeli (obsluga specjalna w Mapperze).';
