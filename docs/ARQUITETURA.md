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
