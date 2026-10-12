-- Audyt QA 2026-10-11 (kurier_appp/RAPORT_QA_2026-10-11.md, #12): zwykly
-- "user" mogl zapisac "obsluzono" dla DOWOLNEGO shipment_id, takze
-- nieistniejacego (smieciowe wiersze). Teraz insert/update przez usera
-- wymaga, zeby przesylka byla w shipments. Data celowo NIE sprawdzana --
-- tylko istnienie przesylki (logika daty zostaje po stronie aplikacji).
-- Admin (shipment_actions_admin_all) i funkcje serwerowe (service role)
-- bez zmian. Istniejace wiersze nie sa ruszane (retencja jak dotad).

begin;

drop policy if exists shipment_actions_user_insert on public.shipment_actions;
create policy shipment_actions_user_insert on public.shipment_actions
  for insert with check (
    auth.uid() is not null
    and exists (select 1 from public.shipments s where s.shipment_id = shipment_actions.shipment_id)
  );

drop policy if exists shipment_actions_user_update on public.shipment_actions;
create policy shipment_actions_user_update on public.shipment_actions
  for update using (auth.uid() is not null)
  with check (
    auth.uid() is not null
    and exists (select 1 from public.shipments s where s.shipment_id = shipment_actions.shipment_id)
  );

commit;
