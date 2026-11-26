import csv
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import importar_sgm_v553 as importer
from validar_pacote_v553 import COUNTS, MANIFEST, ORDERS_JSONL


def fixture(path, fail=None):
    config = {
        'campo_balanco_original': 'foto.exemplo_elegivel',
        'aliases_localidade': {'Alias fictício': 'loc-0'},
        'metadados_v55': {
            'original_metadata': {'refdate': '2026-11-09'},
            'sites_catalog': [], 'staff_catalog': [],
        },
    }
    ids = [f'FICTICIA-{index}' for index in range(3366)]
    records = []
    links = []
    for index, identifier in enumerate(ids):
        deferred = index < 410
        review = index >= 3355
        building = ('FCT-X' if index == 0 else '0') if index < 1899 else None
        area = 'area-1' if building == '0' else None
        location = 'REVISAR_LOCAL' if review else 'CATALOGO_CONFIRMADO' if building else 'UNIDADE_IDENTIFICADA'
        link = {'os_id': identifier, 'edificio_id_catalogo': building, 'area_id': area}
        links.append(link)
        records.append({
            'id_os': identifier,
            'data_os': '2024-11-09' if index < 2601 else '2024-11-08',
            'fonte_original': {'id': identifier, 'desc': 'Amostra privada fictícia', 'gut': 125},
            'classificacao_preparada': {
                'gut_original': {'g': 2, 'u': 3, 't': 4, 'pontuacao': 19} if index == 0 else None,
                'prioridade_origem': 'Alta',
                'hierarquia_operacional': 'PREVENTIVA_ADIADA' if deferred else 'H2',
                'hierarquia_sem_preventiva': 2,
                'preventiva_refrigeracao_adiada': deferred,
            },
            'localizacao_conciliada': {
                'situacao': location, 'id_edificio': building, 'id_area': area,
                'campus_operacional': 'Interior' if index == 0 else 'A confirmar' if review else 'Alias fictício',
                'equipe_operacional': 'Equipe fictícia', 'edificio_ou_unidade': 'Unidade fictícia',
            },
            'foto': {'exemplo_elegivel': index < 2198},
        })
    if fail == 'contagem':
        records[0]['foto']['exemplo_elegivel'] = False
    if fail == 'vinculo':
        records[1]['localizacao_conciliada']['id_area'] = 'area-2'
    table_rows = [
        [{'edificio_id': str(i) if i != 203 else 'FCT-X', 'nome_oficial': f'Prédio fictício {i}',
          'localidade_id': 'loc-0' if i != 203 else 'loc-1', 'area_id': 'area-1' if i != 203 else ''}
         for i in range(204)],
        [{'area_id': f'area-{i}', 'bloco': f'{i:02}', 'nome_area': f'Bloco {i}'} for i in range(1, 11)],
        [{'os_id': identifier} for identifier in ids],
        links,
        [{'os_id': identifier} for identifier in ids[-11:]],
        [{'localidade_id': f'loc-{i}', 'nome_localidade': 'Interior' if i == 1 else f'Local {i}',
          'municipio_uf': 'Município fictício - GO'} for i in range(16)],
    ]
    files = {}
    for filename, rows in zip(COUNTS, table_rows, strict=True):
        stream = io.StringIO()
        writer = csv.DictWriter(stream, fieldnames=rows[0], delimiter=';')
        writer.writeheader()
        writer.writerows(rows)
        files[filename] = stream.getvalue().encode('utf-8-sig')
    files[ORDERS_JSONL] = '\n'.join(json.dumps(record) for record in records).encode()
    hashes = {name: hashlib.sha256(value).hexdigest() for name, value in files.items()}
    if fail == 'manifesto':
        del hashes[ORDERS_JSONL]
    if fail == 'hash':
        files[ORDERS_JSONL] += b'\n'
    with ZipFile(path, 'w') as output:
        output.writestr(MANIFEST, json.dumps({'sha256_arquivos': hashes}))
        for name, content in files.items():
            output.writestr(name, content)
    return config, records


class ImportadorTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.path = Path(directory.name) / 'fixture.zip'

    def test_simulacao_cli_sem_credenciais_ou_exposicao(self):
        config, _ = fixture(self.path)
        cfg = self.path.with_suffix('.json')
        cfg.write_text(json.dumps(config))
        result = subprocess.run(
            [sys.executable, str(ROOT / 'scripts/importar_sgm_v553.py'), str(self.path), '--config', str(cfg)],
            env={}, capture_output=True, text=True, check=True,
        )
        self.assertEqual(json.loads(result.stdout), {
            'modo': 'simulacao', 'hashes_sha256_validados': 7,
            **importer.EXPECTED, 'metadados_v55_presentes': True,
        })
        self.assertNotIn('FICTICIA', result.stdout)

    def test_mapeamento_preserva_origem_e_distingue_recortes(self):
        config, source = fixture(self.path)
        campaign, orders, report = importer.preparar(self.path, config)
        first = orders[0]
        self.assertEqual(first[3], source[0]['fonte_original'])
        self.assertEqual(first[4]['gut'], 19)
        self.assertEqual(first[4]['hierarchy'], 'H2')
        self.assertTrue(first[4]['deferredPreventive'])
        self.assertEqual(first[4]['hierarquia_operacional'], 'PREVENTIVA_ADIADA')
        self.assertEqual(first[5]['edificio_id_catalogo'], 'FCT-X')
        self.assertEqual(first[5]['localidade_id'], 'loc-1')
        self.assertIsNone(first[5]['area_id'])
        self.assertEqual(first[7], source[0])
        self.assertIsNone(orders[1][4]['gut'])
        self.assertIsNone(orders[-1][5]['localidade_id'])
        self.assertFalse(orders[-1][6])
        self.assertEqual(report['revisoes_territoriais'], 11)
        self.assertIsNone(campaign[4]['buildings'][-1]['block_id'])

    def test_recusa_manifesto_hash_conciliacao_e_contagem_divergentes(self):
        for case, message in [('manifesto', 'sete arquivos'), ('hash', 'SHA256'),
                              ('vinculo', 'JSONL e CSV'), ('contagem', 'balanco_original')]:
            with self.subTest(case=case):
                config, _ = fixture(self.path, case)
                with self.assertRaisesRegex(ValueError, message):
                    importer.preparar(self.path, config)

    def test_verifica_nome_e_ref_na_api(self):
        with patch.dict(os.environ, {'SGM_SUPABASE_ACCESS_TOKEN': 'fixture'}), patch.object(importer, 'urlopen') as open_url:
            for name, ref in [(importer.PROJECT_NAME, importer.PROJECT_REF), ('outro', importer.PROJECT_REF),
                              (importer.PROJECT_NAME, 'outro')]:
                open_url.return_value.__enter__.return_value = io.StringIO(json.dumps({'name': name, 'id': ref}))
                if (name, ref) == (importer.PROJECT_NAME, importer.PROJECT_REF):
                    importer.verificar_destino()
                else:
                    with self.assertRaisesRegex(ValueError, 'projeto divergente'):
                        importer.verificar_destino()
            self.assertEqual(open_url.call_args.args[0].host, 'api.supabase.com')

    @unittest.skipUnless(os.environ.get('SGM_TEST_POSTGRES_PORT'), 'requer PostgreSQL local descartável')
    def test_postgres_rollback_e_segunda_importacao(self):
        import psycopg

        config, _ = fixture(self.path)
        campaign, orders, _ = importer.preparar(self.path, config)
        with psycopg.connect(host='127.0.0.1', dbname='postgres', user='postgres',
                             port=int(os.environ['SGM_TEST_POSTGRES_PORT']), autocommit=True) as connection:
            broken = [*orders[:-1], (*orders[-1][:1], orders[0][1], *orders[-1][2:])]
            with self.assertRaises(psycopg.errors.UniqueViolation):
                importer.gravar(connection, campaign, broken)
            self.assertEqual(connection.execute('select count(*) from public.sgm_campaigns').fetchone(), (0,))
            self.assertEqual(connection.execute('select count(*) from public.sgm_orders').fetchone(), (0,))
            self.assertEqual(importer.gravar(connection, campaign, orders), 'campanha_importada')
            self.assertEqual(importer.gravar(connection, campaign, orders), 'campanha_ja_importada')
            changed = [(*orders[0][:6], False, orders[0][7]), *orders[1:]]
            with self.assertRaisesRegex(ValueError, 'Ordens existentes divergem'):
                importer.gravar(connection, campaign, changed)
            self.assertEqual(connection.execute('select count(*) from public.sgm_campaigns').fetchone(), (1,))
            result = connection.execute("""
                select count(*), count(distinct os_id),
                    count(*) filter (where opened_on between '2024-11-09' and '2026-11-09'),
                    count(*) filter (where in_v549_24m_balance),
                    count(*) filter (where source_record is not null)
                from public.sgm_orders
            """).fetchone()
            self.assertEqual(result, (3366, 3366, 2601, 2198, 3366))


if __name__ == '__main__':
    unittest.main()
