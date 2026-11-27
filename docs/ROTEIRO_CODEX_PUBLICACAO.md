# SGM V55.5 — roteiro de implantação com Codex

## Estado confirmado em 26/11/2026
- GitHub público: `juniortfa-prog/sgm-seinfra-ufg`.
- Vercel: `sgm-seinfra-ufg` publicado **somente como página temporária**.
- Supabase novo: `sgm-seinfra-ufg` criado pelo usuário. A conexão Supabase deste chat ainda lista **apenas `meu-ponto`**, portanto nenhuma migração/carga foi aplicada aqui.
- Branch para Codex: `codex-implantacao-v55`. Baseada na branch `preparacao-supabase`; `main` continua intocada.

## Conjunto de dados privado validado
Arquivo: `SGM_V55_3_Bases_Privadas_Prontas_Para_Importacao.zip`.
- `01_edificios_204.csv`: 204 edifícios (identificadores textuais, não presumir que todos sejam números).
- `02_areas_10.csv`: 10 blocos de manutenção.
- `03_OS_3366_com_tratamento_territorial.csv`: 3.366 OS, delimitador `;`, UTF-8 BOM.
- `04_vinculos_os_localizacao_3366.csv`: 3.366 vínculos.
- `05_os_revisao_manual.csv`: 11 com revisão de local.
- `06_OS_3366_integral_classificada_para_Supabase.jsonl`: uma linha JSON por OS, com `fonte_original`, `classificacao_preparada`, `localizacao_conciliada` e fotografia operacional.
- `07_localidades_e_campi_16.csv`: 16 localidades/campi.
- Manifesto: SHA256 de cada arquivo; validar ANTES de acessar o banco.

O HTML V55.5 foi inspecionado: `D=JSON.parse(document.getElementById('data').textContent)`; embute 3.366 OS no HTML e utiliza localStorage para dados operacionais. A base `D` (keys `rows`, `sites`, `staff`, `raw`, `reqoffice`, `refdate`, `latest`, `histrefs`, `sources`) será preenchida **após** autenticação a partir do Supabase. Não carregar base privada por URL pública, arquivo estático ou bundle Vercel.

## Sequência de entregas (PRs pequenas e reversíveis)
### Fase A — Extrair interface pública com privacidade
- Partir da V55.5 original fornecida privadamente. Remover o script `id=data` com a base real, inclusive imagens/screenshots que contenham dados de OS; guardar fotos operacionais em Storage protegido, se necessário.
- Extrair CSS e JS **sem alterar layout**, manter as 24 abas, menus, visual do Kanban e PDF.
- Implementar login Supabase Auth antes de solicitar dados.
- Sem Supabase, exibir bloqueio claro de configuração, não base fictícia nem erro silencioso.

### Fase B — Importação privada e RLS
- Revisar protótipo da Etapa 2. Criar migrações com CLI Supabase da versão instalada (`supabase --help`; `supabase migration new`).
- Modelar campanhas, OS (origem imutável), locais, edifícios, áreas, técnico, equipe, OT, vínculo OS-OT, roteiros, programação, pré-vistorias, progresso, auditoria e perfis.
- Importar somente no Supabase novo, em transação idempotente, sem perda de metadados e conferindo o manifesto.
- RLS por perfil **no banco**, não só em elementos visuais; nunca abrir leitura `TO anon`.

### Fase C — Programação e execução compartilhada
- Migrar localStorage dos registros operacionais para backend com controle de versão; se houver backup local, solicitar reconciliação explícita.
- Kanban e Agenda compartilham a mesma programação; proibir duplicação com restrição de unicidade no banco e movimentação transacional.
- Gestor/Supervisor aprovam; Encarregado compartilha roteiro aprovado e confere pendências; Secretaria de OS registra conclusão conforme a política do gestor; auditar cada alteração.
- Filtro temporal operacional independente do conjunto congelado de OS.

### Fase D — QA e publicação
- Comparar capturas antes/depois (desktop + celular) e interações dos 24 módulos.
- Conferir totais 3.366 histórica, 2.601 (24 meses da referência), 2.198 no balanço legado, sem excluir as 403 restantes do período.
- Validar RLS com sessão anônima, perfil pendente, Secretaria/Encarregado, Supervisor/Gestor, e auditoria.
- Fazer deploy **Preview** protegido; testar em dois navegadores.
- Solicitar aprovação do gestor antes do merge em `main` e promoção para produção.

## Variáveis de ambiente
- Front-end: URL Supabase e *publishable key* (pública e com RLS).
- Importador local: URI privada do Postgres fornecida pelo ambiente seguro; **nunca no código nem nos logs**.
- Nunca inserir `service_role`, `sb_secret` e senhas no JavaScript enviado ao navegador.

## Contas e filtros
- **Base inteira imutável:** 3.366 OS consolidadas.
- **Filtro 24 meses:** 2.601 registros por data desde 2024-11-09, antes das exclusões de escopo originais.
- **Balanço V54.9 (24m):** 2.198 OS pendentes no recorte operacional histórico (916 predial + 1.282 refrigeração). Isso NÃO equivale à quantidade total do período.
- **Localização V55.3:** 1.899 correspondências com edifício do catálogo, 1.456 referências de unidade e 11 casos manuais.
- **Referências territoriais:** 204 edifícios, 10 blocos, 16 localidades; interiores podem ficar sem bloco.
- Novas OS não estão previstas na campanha; concluir não exclui registro.

## O que NÃO foi concluído
- Novo projeto não acessível por esta conexão; sem DDL remoto, sem importação, sem dados em produção.
- HTML V55.5 ainda não está no repositório (tem dados privados).
- Não há integração multiusuário funcionando ou teste end-to-end com Supabase.

## Identificação preventiva do destino
A captura fornecida pelo gestor mostra a URL pública do NOVO projeto Supabase `https://whjvmlcdontmmgdzdheu.supabase.co` (ref `whjvmlcdontmmgdzdheu`). **O conector Supabase desta conversa não tem permissão para verificar o projeto.** Antes da importação, confirmar no painel do Supabase que o nome é `sgm-seinfra-ufg` e o ref é esse; validar também o destino da conexão SQL. Nunca usar o projeto antigo `rezdzemeiuirujhbryxp` (`meu-ponto`).
