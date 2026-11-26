import { createClient } from '@supabase/supabase-js';
import { abrirConsulta, configurarSupabase } from './sgm_auth.mjs';
import { documentoV55 } from './sgm_v55_boot.mjs';

const $ = (id) => document.getElementById(id);
const form = $('entrar');
const logout = $('sair');
const workspace = $('workspace');
const status = $('status');
let generation = 0;

function clearConsulta(message) {
  generation++;
  workspace.replaceChildren();
  logout.hidden = true;
  form.hidden = false;
  document.body.classList.remove('autenticado');
  status.textContent = message;
}

function initialize(client) {
  client.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') clearConsulta('Sessão encerrada.');
  });
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
      const { default: templateV55 } = await import('../referencia/SGM_V55_5_interface_sem_dados.html?raw');
      if (attempt !== generation) return;

      const frame = document.createElement('iframe');
      frame.title = 'SGM V55.5';
      frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-modals allow-downloads');
      frame.srcdoc = documentoV55(templateV55, opened.base, opened.role);
      workspace.replaceChildren(frame);
      document.body.classList.add('autenticado');
      status.textContent = 'Campanha verificada. Alterações desta sessão são temporárias.';
      form.hidden = true;
      logout.hidden = false;
    } catch (error) {
      if (attempt !== generation) return;
      try {
        await client.auth.signOut({ scope: 'local' });
      } catch {
        // Nenhum módulo recebeu a base após a falha.
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
