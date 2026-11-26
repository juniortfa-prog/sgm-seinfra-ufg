# SGM — Organização da migração

**Referência:** SGM V54.9, preservada fora do repositório público. **Produção:** manter a página temporária até a validação final. Não reconstruir a interface.

## Arquitetura

- **GitHub:** somente código auditado, testes e documentação sem dados institucionais.
- **Vercel:** interface do SGM e ambiente de teste; ainda não hospeda a versão operacional.
- **Supabase:** base de OS, OT, rotas, equipes, execução, parâmetros, autenticação e auditoria.

## Constatações técnicas na V54.9

- Um arquivo HTML contém interface (CSS/JS) e JSON operacional incorporado.
- O código utiliza `D = JSON.parse(document.getElementById('data').textContent)`.
- O objeto de dados possui `rows`, `sites`, `staff` e metadados da referência.
- Alterações operacionais são guardadas em `localStorage`, inclusive sob `seinfra-ufg-maintenance-v24-2026-11-09` e `seinfra-ufg-fluxo-v42`.
- Os perfis de Gestor/Supervisor/Encarregado na versão local não substituem autenticação real nem RLS.

## Sequência obrigatória

1. Guardar a versão original como referência visual, lógica e contábil privada.
2. Separar dados e código em ambiente de preparação isolado.
3. Revisar banco e políticas RLS; importar sem perder identificadores históricos.
4. Implementar login real, permissões no banco e persistência transacional.
5. Alimentar os mesmos módulos do SGM com a nova fonte de dados, sem redesenhar telas.
6. Comparar todas as telas, contas e fluxos com a versão original.
7. Publicar somente após testes de segurança, desempenho e funcionamento.

## Regras de proteção

- Não publicar o HTML original nem exportações de OS no repositório público.
- Não expor `service_role`, secret keys, tokens ou senhas no navegador.
- Não tratar OS ausente de uma exportação como concluída automaticamente.
- Evitar contagem duplicada nas relações OS → OT → roteiro.
- Preservar histórico de conclusão/reabertura e exigir reaprovação após edição de rotas.
- Manter Kanban e Agenda diária vinculados à mesma programação.
- Não alterar o site de produção sem validação e possibilidade de retorno.

**Estado:** somente preparação técnica; sem banco migrado e sem SGM operacional publicado.

## Diagnóstico da referência V55.5 e escopo da primeira etapa

A referência `referencia/SGM_V55_5_interface_sem_dados.html` contém o CSS, a marcação e três blocos executáveis de JavaScript. O JSON vazio em `script#data` inicializa `D` de forma síncrona, antes dos filtros, do render inicial e das rotinas posteriores que compartilham o mesmo estado. Menus, módulos, indicadores e relatórios usam essas funções diretamente. O adaptador assíncrono agora recompõe esse formato com campanha, catálogos, metadados e OS paginadas, preservando a sequência original. O filtro da entrada de validação usa a data de abertura armazenada e a data de referência da campanha.

O legado mistura preferências de interface, estado de execução e cadastros operacionais em armazenamento local. A chave `seinfra-ufg-maintenance-v24-2026-11-09` e suas versões anteriores guardam execução, datas, capacidades, movimentação, encerramentos e ajustes de equipe e território. A chave `seinfra-ufg-fluxo-v42` guarda contas de demonstração, permissões, equipes e roteiros. Há também preferências de expansão de seções. Alguns fluxos do legado exportam ou compartilham dados, por isso conectar o objeto `D` institucional diretamente ao HTML também depende de revisar esses pontos e as permissões.

A tela de validação fica em `/integracao/`. Ela usa Supabase Auth em memória, checa o perfil ativo por RLS, carrega a campanha e exibe apenas os totais. O HTML da V55.5 permanece como referência visual. Para ativá-lo com dados institucionais, a próxima integração deve aguardar a leitura autorizada antes de executar os scripts que consomem `D` e trocar as gravações operacionais por ações do backend. O recorte e o balanço legado devem continuar independentes da contagem histórica.
