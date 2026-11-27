import { carregarBaseSgm } from './sgm_data_adapter.mjs';

const PROJECT_URL = 'https://whjvmlcdontmmgdzdheu.supabase.co';

export function configurarSupabase(createClient, url, key) {
  if (![PROJECT_URL, PROJECT_URL + '/'].includes(url) ||
      !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key ?? '')) {
    throw Error('Configure a URL do projeto sgm-seinfra-ufg e sua chave publicável.');
  }
  return createClient(PROJECT_URL, key, {
    auth: { persistSession: false, detectSessionInUrl: false },
  });
}

export async function abrirConsulta(client, email, password, loadBase = carregarBaseSgm) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data?.session || !data.user || data.user.is_anonymous) {
    throw Error('Não foi possível entrar. Confira as credenciais e tente novamente.');
  }

  const profile = await client.from('sgm_profiles')
    .select('role').eq('user_id', data.user.id).maybeSingle();
  if (profile.error || !profile.data) {
    throw Error('O acesso ao SGM depende de um perfil institucional ativo.');
  }
  return { role: profile.data.role, ...(await loadBase(client)) };
}
