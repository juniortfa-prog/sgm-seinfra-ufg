/** Adaptador SOMENTE LEITURA: base do Supabase -> formato D usado pela V55.5.
 * A integração com login, persistência de OT/roteiros/execução é uma etapa posterior.
 * Nunca incorporar OS, senha ou chave secreta neste arquivo público.
 */
export const CAMPAIGN_CODE = 'v549-base-integral-2026-11-09';
export async function carregarBaseSgm(client,{campaignCode=CAMPAIGN_CODE,pageSize=400}={}) {
  if (!client || typeof client.from !== 'function') throw Error('SGM: conexão Supabase ausente');
  if (!Number.isInteger(pageSize)||pageSize<1||pageSize>500) throw Error('SGM: paginação inválida');
  const response=await client.from('sgm_campaigns').select('id,code,expected_count,original_metadata,sites_catalog,staff_catalog').eq('code',campaignCode).single();
  if(response.error||!response.data) throw Error('SGM: campanha indisponível; verifique login e RLS');
  const c=response.data;
  if(!Number.isInteger(c.expected_count)||c.expected_count<1||c.expected_count>100000)
    throw Error('SGM: total da base inválido');
  const items=[];
  for(let n=0;n<c.expected_count;n+=pageSize){
    const result=await client.from('sgm_orders')
      .select('os_id,source_position,opened_on,original_os,in_v549_24m_balance')
      .eq('campaign_id',c.id).order('source_position',{ascending:true}).range(n,n+pageSize-1);
    if(result.error) throw Error('SGM: consulta de OS recusada: '+result.error.message);
    if(!result.data?.length) throw Error('SGM: base incompleta; página '+(Math.floor(n/pageSize)+1));
    items.push(...result.data);
  }
  if(items.length!==c.expected_count||new Set(items.map(x=>x.os_id)).size!==items.length)
    throw Error('SGM: total ou identificadores divergentes');
  items.forEach((x,i)=>{
    if(x.source_position!==i||x.original_os?.id!==x.os_id)
      throw Error('SGM: ordem/identificador original divergente');
  });
  const base={...(c.original_metadata||{}),sites:c.sites_catalog||[],staff:c.staff_catalog||[],rows:items.map(x=>x.original_os)};
  if(c.code===CAMPAIGN_CODE && (items.length!==3366 ||
     contarPorPeriodo(items.map(x=>x.opened_on),'2026-11-09','24')!==2601 ||
     items.filter(x=>x.in_v549_24m_balance).length!==2198 ||
     base.refdate!=='2026-11-09'))
    throw Error('SGM: indicadores de referência divergentes; interrompida a renderização');
  return {base,campaign:c,openedDates:items.map(x=>x.opened_on),check:{total:items.length,balanco24:items.filter(x=>x.in_v549_24m_balance).length}};
}

export function contarPorPeriodo(openedDates, reference, period) {
  if (period === 'all') return openedDates.length;
  if (!['3', '6', '12', '24', '60', '120'].includes(period)) {
    throw Error('SGM: período inválido');
  }

  const end = new Date(reference + 'T00:00:00Z');
  if (!Number.isFinite(+end) || end.toISOString().slice(0, 10) !== reference) {
    throw Error('SGM: data de referência inválida');
  }
  const start = new Date(end);
  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - Number(period));
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
  start.setUTCDate(Math.min(end.getUTCDate(), lastDay.getUTCDate()));

  const cutoff = start.toISOString().slice(0, 10);
  return openedDates.filter((date) => date >= cutoff && date <= reference).length;
}
