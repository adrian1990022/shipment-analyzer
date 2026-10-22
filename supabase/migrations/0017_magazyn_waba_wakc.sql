-- Kafelek "Magazyn" + trasy WABA/WAKC (2026-10-22, decyzje Adriana):
--   - grupa MAGAZYN: kody magazynowe z bazy przypisan tras (WAGM, WAW1) --
--     regula w mapRoutes.ts (lista na stale w kodzie, jak COY004),
--   - WABA -> P2, WAKC -> P3 w Danych referencyjnych. Chute ID = sam kod
--     trasy (prawdziwych bram Adrian nie zna, a od 0016 Chute ID nie wplywa
--     na przypisanie -- wiersz ma byc tylko czytelny).
--
-- KOLEJNOSC WDROZENIA: ta migracja PRZED kodem -- nowy kod zapisuje grupe
-- MAGAZYN, ktorej stare ograniczenie by nie przepuscilo (import by padl).

begin;

alter table public.shipments drop constraint if exists shipments_grupa_check;
alter table public.shipments
  add constraint shipments_grupa_check check (grupa in ('P1', 'P2', 'P3', 'COY004', 'MAGAZYN', 'NIEPRZYPISANE'));

insert into public.routes (chute_id, trasa, grupa)
values ('WABA', 'WABA', 'P2'), ('WAKC', 'WAKC', 'P3')
on conflict (chute_id, trasa) do nothing;

notify pgrst, 'reload schema';

commit;
