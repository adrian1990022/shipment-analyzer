-- Dodatkowa kolumna z Panoramy (Shp Tot Pcs) oraz licznik wystapien
-- danego Shipment ID w dzisiejszych danych (deduplikacja w pipeline'ie --
-- patrz modules/dedup/dedupeByShipmentId.ts).
alter table public.shipments add column if not exists shp_tot_pcs numeric;
alter table public.shipments add column if not exists wystapilo integer not null default 1;

comment on column public.shipments.shp_tot_pcs is
  'Wartosc z kolumny "Shp Tot Pcs" raportu Panorama.';
comment on column public.shipments.wystapilo is
  'Ile razy dany Shipment ID wystapil w dzisiejszych danych Panorama przed deduplikacja (1 = bez duplikatow).';
