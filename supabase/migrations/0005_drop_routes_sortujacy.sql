-- Uruchomic DOPIERO gdy Claude potwierdzi, ze dane z routes.sortujacy
-- zostaly bezpiecznie przeniesione do sorters/sorter_routes (migracja 0004).
-- Od tego momentu przypisanie sortujacego zyje wylacznie w tych dwoch
-- tabelach -- routes.sortujacy staje sie martwa kolumna i mogloby to
-- wprowadzac w blad (dwa "zrodla prawdy" jednoczesnie).
alter table public.routes drop column if exists sortujacy;
