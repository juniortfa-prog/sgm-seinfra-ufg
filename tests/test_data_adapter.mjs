import test from 'node:test';
import assert from 'node:assert/strict';
import { carregarBaseSgm, CAMPAIGN_CODE } from '../src/sgm_data_adapter.mjs';

const blocks = Array.from({ length: 10 }, (_, i) => ({
  id: `bloco-${i + 1}`, number: i + 1, name: `Bloco ${i + 1}`,
}));
const localities = Array.from({ length: 16 }, (_, i) => ({
  id: `local-${i}`, site: `Campus fictício ${i}`, city: `Município fictício ${i}`, name: `Campus fictício ${i}`,
}));
const buildings = Array.from({ length: 204 }, (_, i) => ({
  id: `edificio-${i}`, name: `Edifício fictício ${i}`,
  locality_id: i === 1 ? 'local-15' : 'local-0',
  block_id: i === 1 ? null : 'bloco-1',
}));
const catalog = { blocks, buildings, localities };
const prepared = {
  g: 2, u: 3, t: 4, gut: 24, priority: 'Alta', hierarchy: 'H2',
  deferredPreventive: false, emergencyLabel: 'Motivo fictício', team: 'Equipe fictícia',
};
const data = Array.from({ length: 3366 }, (_, i) => ({
  os_id: `M-${i}`, source_position: i, opened_on: i < 2601 ? '2025-01-01' : '2020-01-01',
  in_v549_24m_balance: i < 2198,
  original_os: { id: `M-${i}`, building: 'Nome de origem', priority: 'Baixa', gut: 125, hist: [] },
  prepared_classification: prepared,
  reconciled_location: i >= 3355 ? { situacao: 'REVISAR_LOCAL', building: 'Local a confirmar' } : {
    situacao: 'CATALOGO_CONFIRMADO', edificio_id_catalogo: i === 1 ? 'edificio-1' : 'edificio-0',
  },
}));

function mock({ rows = data, territory = catalog, denied = false } = {}) {
  return { from(table) {
    if (table === 'sgm_campaigns') return {
      select() { return this; }, eq() { return this; }, async single() {
        return denied ? { error: true } : { data: {
          id: 'ficticia', code: CAMPAIGN_CODE, expected_count: 3366,
          original_metadata: { refdate: '2026-11-09' }, sites_catalog: [],
          staff_catalog: [], territory_catalog: territory,
        } };
      },
    };
    if (table === 'sgm_orders' && !denied) return {
      select(fields, options) {
        assert.match(fields, /prepared_classification,reconciled_location/);
        this.count = options?.count === 'exact' ? rows.length : null;
        return this;
      },
      eq() { return this; }, order() { return this; },
      async range(a, b) { return { data: rows.slice(a, b + 1), count: this.count }; },
    };
    throw Error('consulta inesperada');
  } };
}

test('usa classificação preparada e preserva os três objetos de origem', async () => {
  const { base, sourceById, check } = await carregarBaseSgm(mock());
  const first = base.rows[0];
  assert.deepEqual(
    [first.g, first.u, first.t, first.gut, first.priority, first.hierarchy, first.deferredPreventive],
    [2, 3, 4, 24, 'Alta', 'H2', false],
  );
  assert.equal(first.team, 'Equipe fictícia');
  assert.equal(first.building, 'Edifício fictício 0');
  assert.equal(first.blockId, 'bloco-1');
  assert.equal(base.rows[1].blockId, null);
  assert.equal(base.rows[1].localityId, 'local-15');
  assert.equal(base.rows.at(-1).territoryReview, true);
  assert.equal(base.rows.at(-1).buildingConfirmed, false);
  assert.equal(base.rows.at(-1).buildingId, null);
  first.hist.push('edição em tela');
  assert.deepEqual(sourceById.get('M-0').original_os, data[0].original_os);
  assert.equal(sourceById.get('M-0').original_os.gut, 125);
  assert.deepEqual(sourceById.get('M-0').prepared_classification, prepared);
  assert.deepEqual(sourceById.get('M-0').reconciled_location, data[0].reconciled_location);
  assert.deepEqual(check, {
    total: 3366, recorte24: 2601, balanco24: 2198,
    edificios: 204, blocos: 10, localidades: 16, revisoes: 11,
  });
});

test('rejeita contagem real divergente, inclusive registros a mais', async () => {
  await assert.rejects(carregarBaseSgm(mock({ rows: data.slice(0, 3000) })), /total de OS divergente/);
  await assert.rejects(carregarBaseSgm(mock({ rows: [...data, data[0]] })), /total de OS divergente/);
});

test('rejeita divergências de recorte, balanço e revisões', async () => {
  const rows = [...data];
  rows[2400] = { ...rows[2400], opened_on: '2018-01-01' };
  rows[0] = { ...rows[0], in_v549_24m_balance: false };
  rows[3365] = { ...rows[3365], reconciled_location: { situacao: 'UNIDADE_IDENTIFICADA' } };
  await assert.rejects(carregarBaseSgm(mock({ rows })), /recorte24, balanco24, revisoes/);
});

test('rejeita totais de catálogo incorretos ou vínculo inválido', async () => {
  const territory = {
    buildings: buildings.slice(0, -1), blocks: blocks.slice(0, -1), localities: localities.filter(l => l.id !== 'local-14'),
  };
  await assert.rejects(carregarBaseSgm(mock({ territory })), /edificios, blocos, localidades/);
  const rows = [...data];
  rows[0] = { ...rows[0], reconciled_location: { ...rows[0].reconciled_location, area_id: 'inexistente' } };
  await assert.rejects(carregarBaseSgm(mock({ rows })), /vínculo territorial inválido na OS/);
});

test('rejeita classificação ausente e interrompe quando o servidor nega acesso', async () => {
  const rows = [{ ...data[0], prepared_classification: {} }, ...data.slice(1)];
  await assert.rejects(carregarBaseSgm(mock({ rows })), /classificação preparada/);
  await assert.rejects(carregarBaseSgm(mock({ denied: true })), /campanha indisponível/);
});
