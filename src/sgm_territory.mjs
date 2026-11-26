const states = new Set(['CATALOGO_CONFIRMADO', 'UNIDADE_IDENTIFICADA', 'REVISAR_LOCAL']);
const populated = value => typeof value === 'string' && value.trim() !== '';

function indexCatalog(rows, label) {
  if (!Array.isArray(rows)) throw Error(`SGM: catálogo de ${label} indisponível`);
  const index = new Map();
  for (const row of rows) {
    if (!populated(row?.id) || !populated(row.name) || index.has(row.id)) {
      throw Error(`SGM: identificação divergente no catálogo de ${label}`);
    }
    index.set(row.id, row);
  }
  return index;
}

export function indexarTerritorio(catalog) {
  const buildings = indexCatalog(catalog?.buildings, 'edifícios');
  const blocks = indexCatalog(catalog?.blocks, 'blocos');
  const localities = indexCatalog(catalog?.localities, 'localidades');

  const blockNumbers = new Set([...blocks.values()].map(block => block.number));
  if (blockNumbers.size !== blocks.size ||
      [...blockNumbers].some(number => !Number.isInteger(number) || number < 1 || number > 10)) {
    throw Error('SGM: numeração dos blocos divergente');
  }
  for (const building of buildings.values()) {
    if (!localities.has(building.locality_id) ||
        (building.block_id !== null && !blocks.has(building.block_id))) {
      throw Error('SGM: vínculo territorial inválido no catálogo de edifícios');
    }
  }
  if ([...localities.values()].some(locality => !populated(locality.site) || !populated(locality.city))) {
    throw Error('SGM: localidade sem rótulo V55.5 ou município');
  }
  if (new Set([...localities.values()].map(locality => locality.site)).size !== localities.size) {
    throw Error('SGM: rótulo de navegação duplicado');
  }
  return { buildings, blocks, localities };
}

export function projetarLocalizacao(location, { buildings, blocks, localities }) {
  if (!states.has(location?.situacao)) throw Error('SGM: situação territorial indisponível');
  const { edificio_id_catalogo: buildingId, area_id: areaId, localidade_id: localityId } = location;
  const building = buildings.get(buildingId);
  const blockId = areaId === undefined ? building?.block_id ?? null : areaId;
  const block = blocks.get(blockId);
  const locality = localities.get(localityId ?? building?.locality_id);
  if ((buildingId != null && !building) || (blockId !== null && !block) ||
      (localityId != null && !locality) ||
      (building && locality?.id !== building.locality_id) ||
      (location.situacao === 'CATALOGO_CONFIRMADO' && !building)) {
    throw Error('SGM: vínculo territorial inválido na OS');
  }
  if ((location.team != null && !populated(location.team)) ||
      (location.building != null && typeof location.building !== 'string')) {
    throw Error('SGM: rótulo territorial inválido na OS');
  }
  const review = location.situacao === 'REVISAR_LOCAL';

  return {
    site: locality?.site ?? 'Local a confirmar',
    building: building?.name ?? location.building ?? '',
    buildingConfirmed: location.situacao === 'CATALOGO_CONFIRMADO',
    locconf: {
      CATALOGO_CONFIRMADO: 'Edifício identificado',
      UNIDADE_IDENTIFICADA: 'Local explícito',
      REVISAR_LOCAL: 'Localização a conferir',
    }[location.situacao],
    territoryReview: review,
    buildingId: building?.id ?? null,
    blockId,
    localityId: locality?.id ?? null,
    ...(location.team != null ? { team: location.team } : {}),
  };
}
