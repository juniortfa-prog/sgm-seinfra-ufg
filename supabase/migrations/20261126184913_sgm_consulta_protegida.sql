begin;

create table public.sgm_profiles (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null check (role in ('gestor', 'supervisor', 'encarregado', 'secretaria_os')),
    active boolean not null default false
);

create table public.sgm_campaigns (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    expected_count integer not null check (expected_count between 1 and 100000),
    original_metadata jsonb not null check (jsonb_typeof(original_metadata) = 'object'),
    sites_catalog jsonb not null check (jsonb_typeof(sites_catalog) = 'array'),
    staff_catalog jsonb not null check (jsonb_typeof(staff_catalog) = 'array')
);

create table public.sgm_orders (
    campaign_id uuid not null references public.sgm_campaigns(id),
    os_id text not null check (btrim(os_id) <> ''),
    source_position integer not null check (source_position >= 0),
    opened_on date not null,
    original_os jsonb not null check (
        jsonb_typeof(original_os) = 'object' and
        (original_os -> 'id' = to_jsonb(os_id)) is true
    ),
    prepared_classification jsonb not null check (jsonb_typeof(prepared_classification) = 'object'),
    reconciled_location jsonb not null check (jsonb_typeof(reconciled_location) = 'object'),
    in_v549_24m_balance boolean not null,
    primary key (campaign_id, os_id),
    unique (campaign_id, source_position)
);

alter table public.sgm_profiles enable row level security;
alter table public.sgm_campaigns enable row level security;
alter table public.sgm_orders enable row level security;

revoke all on public.sgm_profiles, public.sgm_campaigns, public.sgm_orders
    from public, anon, authenticated;
grant select on public.sgm_profiles, public.sgm_campaigns, public.sgm_orders to authenticated;

create policy sgm_own_active_profile on public.sgm_profiles
    for select to authenticated
    using (
        user_id = (select auth.uid())
        and active
        and coalesce((select auth.jwt() ->> 'is_anonymous'), 'false') = 'false'
    );

-- O subselect passa pela RLS de sgm_profiles e só encontra o próprio perfil ativo.
create policy sgm_campaign_access on public.sgm_campaigns
    for select to authenticated
    using ((select exists (select 1 from public.sgm_profiles)));

create policy sgm_order_access on public.sgm_orders
    for select to authenticated
    using ((select exists (select 1 from public.sgm_profiles)));

commit;
