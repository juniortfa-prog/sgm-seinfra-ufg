#!/usr/bin/env python3
"""Simula a carga histórica do SGM; a escrita requer confirmação explícita do destino."""
import argparse
from datetime import date
import json
import math
import os
from pathlib import Path
import re
import sys
from urllib.request import Request, urlopen
from zipfile import BadZipFile

from validar_pacote_v553 import ler_pacote

PROJECT_NAME = 'sgm-seinfra-ufg'
PROJECT_REF = 'whjvmlcdomtmmgdzdheu'
CAMPAIGN = 'v549-base-integral-2026-11-09'
REFERENCE = date(2026, 11, 9)
CUTOFF = date(2024, 11, 9)
EXPECTED = {
    'historico': 3366, 'recorte_24m': 2601, 'balanco_original': 2198,
    'edificios': 204, 'blocos': 10, 'localidades': 16,
    'revisoes_territoriais': 11, 'preventivas_adiadas_no_historico': 410,
}

ORDER_COLUMNS = (
    'os_id', 'source_position', 'opened_on', 'original_os', 'prepared_classification',
    'reconciled_location', 'in_v549_24m_balance', 'source_record',
)


def texto(value):
    if not isinstance(value, str) or not value.strip():
        raise ValueError('Identificador ou rótulo obrigatório ausente')
    return value.strip()


def id_opcional(value):
    if value is None or value == '':
        return None
    # Alguns IDs de catálogo podem ser números no JSONL e texto no CSV.
    if type(value) is int:
        return str(value)
    return texto(value)


def objeto(value):
    if not isinstance(value, dict):
        raise ValueError('Objeto obrigatório ausente ou inválido')
    return value


def booleano(value):
    if type(value) is not bool:
        raise ValueError('Indicador booleano inválido no JSONL')
    return value


def gut_numero(value):
    if value is None:
        return None
    if type(value) not in (int, float) or not math.isfinite(value):
        raise ValueError('GUT original em formato não numérico')
    return value


def hierarquia(value):
    match = re.fullmatch(r'H?([123])', str(value).strip(), re.I)
    if not match:
        raise ValueError('Hierarquia tratada fora de H1/H2/H3')
    return 'H' + match[1]


def classificar(source):
    gut = objeto(source['gut_original']) if source['gut_original'] is not None else {}
    operational = source['hierarquia_operacional']
    deferred = booleano(source['preventiva_refrigeracao_adiada'])
    if operational == 'PREVENTIVA_ADIADA' and not deferred:
        raise ValueError('Preventiva adiada com marcador contraditório')
    emergency = source.get('motivo_emergencia')
    if emergency is not None and not isinstance(emergency, str):
        raise ValueError('Motivo de emergência em formato não textual')
    result = {
        **source,
        'emergencyLabel': emergency if emergency is not None else '',
        'g': gut_numero(gut.get('g')),
        'u': gut_numero(gut.get('u')),
        't': gut_numero(gut.get('t')),
        'gut': gut_numero(gut.get('pontuacao')),
        'priority': texto(source['prioridade_origem']),
        'hierarchy': hierarquia(source['hierarquia_sem_preventiva']),
        'deferredPreventive': deferred,
    }
    return result


