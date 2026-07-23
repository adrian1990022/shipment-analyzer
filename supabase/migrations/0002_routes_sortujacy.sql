-- Jawne przypisanie sortujacego do bramy (Chute ID), zamiast wylacznie
-- wyliczania go z 3. litery trasy.
-- NULL = Mapper spada na dotychczasowa regule MVP (3. litera trasy) --
-- dotyczy to dzis calej grupy P2 oraz kazdej bramy P1/P3 bez jawnego wpisu.
alter table public.routes add column if not exists sortujacy text;

comment on column public.routes.sortujacy is
  'Jawne przypisanie sortujacego do bramy (np. "1".."17"). NULL = Mapper uzywa reguly MVP (3. litera trasy).';
