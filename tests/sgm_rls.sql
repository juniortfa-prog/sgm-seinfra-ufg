-- Execute em PostgreSQL descartável, com a migração já aplicada.
begin;

insert into auth.users (id)
select ('00000000-0000-0000-0000-00000000000' || n)::uuid
from generate_series(1, 6) as n;

insert into public.sgm_profiles (user_id, role, active) values
    ('00000000-0000-0000-0000-000000000001', 'gestor', true),
    ('00000000-0000-0000-0000-000000000002', 'supervisor', true),
    ('00000000-0000-0000-0000-000000000003', 'encarregado', true),
    ('00000000-0000-0000-0000-000000000004', 'secretaria_os', true),
    ('00000000-0000-0000-0000-000000000005', 'gestor', false);

insert into public.sgm_campaigns values
    ('10000000-0000-0000-0000-000000000001', 'teste', 1, '{}', '[]', '[]',
     '{"buildings":[],"blocks":[],"localities":[]}');

do $$
begin
    begin
        update public.sgm_campaigns set territory_catalog = '{"buildings":[]}';
        raise exception 'Catálogo sem todas as coleções foi aceito';
    exception when check_violation then
        null;
    end;
end
$$;

insert into public.sgm_orders values
    ('10000000-0000-0000-0000-000000000001', 'FICTICIA', 0, '2025-01-01',
     '{"id":"FICTICIA"}', '{}', '{}', false);

set local role anon;
do $$
begin
    if has_table_privilege('public.sgm_profiles', 'SELECT')
        or has_table_privilege('public.sgm_campaigns', 'SELECT')
        or has_table_privilege('public.sgm_orders', 'SELECT') then
        raise exception 'Role anon possui permissão de leitura';
    end if;
end
$$;

set local role authenticated;
do $$
declare
    account integer;
    expected_role text;
    roles text[] := array['gestor', 'supervisor', 'encarregado', 'secretaria_os'];
    expected_count integer;
    table_name text;
begin
    foreach table_name in array array['sgm_profiles', 'sgm_campaigns', 'sgm_orders'] loop
        if has_table_privilege('public.' || table_name, 'INSERT, UPDATE, DELETE, TRUNCATE') then
            raise exception 'Cliente possui permissão de escrita em %', table_name;
        end if;
    end loop;
    for account in 1..7 loop
        perform set_config('request.jwt.claims', jsonb_build_object(
            'sub', '00000000-0000-0000-0000-00000000000' || least(account, 6),
            'is_anonymous', account = 7
        )::text, true);
        if account = 7 then
            -- Mesmo um UUID com perfil ativo fica bloqueado com claim anônima.
            perform set_config('request.jwt.claims',
                '{"sub":"00000000-0000-0000-0000-000000000001","is_anonymous":true}', true);
        end if;
        expected_count := case when account <= 4 then 1 else 0 end;
        expected_role := roles[account];
        if (select count(*) from public.sgm_profiles) <> expected_count
            or (select max(role) from public.sgm_profiles) is distinct from expected_role
            or (select count(territory_catalog) from public.sgm_campaigns) <> expected_count
            or (select count(*) from public.sgm_orders) <> expected_count then
            raise exception 'Visibilidade incorreta para conta %', account;
        end if;
    end loop;
end
$$;
rollback;
