-- Kolumna "Imie i nazwisko" sortujacego (2026-10-12, decyzja Adriana).
-- Opcjonalna (null = nie wpisano) -- "name" zostaje nazwa robocza widoczna
-- wszedzie indziej (Dashboard, Mapper, kurier_appp "Przed wyjazdem"),
-- full_name jest tylko na ekranie "Sortujacy" (admin). RLS bez zmian
-- (sorters_admin_all -- tylko admin), wiec dane osobowe nie wychodza poza admina.

begin;

alter table public.sorters
  add column if not exists full_name text
  check (full_name is null or char_length(full_name) <= 100);

comment on column public.sorters.full_name is
  'Imie i nazwisko sortujacego (opcjonalne, tylko ekran Sortujacy). null = nie wpisano.';

-- Backup/restore danych referencyjnych: fullName w pliku jest OPCJONALNY --
-- pliki sprzed tej zmiany (bez fullName) nadal sie wgrywaja, z pustym
-- imieniem i nazwiskiem. Reszta funkcji bez zmian (patrz 0008).
create or replace function public.replace_reference_data(payload jsonb)
returns void
language plpgsql
as $$
declare
  route jsonb;
  sorter jsonb;
  sr jsonb;
  new_sorter_id bigint;
  -- Klucz to id sortujacego Z CHWILI EKSPORTU, nie nazwa -- w realnych
  -- danych imiona nie sa unikalne (np. dwoch "Piotrek", dwoch "Dima"),
  -- wiec mapowanie po nazwie laczyloby przypisania roznych osob.
  sorter_id_by_old_id jsonb := '{}'::jsonb;
begin
  -- "where id >= 0" jest wymagane -- ochrona przed przypadkowym DELETE
  -- bez WHERE odrzuca nawet "where true" (nie referencjonuje zadnej
  -- kolumny), ale akceptuje warunek na id -- ten sam sprawdzony wzorzec
  -- co w shipmentsRepository.replaceShipments (dziala tam od poczatku).
  -- Wszystkie id sa dodatnie (bigint identity), wiec dopasowuje kazdy wiersz.
  delete from public.sorter_routes where id >= 0;
  delete from public.sorters where id >= 0;
  delete from public.routes where id >= 0;

  for route in select * from jsonb_array_elements(payload->'routes')
  loop
    insert into public.routes (chute_id, trasa, grupa)
    values (route->>'chuteId', route->>'trasa', route->>'grupa');
  end loop;

  for sorter in select * from jsonb_array_elements(payload->'sorters')
  loop
    insert into public.sorters (name, active, full_name)
    values (sorter->>'name', (sorter->>'active')::boolean, nullif(btrim(sorter->>'fullName'), ''))
    returning id into new_sorter_id;
    sorter_id_by_old_id := jsonb_set(sorter_id_by_old_id, array[sorter->>'id'], to_jsonb(new_sorter_id));
  end loop;

  for sr in select * from jsonb_array_elements(payload->'sorterRoutes')
  loop
    insert into public.sorter_routes (sorter_id, route)
    values ((sorter_id_by_old_id->>(sr->>'sorterId'))::bigint, sr->>'route');
  end loop;
end;
$$;

notify pgrst, 'reload schema';

commit;
