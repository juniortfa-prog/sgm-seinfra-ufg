import test from 'node:test';
import assert from 'node:assert/strict';
import { abrirConsulta, configurarSupabase } from '../src/sgm_auth.mjs';
import { contarPorPeriodo } from '../src/sgm_data_adapter.mjs';

const url = 'https://whjymlcdontmmgdzdheu.supabase.co';
const publishable = 'sb_publishable_exemplo';

test('aceita apenas o projeto esperado e chave publicável, sem persistir a sessão', () => {
  const build = (...args) => args;
  assert.throws(() => configurarSupabase(build, 'https://outro.supabase.co', publishable));
  assert.throws(() => configurarSupabase(build, url, 'formato-invalido'));
  assert.deepEqual(configurarSupabase(build, url + '/', publishable), [
    url, publishable, { auth: { persistSession: false, detectSessionInUrl: false } },
  ]);
});

test('carrega a base somente após login e confirmação do perfil RLS', async () => {
  let checks = [];
  const profile = {
    select(fields) { assert.equal(fields, 'role'); return this; },
    eq(field, id) { assert.deepEqual([field, id], ['user_id', 'teste']); return this; },
    async maybeSingle() { checks.push('perfil'); return { data: { role: 'supervisor' } }; },
  };
  const client = {
    auth: { async signInWithPassword() {
      checks.push('login');
      return { data: { user: { id: 'teste' }, session: {} } };
    } },
    from(table) {
      assert.equal(table, 'sgm_profiles');
      return profile;
    },
  };
  const result = await abrirConsulta(client, 'teste@example.invalid', 'exemplo', async (actual) => {
    assert.equal(actual, client);
    checks.push('base');
    return { base: { rows: [] } };
  });
  assert.deepEqual(checks, ['login', 'perfil', 'base']);
  assert.equal(result.role, 'supervisor');

  profile.maybeSingle = async () => ({ data: null });
  await assert.rejects(
    abrirConsulta(client, '', '', () => assert.fail('consulta sem perfil')),
    /perfil institucional/,
  );
  client.auth.signInWithPassword = async () => ({ error: true });
  await assert.rejects(
    abrirConsulta(client, '', '', () => assert.fail('consulta sem sessão')),
    /credenciais/,
  );
});

test('filtra todos os períodos sem remover registros e inclui o dia de corte', () => {
  const dates = [
    '2016-11-30', '2021-11-30', '2024-11-30', '2025-11-30',
    '2026-05-30', '2026-08-30', '2026-11-30', '2010-01-01', '2026-12-01',
  ];
  const counts = ['3', '6', '12', '24', '60', '120', 'all']
    .map((period) => contarPorPeriodo(dates, '2026-11-30', period));
  assert.deepEqual(counts, [2, 3, 4, 5, 6, 7, 9]);
  assert.equal(contarPorPeriodo(['2026-04-30'], '2026-07-31', '3'), 1);
  assert.equal(dates.length, 9);
  assert.throws(() => contarPorPeriodo(dates, '2026-11-30', '7'), /período inválido/);
});
