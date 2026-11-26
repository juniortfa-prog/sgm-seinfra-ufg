#!/usr/bin/env python3
"""Validação offline do pacote privado V55.3, sem transmissão dos dados."""
import argparse
import csv
import hashlib
import io
import json
import zipfile
from collections import Counter
from pathlib import Path

MANIFEST = '00_manifesto_integridade.json'
ORDERS_JSONL = '06_OS_3366_integral_classificada_para_Supabase.jsonl'

COUNTS = {
    '01_edificios_204.csv': (204, 'edificio_id'),
    '02_areas_10.csv': (10, 'area_id'),
    '03_OS_3366_com_tratamento_territorial.csv': (3366, 'os_id'),
    '04_vinculos_os_localizacao_3366.csv': (3366, 'os_id'),
    '05_os_revisao_manual.csv': (11, 'os_id'),
    '07_localidades_e_campi_16.csv': (16, 'localidade_id'),
}

def ler_pacote(caminho: Path):
    with zipfile.ZipFile(caminho) as arquivo:
        nomes = arquivo.namelist()
        esperados = {*COUNTS, ORDERS_JSONL}
        if len(nomes) != len(set(nomes)) or not (esperados | {MANIFEST}) <= set(nomes):
            raise ValueError('Arquivo ausente ou duplicado no ZIP')
        manifesto = arquivo.read(MANIFEST)
        hashes = json.loads(manifesto)['sha256_arquivos']
        if set(hashes) != esperados:
            raise ValueError('O manifesto deve cobrir os sete arquivos de dados')
        for nome, sha in hashes.items():
            if hashlib.sha256(arquivo.read(nome)).hexdigest() != sha:
                raise ValueError('SHA256 divergente em arquivo do pacote')
        tabelas = {}
        for nome, (qtd, coluna) in COUNTS.items():
            leitor = csv.DictReader(io.StringIO(arquivo.read(nome).decode('utf-8-sig')), delimiter=';')
            linhas = list(leitor)
            ids = [r[coluna] for r in linhas]
            if (len(linhas) != qtd or len(set(ids)) != qtd or not all(ids)
                    or any(None in linha or None in linha.values() for linha in linhas)):
                raise ValueError('Contagem, IDs ou estrutura CSV divergentes em ' + nome)
            tabelas[nome] = linhas
        jsonl = arquivo.read(ORDERS_JSONL).decode('utf-8-sig').splitlines()
        registros = [json.loads(s) for s in jsonl]
        ids = {r['id_os'] for r in registros}
        if len(registros) != 3366 or len(ids) != 3366 or not all(ids):
            raise ValueError('JSONL incompleto ou duplicado')
        for nome in ('03_OS_3366_com_tratamento_territorial.csv', '04_vinculos_os_localizacao_3366.csv'):
            if ids != {r['os_id'] for r in tabelas[nome]}:
                raise ValueError('Identificadores divergentes em ' + nome)
        areas = {r['area_id'] for r in tabelas['02_areas_10.csv']}
        edificios = {r['edificio_id'] for r in tabelas['01_edificios_204.csv']}
        for r in tabelas['04_vinculos_os_localizacao_3366.csv']:
            if r['area_id'] and r['area_id'] not in areas:
                raise ValueError('Área inválida no CSV de vínculos')
            if r['edificio_id_catalogo'] and r['edificio_id_catalogo'] not in edificios:
                raise ValueError('Edifício inválido no CSV de vínculos')
        locais = Counter(r['localizacao_conciliada']['situacao'] for r in registros)
        if dict(locais) != {'CATALOGO_CONFIRMADO': 1899, 'UNIDADE_IDENTIFICADA': 1456, 'REVISAR_LOCAL': 11}:
            raise ValueError('Distribuição de locais divergente')
        revisoes = {r['id_os'] for r in registros if r['localizacao_conciliada']['situacao'] == 'REVISAR_LOCAL'}
        if revisoes != {r['os_id'] for r in tabelas['05_os_revisao_manual.csv']}:
            raise ValueError('IDs de revisão divergentes entre CSV e JSONL')
    return tabelas, registros, hashlib.sha256(manifesto).hexdigest()


def validar(caminho: Path):
    ler_pacote(caminho)
    return 'VALIDADO: 3366 OS; 204 edifícios; 10 áreas; 16 localidades; 11 revisões; hashes íntegros.'

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('arquivo_zip', type=Path)
    print(validar(parser.parse_args().arquivo_zip))
