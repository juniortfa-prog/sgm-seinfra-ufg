import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Script } from 'node:vm';
import { documentoV55 } from '../src/sgm_v55_boot.mjs';

const reference = readFileSync(new URL('../referencia/SGM_V55_5_interface_sem_dados.html', import.meta.url), 'utf8');

test('insere dados como JSON antes dos módulos originais e neutraliza fechamento de script', () => {
  const description = '</script><img src="ficticio">';
  const html = documentoV55(reference, { refdate: '2026-11-09', rows: [{ desc: description }] }, 'gestor');
  const scripts = [...html.matchAll(/<script\b([^>]*)>(.*?)<\/script>/gs)];
  assert.equal(scripts.length, 4);
  assert.match(scripts[0][1], /id="data"/);
  const data = JSON.parse(scripts[0][2]);
  assert.equal(data.rows[0].desc, description);
  assert.equal(data.integration.role, 'Gestor');
  assert.equal(data.integration.cutoffs['120'], '2016-11-09');
  assert.doesNotMatch(scripts[0][2], /</);
  assert.match(html, /Content-Security-Policy/);
  for (const [, , source] of scripts.slice(1)) assert.doesNotThrow(() => new Script(source));
});

test('recusa inicialização sem perfil institucional ou sem base', () => {
  assert.throws(() => documentoV55(reference, { rows: [{}] }, 'anon'), /base autorizada/);
  assert.throws(() => documentoV55(reference, { rows: [] }, 'gestor'), /base autorizada/);
  assert.throws(() => documentoV55('', { rows: [{}] }, 'gestor'), /referência/);
});