def catalogar(tables, config):
    localities = {}
    by_label = {}
    blocks = {}
    buildings = {}

    def register(label, key):
        label = texto(label).casefold()
        if label in by_label and by_label[label] != key:
            raise ValueError('Rótulo territorial ambíguo')
        by_label[label] = key

    site_labels = objeto(config.get('rotulos_localidade', {}))
    for item in tables['07_localidades_e_campi_16.csv']:
        key = texto(item['localidade_id'])
        name = texto(item['nome_localidade'])
        site = texto(site_labels.get(key, name))
        localities[key] = {
            'id': key, 'name': name, 'site': site, 'city': texto(item['municipio_uf']),
        }
        if item.get('equipe_operacional'):
            localities[key]['team'] = texto(item['equipe_operacional'])
        for label in (name, site, key):
            register(label, key)
    if not set(site_labels) <= set(localities):
        raise ValueError('Rótulo configurado para localidade inexistente')
    if len({item['site'] for item in localities.values()}) != len(localities):
        raise ValueError('Rótulos de navegação duplicados')
    for label, key in objeto(config.get('aliases_localidade', {})).items():
        if key not in localities:
            raise ValueError('Alias aponta para localidade inexistente')
        register(label, key)

    def resolve(value):
        if value is None or value == '':
            return None
        return by_label.get(texto(value).casefold())

    for item in tables['02_areas_10.csv']:
        key = texto(item['area_id'])
        number = re.fullmatch(r'(?:Bloco\s+)?(0?[1-9]|10)', texto(item['bloco']), re.I)
        if not number:
            raise ValueError('Número de bloco inválido')
        blocks[key] = {
            'id': key, 'number': int(number[1]), 'name': texto(item['nome_area']),
            'campus': item.get('campus_operacional') or item.get('campus') or '',
        }
        if item.get('equipe_operacional'):
            blocks[key]['team'] = texto(item['equipe_operacional'])
        if item.get('tecnico_referencia'):
            blocks[key]['technician'] = texto(item['tecnico_referencia'])
    if {item['number'] for item in blocks.values()} != set(range(1, 11)):
        raise ValueError('Numeração divergente dos dez blocos')

    territory_columns = objeto(config.get('colunas_edificios', {}))
    locality_column = texto(territory_columns.get('localidade', 'localidade_id'))
    block_column = texto(territory_columns.get('bloco', 'area_id'))
    for item in tables['01_edificios_204.csv']:
        key = texto(item['edificio_id'])
        locality = resolve(item[locality_column])
        block = id_opcional(item[block_column])
        if locality not in localities or (block is not None and block not in blocks):
            raise ValueError('Vínculo inválido no catálogo de edifícios')
        buildings[key] = {
            'id': key, 'name': texto(item['nome_oficial']), 'locality_id': locality,
            'block_id': block,
        }
    return localities, blocks, buildings, resolve


def localizar(source, link, localities, blocks, buildings, resolve):
    building_id = id_opcional(source['id_edificio'])
    block_id = id_opcional(source['id_area'])
    if (building_id != id_opcional(link['edificio_id_catalogo']) or
            block_id != id_opcional(link['area_id'])):
        raise ValueError('Vínculo entre JSONL e CSV diverge')
    building = buildings.get(building_id)
    status = source['situacao']
    campus = source['campus_operacional']
    locality_id = resolve(campus)
    if locality_id is None and building and not campus:
        locality_id = building['locality_id']
    if ((building_id is not None and building is None)
            or (status == 'CATALOGO_CONFIRMADO' and building is None)
            or (block_id is not None and block_id not in blocks)
            or (status != 'REVISAR_LOCAL' and locality_id not in localities)
            or (building and locality_id != building['locality_id'])):
        raise ValueError('Localização conciliada incompatível com o catálogo')
    team = source['equipe_operacional']
    label = source['edificio_ou_unidade']
    return {
        **source, 'edificio_id_catalogo': building_id, 'area_id': block_id,
        'localidade_id': locality_id, 'team': texto(team) if team else None,
        'building': texto(label) if label else None,
    }


def metadados(value):
    metadata = objeto(value['original_metadata'])
    if {'rows', 'sites', 'staff'} & metadata.keys():
        raise ValueError('Metadados devem estar separados das OS e dos catálogos')
    if metadata.get('refdate') != REFERENCE.isoformat():
        raise ValueError('Data de referência dos metadados divergente')
    if not all(isinstance(value.get(key), list) for key in ('sites_catalog', 'staff_catalog')):
        raise ValueError('Catálogos legados ausentes nos metadados privados')
    if any(not isinstance(item, dict) for key in ('sites_catalog', 'staff_catalog') for item in value[key]):
        raise ValueError('Estrutura inválida nos catálogos legados')
    return metadata, value['sites_catalog'], value['staff_catalog']


