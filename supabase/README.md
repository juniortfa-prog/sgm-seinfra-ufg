# Supabase — primeira etapa

O destino previsto é o projeto **sgm-seinfra-ufg** (`whjymlcdontmmgdzdheu`). Confirme o **nome e o ref** na conexão autorizada antes de aplicar a migração. A migração foi executada em PostgreSQL local descartável com funções de autenticação simuladas.

A migração cria três tabelas com RLS:

| Tabela | Responsabilidade |
| --- | --- |
| `sgm_profiles` | Vincula uma conta de Supabase Auth ao perfil e indica se está habilitada. |
| `sgm_campaigns` | Guarda código, contagem esperada, metadados da interface e catálogos. A segunda migração acrescenta o snapshot territorial da campanha. |
| `sgm_orders` | Preserva OS original, data, posição, classificação preparada, localização conciliada e pertinência ao balanço V54.9. |

Os quatro perfis habilitados têm a mesma permissão de consulta nesta etapa. Cada conta vê somente seu próprio perfil ativo. As tabelas não concedem leitura à role `anon` nem escrita à role `authenticated`. A habilitação de contas será administrada pelo responsável pelo banco.

## Validação local

- `npm ci`, `npm test` e `npm run build` verificam o cliente com fixtures sintéticas.
- `tests/sgm_rls.sql` testa a migração em PostgreSQL descartável. Use uma tabela mínima `auth.users(id uuid primary key)` e funções `auth.uid()` e `auth.jwt()` que leem `request.jwt.claims`, com roles `anon` e `authenticated` e acesso ao esquema `auth`. Aplique as migrações na ordem dos arquivos e então execute o teste com `psql -v ON_ERROR_STOP=1` como proprietário. O teste reverte os registros sintéticos.
- Para conferir o acesso sem conexão, execute `npm run dev`. Para validar o login real em ambiente autorizado, copie `.env.example` para `.env.local`, preencha a chave publicável, reinicie o servidor e use uma conta previamente habilitada. Os módulos da V55.5 abrem após a validação da campanha. Veja o contrato de carga em `docs/ETAPA_02_CONTRATO_DE_DADOS.md`.

## Próxima migração

1. Conferir catálogo e identificadores do pacote privado em ambiente seguro. Modelar localidades, edifícios, blocos e vínculos com chaves textuais de origem. Aceitar localidades sem bloco e manter explicitamente os casos em revisão.
2. Mapear o conteúdo para o formato `D` e validar o manifesto antes da carga. Importar privadamente em transação idempotente e conferir os totais históricos, temporais, operacionais e territoriais.
3. Modelar progresso, OT, vínculos OS–OT, pré-vistorias, roteiros, programação e eventos de auditoria. Programação, Kanban e Agenda devem consultar a mesma posição ativa, com unicidade por OT. Mover uma OT em transação, validar a versão esperada do registro e revogar aprovação da rota alterada. Registrar mudanças com a conta autenticada, a data e a versão anterior. Concluir e reabrir atualizam progresso e balanço sem alterar a OS original.
4. Antes de expor a escrita, testar as permissões de aprovação de Gestor/Supervisor, compartilhamento de roteiro aprovado por Encarregado e registro/encerramento pela Secretaria de OS. Testar concorrência e rodar os advisors no projeto autorizado.
