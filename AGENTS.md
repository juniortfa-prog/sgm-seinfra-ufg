# Diretrizes para Codex — SGM SEINFRA/UFG

Objetivo: implantar a versão **V55.5** do SGM com a **mesma identidade visual e funcionalidades**, usando GitHub (código), Vercel (interface) e Supabase (dados privados).

## Restrições ABSOLUTAS
1. Repositório é **público**. NUNCA publicar HTML com `<script id="data">{"rows":...}`, registros de OS, CSV/JSONL real, planilhas de serviços, nomes de colaboradores provenientes da base, senhas, URLs com segredo, `service_role` ou `sb_secret_`.
2. A página temporária da branch `main` é a produção atual. **Não alterar `main` ou implantar produção** sem critérios de aceite, autenticação real, RLS, testes e autorização.
3. A versão V55.5 enviada privadamente pelo usuário é o padrão visual/funcional. **Não redesenhar do zero**, não converter automaticamente para React/Next.js e não substituir Kanban, menus, indicadores ou PDFs por aproximações. Preservar a identidade visual.
4. A base é **fechada**: 3.366 OS consolidadas, data de referência 09/11/2026. O filtro temporal (3, 6, 12, 24, 60, 120 meses e todo o histórico) altera apenas a consulta. Nenhuma OS deve ser apagada por mudar período, concluir, corrigir localidade ou estar fora do balanço.
5. As classificações GUT, H1/H2/H3, preventiva adiada, prioridade e localização **já foram tratadas**. Importar os campos, não reinterpretar textos com IA. Manter valor G×U×T original separado de eventual prioridade operacional; não inventar valores ausentes.
6. Não misturar a conta de 3.366 OS históricas, 2.601 no período de 24 meses, 2.198 no balanço operacional legado e 11 localidades realmente sujeitas a revisão.
7. **Não importar** os dados ao projeto antigo `meu-ponto`. O projeto correto é o novo `sgm-seinfra-ufg`; exigir confirmação explícita do `project ref` antes de migrations ou import.
8. Não implementar Supabase `service_role` ou secrets no navegador. Usar Auth, RLS efetivo e persistência multiusuário, com auditoria e prevenção de edição concorrente.
9. OS e OT, Kanban, agenda, roteiros, áreas/edifícios, pré-vistorias, permissões e balanço precisam consumir **uma fonte de verdade**, sem armazenamentos locais divergentes e sem duplicar OT por drag-and-drop.
10. Produção: somente mediante testes e verificação explícita, via PR em vez de push direto em `main`.

## Bases privadas (não presentes no repositório)
- `SGM_V55_3_Bases_Privadas_Prontas_Para_Importacao.zip` contém 3.366 OS em JSONL/CSV, 204 edifícios, 10 áreas, 16 localidades e vínculos.
- `SGM_SEINFRA_UFG_V55_5_Mobilizacao_Menu_Sequencial.html` é a versão local completa, com OS embutidas. **Não publicar essa versão original.**
- `SGM_Etapa_02_Kit_Tecnico_Sem_Dados.zip` traz um protótipo de esquema/importador/adaptador, sujeito à revisão para V55.3.
- O usuário poderá fornecer esses arquivos via ambiente privado. Se não estiverem disponíveis, iniciar por estrutura, testes e documentação; não fabricar dados.

## Fluxo institucional
1. Conferir e corrigir OS, território, equipes e bloco 01–10 (interiores podem ficar sem bloco).
2. Pré-vistoria por área e técnico de referência.
3. Formar OT, distribuir no Kanban sem duplicidade; uma OT ativa tem um único roteiro/posição.
4. Conferir e aprovar roteiro por Gestor/Supervisor; Encarregado pode compartilhar APROVADO, acompanhar serviços/pendências.
5. Secretaria de OS e perfis habilitados podem registrar a conclusão com autenticação, auditoria e registro do responsável.
6. Resultados: acompanhar base inicial fixa, concluídas e saldo, por filtros temporais e operacional.

## Critérios de aceite
- Comparação visual automatizada da V55.5 nos 24 módulos e fluxos; não deformar o design.
- Conferência integrada 3.366 / 2.601 / 2.198 + 204 / 10 / 16 / 11, sem somas ambíguas.
- RLS: anônimo sem acesso, usuário não habilitado sem acesso, perfis com permissões distintas.
- Concluir/reabrir OS atualiza indicadores e históricos, sem excluir registros.
- Reprogramar OT remove posição anterior e revalida aprovação quando necessário.
- Testes entre duas sessões/navegadores; consistência de OT/rotas/balanço.
- Verificação automatizada de dados privados no diff antes do merge.

Ao terminar uma etapa, informar o que foi realmente feito, testes executados e bloqueios. Não afirmar publicação operacional sem comprovação.