def preparar(path, config):
    tables, records, manifest_hash = ler_pacote(path)
    field = texto(config['campo_balanco_original']).split('.')
    links = {r['os_id']: r for r in tables['04_vinculos_os_localizacao_3366.csv']}
    localities, blocks, buildings, resolve = catalogar(tables, config)
    orders = []
    for index, row in enumerate(records):
        try:
            identifier = texto(row['id_os'])
            original = objeto(row['fonte_original'])
            if original.get('id') != identifier:
                raise ValueError('ID da fonte original diverge da OS')
            try:
                opened = date.fromisoformat(texto(row['data_os']))
            except ValueError:
                raise ValueError('Data de abertura inválida') from None
            if opened.isoformat() != row['data_os'] or opened > REFERENCE:
                raise ValueError('Data de abertura fora do formato ou da referência')
            classification = classificar(objeto(row['classificacao_preparada']))
            location = localizar(objeto(row['localizacao_conciliada']), links[identifier],
                                 localities, blocks, buildings, resolve)
            balance = row
            for segment in field:
                balance = objeto(balance)[segment]
            balance = booleano(balance)
            if balance and opened < CUTOFF:
                raise ValueError('Marcador do balanço fora da janela histórica')
        except KeyError:
            raise ValueError(f'Linha {index + 1} do JSONL: campo obrigatório ausente') from None
        except ValueError as error:
            raise ValueError(f'Linha {index + 1} do JSONL: {error}') from None
        orders.append((identifier, index, opened, original, classification, location, balance, row))

    counts = {
        'historico': len(orders),
        'recorte_24m': sum(CUTOFF <= order[2] <= REFERENCE for order in orders),
        'balanco_original': sum(order[6] for order in orders),
        'edificios': len(buildings), 'blocos': len(blocks), 'localidades': len(localities),
        'revisoes_territoriais': sum(order[5]['situacao'] == 'REVISAR_LOCAL' for order in orders),
        'preventivas_adiadas_no_historico': sum(order[4]['deferredPreventive'] for order in orders),
    }
    if counts != EXPECTED:
        differences = {key: [counts[key], EXPECTED[key]] for key in EXPECTED if counts[key] != EXPECTED[key]}
        raise ValueError('Quantitativos divergentes (apurado, esperado): ' + json.dumps(differences))

    legacy = config.get('metadados_v55')
    territory = {
        'buildings': list(buildings.values()), 'blocks': list(blocks.values()),
        'localities': list(localities.values()),
    }
    campaign = (len(orders), *metadados(legacy), territory, manifest_hash) if legacy is not None else None
    report = {'hashes_sha256_validados': 7, **counts, 'metadados_v55_presentes': campaign is not None}
    if campaign is not None:
        report.update(
            referencia_v55=campaign[1]['refdate'],
            locais_catalogo_legado=len(campaign[2]),
            pessoal_catalogo_legado=len(campaign[3]),
        )
    return campaign, orders, report


def verificar_destino():
    token = os.environ.get('SGM_SUPABASE_ACCESS_TOKEN')
    if not token:
        raise ValueError('SGM_SUPABASE_ACCESS_TOKEN ausente')
    request = Request(f'https://api.supabase.com/v1/projects/{PROJECT_REF}',
                      headers={'Authorization': f'Bearer {token}'})
    try:
        with urlopen(request, timeout=20) as response:
            project = json.load(response)
    except (OSError, ValueError):
        raise ValueError('Não foi possível verificar o projeto pela API de gerenciamento') from None
    if project.get('name') != PROJECT_NAME or (
            (project.get('ref') or project.get('id')) != PROJECT_REF
            or (project.get('id') is not None and project['id'] != PROJECT_REF)):
        raise ValueError('Nome ou identificador do projeto divergente')


