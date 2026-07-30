-- Backup / restore danych referencyjnych (routes, sorters, sorter_routes).
--
-- Prawdziwa transakcyjnosc importu wymaga funkcji SQL: klient Supabase
-- (REST/PostgREST) nie ma pojecia "transakcja obejmujaca wiele osobnych
-- zapytan z przegladarki" -- kazde .from(...) to osobna transakcja. Cale
-- cialo funkcji ponizej to JEDNA transakcja: blad w dowolnym miejscu
-- (np. grupa spoza P1/P2/P3, albo referencja do nieistniejacego
-- sortujacego) cofa WSZYSTKO, zgodnie z wymogiem "import jest
-- transakcyjny, blad = nie zapisuj czesci danych".
--
-- Funkcja NIE jest security definer -- dziala jako wywolujacy, wiec
-- istniejace polityki RLS (routes_admin_all, sorters_admin_all,
-- sorter_routes_admin_all) nadal obowiazuja bez duplikowania sprawdzania
-- roli admina wewnatrz funkcji.
create or replace function public.replace_reference_data(payload jsonb)
returns void
language plpgsql
as $$
declare
  route jsonb;
  sorter jsonb;
  sr jsonb;
  new_sorter_id bigint;
  sorter_id_by_name jsonb := '{}'::jsonb;
begin
  -- "where true" jest wymagane -- Supabase domyslnie blokuje DELETE bez
  -- klauzuli WHERE (ochrona przed przypadkowym wyczyszczeniem tabeli),
  -- a tu naprawde chcemy skasowac wszystko.
  delete from public.sorter_routes where true;
  delete from public.sorters where true;
  delete from public.routes where true;

  for route in select * from jsonb_array_elements(payload->'routes')
  loop
    insert into public.routes (chute_id, trasa, grupa)
    values (route->>'chuteId', route->>'trasa', route->>'grupa');
  end loop;

  for sorter in select * from jsonb_array_elements(payload->'sorters')
  loop
    insert into public.sorters (name, active)
    values (sorter->>'name', (sorter->>'active')::boolean)
    returning id into new_sorter_id;
    sorter_id_by_name := jsonb_set(sorter_id_by_name, array[sorter->>'name'], to_jsonb(new_sorter_id));
  end loop;

  for sr in select * from jsonb_array_elements(payload->'sorterRoutes')
  loop
    insert into public.sorter_routes (sorter_id, route)
    values ((sorter_id_by_name->>(sr->>'sorterName'))::bigint, sr->>'route');
  end loop;
end;
$$;

comment on function public.replace_reference_data(jsonb) is
  'Odtwarza routes/sorters/sorter_routes z backupu JSON w jednej transakcji (uzywane przez ReferenceBackupService). sorterRoutes referencjonuje sortujacych po nazwie (sorterName), bo ID sa nadawane od nowa przy kazdym imporcie.';

grant execute on function public.replace_reference_data(jsonb) to authenticated;
