alter table public.sgm_campaigns
    add column territory_catalog jsonb
    check (
        territory_catalog is null or (
            jsonb_typeof(territory_catalog) = 'object'
            and (jsonb_typeof(territory_catalog -> 'buildings') = 'array') is true
            and (jsonb_typeof(territory_catalog -> 'blocks') = 'array') is true
            and (jsonb_typeof(territory_catalog -> 'localities') = 'array') is true
        )
    );