def gravar(connection, campaign, orders):
    from psycopg.types.json import Jsonb

    if campaign is None:
        raise ValueError('Metadados privados da V55.5 necessários para a carga')
    fields = ('expected_count', 'original_metadata', 'sites_catalog', 'staff_catalog',
              'territory_catalog', 'import_manifest_sha256')
    with connection.transaction(), connection.cursor() as cursor:
        cursor.execute("set local lock_timeout = '15s'")
        cursor.execute("select pg_advisory_xact_lock(hashtextextended(%s, 0))", (CAMPAIGN,))
        cursor.execute(f"select id, {', '.join(fields)} from public.sgm_campaigns where code = %s", (CAMPAIGN,))
        existing = cursor.fetchone()
        if existing:
            if existing[1:] != campaign:
                raise ValueError('Campanha existente diverge; nenhuma alteração efetuada')
            cursor.execute(
                f"select {', '.join(ORDER_COLUMNS)} from public.sgm_orders "
                "where campaign_id = %s order by source_position", (existing[0],),
            )
            if cursor.fetchall() != orders:
                raise ValueError('Ordens existentes divergem; nenhuma alteração efetuada')
            return 'campanha_ja_importada'

        cursor.execute(
            f"insert into public.sgm_campaigns (code, {', '.join(fields)}) "
            "values (%s, %s, %s, %s, %s, %s, %s) returning id",
            (CAMPAIGN, campaign[0], *(Jsonb(item) for item in campaign[1:5]), campaign[5]),
        )
        campaign_id = cursor.fetchone()[0]
        with cursor.copy(f"copy public.sgm_orders (campaign_id, {', '.join(ORDER_COLUMNS)}) from stdin") as copy:
            for identifier, index, opened, original, classification, location, balance, source in orders:
                copy.write_row((campaign_id, identifier, index, opened, Jsonb(original),
                                Jsonb(classification), Jsonb(location), balance, Jsonb(source)))
    return 'campanha_importada'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pacote', type=Path, nargs='?')
    parser.add_argument('--config', type=Path, help='Contrato privado de mapeamento')
    action = parser.add_mutually_exclusive_group()
    action.add_argument('--verificar-destino', action='store_true')
    action.add_argument('--aplicar', action='store_true')
    parser.add_argument('--confirmar-ref')
    args = parser.parse_args()
    try:
        if args.verificar_destino:
            verificar_destino()
            print(f'Destino verificado: {PROJECT_NAME} ({PROJECT_REF})')
            return 0
        if not args.pacote or not args.config:
            parser.error('pacote e --config são obrigatórios para simular ou aplicar')
        config = objeto(json.loads(args.config.read_text(encoding='utf-8-sig')))
        campaign, orders, report = preparar(args.pacote, config)
        report['modo'] = 'simulacao'
        if args.aplicar:
            if args.confirmar_ref != PROJECT_REF or campaign is None:
                raise ValueError('Confirmação explícita do ref e metadados privados requeridos')
            verificar_destino()
            password = os.environ.get('SGM_SUPABASE_DB_PASSWORD')
            if not password or os.environ.get('PGHOSTADDR') or os.environ.get('PGSERVICE'):
                raise ValueError('Senha dedicada ausente ou configuração libpq conflitante')
            import psycopg
            try:
                with psycopg.connect(host=f'db.{PROJECT_REF}.supabase.co', port=5432, dbname='postgres',
                                     user='postgres', password=password, sslmode='verify-full',
                                     sslrootcert='system', gssencmode='disable', connect_timeout=10) as connection:
                    report['modo'] = gravar(connection, campaign, orders)
            except psycopg.Error:
                raise ValueError('Falha de banco na carga; nenhuma transação parcial foi gravada') from None
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except (KeyError, TypeError, AttributeError, OSError, ImportError, BadZipFile, UnicodeError, json.JSONDecodeError, RuntimeError) as error:
        print(f'Importação interrompida: arquivo, configuração ou dependência inválida ({type(error).__name__}).', file=sys.stderr)
        return 1
    except ValueError as error:
        print(f'Importação interrompida: {error}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
