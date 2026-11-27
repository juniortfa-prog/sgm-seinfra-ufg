create role anon;
create role authenticated;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.jwt() returns jsonb language sql stable
as $$ select nullif(current_setting('request.jwt.claims', true), '')::jsonb $$;
create function auth.uid() returns uuid language sql stable
as $$ select (auth.jwt() ->> 'sub')::uuid $$;
grant usage on schema auth to anon, authenticated;
-- Simula concessões históricas que a migração deve revogar.
alter default privileges in schema public grant all on tables to anon, authenticated;
