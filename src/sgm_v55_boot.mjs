import { inicioDoPeriodo } from './sgm_data_adapter.mjs';

export const rolesV55 = Object.freeze({
  gestor: 'Gestor',
  supervisor: 'Supervisor',
  encarregado: 'Encarregado',
  secretaria_os: 'Secretaria de OS',
});

export function documentoV55(template, base, role) {
  const roleLabel = Object.hasOwn(rolesV55, role) && rolesV55[role];
  if (!roleLabel || !base?.rows?.length) throw Error('SGM: base autorizada indisponível');

  const placeholder = /(<script id="data" type="application\/json">)([^<]*)(<\/script>)/g;
  const matches = [...template.matchAll(placeholder)];
  if (matches.length !== 1 || JSON.parse(matches[0][2]).rows?.length !== 0) {
    throw Error('SGM: referência V55.5 inválida');
  }

  const cutoffs = Object.fromEntries(['3', '6', '12', '18', '24', '60', '120', 'all']
    .map(period => [period, inicioDoPeriodo(base.refdate, period)]));
  // Impede que conteúdo da base seja interpretado como marcação do documento.
  const data = JSON.stringify({ ...base, integration: { role: roleLabel, cutoffs } })
    .replaceAll('<', '\\u003c');
  const policy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; " +
    "img-src data: blob:; font-src data:; form-action 'none'; base-uri 'none'";
  return template
    .replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}">`)
    .replace(placeholder, (_, start, _empty, end) => start + data + end);
}
