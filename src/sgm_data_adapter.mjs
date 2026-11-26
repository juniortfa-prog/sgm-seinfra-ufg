import { indexarTerritorio, projetarLocalizacao } from './sgm_territory.mjs';

export const CAMPAIGN_CODE = 'v549-base-integral-2026-11-09';

const canonical = {
  total: 3366, recorte24: 2601, balanco24: 2198,
  edificios: 204, blocos: 10, localidades: 16, revisoes: 11,
};

function projetarClassificacao(prepared) {
  const { g, u, t, gut, priority, hierarchy, deferredPreventive, emergencyLabel } = prepared ?? {};
  if (![g, u, t, gut].every(value => value === null || Number.isFinite(value)) ||
      typeof priority !== 'string' || !['H1', 'H2', 'H3'].includes(hierarchy) ||
      typeof deferredPreventive !== 'boolean' ||
      (emergencyLabel != null && typeof emergencyLabel !== 'string') ||
      (prepared.team != null && typeof prepared.team !== 'string')) {
    throw Error('SGM: classificação preparada incompleta ou inválida');
  }
  return {
    g, u, t, gut, priority, hierarchy, deferredPreventive,
    emergencyLabel: emergencyLabel ?? '',
    ...(prepared.team != null ? { team: prepared.team } : {}),
  };
}

export async function carregarBaseSgm(client, { campaignCode = CAMPAIGN_CODE, pageSize = 400 } = {}) {
  if (!client || typeof client.from !== 'function') throw Error('SGM: conexão Supabase ausente');
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) throw Error('SGM: paginação inválida');
  const response = await client.from('sgm_campaigns')
    .select('id,code,expected_count,original_metadata,sites_catalog,staff_catalog,territory_catalog')
    .eq('code', campaignCode).single();
  if (response.error || !response.data) throw Error('SGM: campanha indisponível; verifique login e RLS');
  const campaign = response.data;
  if (!Number.isInteger(campaign.expected_count) || campaign.expected_count < 1 ||
      campaign.expected_count > 100000) throw Error('SGM: total da base inválido');

  if (!Array.isArray(campaign.sites_catalog) || !Array.isArray(campaign.staff_catalog)) {
    throw Error('SGM: catálogos legados indisponíveis');
  }
  const catalog = campaign.territory_catalog;
  const territory = indexarTerritorio(catalog);
  const items = [];
  for (let start = 0; start < campaign.expected_count; start += pageSize) {
    const end = Math.min(start + pageSize, campaign.expected_count) - 1;
    const result = await client.from('sgm_orders')
      .select('os_id,source_position,opened_on,original_os,prepared_classification,reconciled_location,in_v549_24m_balance',
        start === 0 ? { count: 'exact' } : undefined)
      .eq('campaign_id', campaign.id).order('source_position', { ascending: true }).range(start, end);
    if (result.error) throw Error('SGM: consulta de OS recusada');
    if (result.data?.length !== end - start + 1) throw Error('SGM: base incompleta');
    if (start === 0 && result.count !== campaign.expected_count) throw Error('SGM: total de OS divergente');
    items.push(...result.data);
  }

  const sourceById = new Map();
  const rows = items.map((item, index) => {
    if (!item.os_id || sourceById.has(item.os_id) ||
        item.source_position !== index || item.original_os?.id !== item.os_id) {
      throw Error('SGM: ordem/identificador original divergente');
    }
    if (!validDate(item.opened_on) || typeof item.in_v549_24m_balance !== 'boolean') {
      throw Error('SGM: data de abertura ou balanço inválido');
    }
    sourceById.set(item.os_id, structuredClone({
      original_os: item.original_os,
      prepared_classification: item.prepared_classification,
      reconciled_location: item.reconciled_location,
    }));
    return {
      ...structuredClone(item.original_os),
      ...projetarClassificacao(item.prepared_classification),
      ...projetarLocalizacao(item.reconciled_location, territory),
      date: item.opened_on,
      inLegacyBalance: item.in_v549_24m_balance,
    };
  });

  const base = {
    ...campaign.original_metadata,
    sites: [...territory.localities.values()].map(locality => ({
      ...campaign.sites_catalog.find(site => site.site === locality.site),
      site: locality.site,
      city: locality.city,
      team: locality.team ?? 'Equipe a definir',
    })),
    staff: campaign.staff_catalog,
    territory: catalog,
    rows,
  };
  const openedDates = rows.map(row => row.date);
  const check = {
    total: rows.length,
    recorte24: contarPorPeriodo(openedDates, base.refdate, '24'),
    balanco24: rows.filter(row => row.inLegacyBalance).length,
    edificios: territory.buildings.size,
    blocos: territory.blocks.size,
    localidades: territory.localities.size,
    revisoes: rows.filter(row => row.territoryReview).length,
  };
  if (campaign.code === CAMPAIGN_CODE) {
    const mismatches = Object.keys(canonical).filter(key => check[key] !== canonical[key]);
    if (base.refdate !== '2026-11-09') mismatches.push('data de referência');
    if (rows.some(row => row.date > base.refdate ||
        (row.inLegacyBalance && row.date < '2024-11-09'))) mismatches.push('datas do balanço');
    if (mismatches.length) throw Error(`SGM: indicadores de referência divergentes (${mismatches.join(', ')})`);
  }
  return { base, campaign, openedDates, check, sourceById };
}

function validDate(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return false;
  const parsed = new Date(date + 'T00:00:00Z');
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0, 10) === date;
}

export function inicioDoPeriodo(reference, period) {
  if (period === 'all') return '0000-00-00';
  if (!['3', '6', '12', '18', '24', '60', '120'].includes(period)) throw Error('SGM: período inválido');
  if (!validDate(reference)) throw Error('SGM: data de referência inválida');
  const end = new Date(reference + 'T00:00:00Z');
  const start = new Date(end);
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - Number(period));
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  start.setUTCDate(Math.min(end.getUTCDate(), lastDay.getUTCDate()));
  return start.toISOString().slice(0, 10);
}

export function contarPorPeriodo(openedDates, reference, period) {
  if (period === 'all') return openedDates.length;
  const cutoff = inicioDoPeriodo(reference, period);
  return openedDates.filter(date => date >= cutoff && date <= reference).length;
}
