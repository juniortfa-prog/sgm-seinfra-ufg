begin;

alter table public.sgm_campaigns
    add column import_manifest_sha256 text
    check (import_manifest_sha256 ~ '^[0-9a-f]{64}$');

alter table public.sgm_orders
    add column source_record jsonb
    check (jsonb_typeof(source_record) = 'object');

-- O envelope de auditoria fica com o operador da carga. A aplicação segue
-- consultando as colunas projetadas sob as políticas de RLS existentes.
revoke select on public.sgm_orders from authenticated;
grant select (campaign_id, os_id, source_position, opened_on, original_os,
    prepared_classification, reconciled_location, in_v549_24m_balance)
    on public.sgm_orders to authenticated;

commit;
