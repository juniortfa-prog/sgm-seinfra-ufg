import { createClient } from '@supabase/supabase-js';
import { abrirConsulta, configurarSupabase } from './sgm_auth.mjs';
import { contarPorPeriodo } from './sgm_data_adapter.mjs';

const $ = (id) => document.getElementById(id);
const form = $('entrar');
const logout = $('sair');
const dashboard = $('consulta');
const status = $('status');
const roleLabels = {
  gestor: 'Gestor',
  supervisor: 'Supervisor',
  encarregado: 'Encarregado',
  secretaria_os: 'Secretaria de OS',
};
let consulta;
let generation = 0;

function clearConsulta(message) {
  generation++;
  consulta = undefined;
  dashboard.hidden = true;
  logout.hidden = true;
  form.hidden = false;
  $('perfil').textContent = '';
  $('total').textContent = '';
  status.textContent = message;
}

function showCount() {
  if (!consulta) return;
  const { base, openedDates, check } = consulta;
  const count = contarPorPeriodo(openedDates, base.refdate, $('periodo').value);
  $('total').textContent = `${count} OS no período · ${check.total} no histórico · ${check.balanco24} no balanço legado de 24 meses`;
}

function initialize(client) {
  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') clearConsulta('Sessão encerrada.');
  });
  $('periodo').addEventListener('change', showCount);
  logout.addEventListener('click', async () => {
    clearConsulta('Encerrando sessão…');
    form.hidden = true;
    try {
      const { error } = await client.auth.signOut({ scope: 'local' });
      if (error) throw error;
      status.textContent = 'Sessão encerrada.';
      form.hidden = false;
    } catch {
      status.textContent = 'Falha ao revogar a sessão. Recarregue a página para voltar ao login.';
    }
  });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const attempt = ++generation;
    const fields = form.querySelector('fieldset');
    const password = $('senha').value;
    $('senha').value = '';
    fields.disabled = true;
    status.textContent = 'Validando acesso e carregando a campanha…';
    try {
      const opened = await abrirConsulta(client, $('email').value.trim(), password);
      if (attempt !== generation) return;
      consulta = opened;
      $('perfil').textContent = `Perfil: ${roleLabels[consulta.role]}`;
      showCount();
      status.textContent = 'Campanha validada para consulta.';
      form.hidden = true;
      logout.hidden = false;
      dashboard.hidden = false;
    } catch (error) {
      if (attempt !== generation) return;
      try {
        await client.auth.signOut({ scope: 'local' });
      } catch {
        // A consulta falhou e nenhuma base será mantida na página.
      } finally {
        clearConsulta(error.message);
      }
    } finally {
      fields.disabled = false;
    }
  });
  clearConsulta('Entre com sua conta institucional habilitada.');
}

try {
  initialize(configurarSupabase(
    createClient,
    import.meta.env.VITE_SGM_SUPABASE_URL,
    import.meta.env.VITE_SGM_SUPABASE_PUBLISHABLE_KEY,
  ));
} catch (error) {
  status.textContent = error.message;
}
