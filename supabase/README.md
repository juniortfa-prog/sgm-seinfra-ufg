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
- `tests/sgm_rls.sql` testa a migração em PostgreSQL descartável. Execute primeiro `tests/sgm_auth_fixture.sql` para criar as roles e funções simuladas de Auth. Aplique as migrações na ordem dos arquivos e então execute o teste com `psql -v ON_ERROR_STOP=1` como proprietário. O teste reverte os registros sintéticos.
- Para conferir o acesso sem conexão, execute `npm run dev`. Para validar o login real em ambiente autorizado, copie `.env.example` para `.env.local`, preencha a chave publicável, reinicie o servidor e use uma conta previamente habilitada. Os módulos da V55.5 abrem após a validação da campanha. Veja o contrato de carga em `docs/ETAPA_02_CONTRATO_DE_DADOS.md`.

## Próxima migração

1. Conferir catálogo e identificadores do pacote privado em ambiente seguro. Modelar localidades, edifícios, blocos e vínculos com chaves textuais de origem. Aceitar localidades sem bloco e manter explicitamente os casos em revisão.
2. Mapear o conteúdo para o formato `D` e validar o manifesto antes da carga. Importar privadamente em transação idempotente e conferir os totais históricos, temporais, operacionais e territoriais.
3. Modelar progresso, OT, vínculos OS–OT, pré-vistorias, roteiros, programação e eventos de auditoria. Programação, Kanban e Agenda devem consultar a mesma posição ativa, com unicidade por OT. Mover uma OT em transação, validar a versão esperada do registro e revogar aprovação da rota alterada. Registrar mudanças com a conta autenticada, a data e a versão anterior. Concluir e reabrir atualizam progresso e balanço sem alterar a OS original.
4. Antes de expor a escrita, testar as permissões de aprovação de Gestor/Supervisor, compartilhamento de roteiro aprovado por Encarregado e registro/encerramento pela Secretaria de OS. Testar concorrência e rodar os advisors no projeto autorizado.

## Carga histórica privada V55.3

Execute o importador em estação privada, com o ZIP e a configuração fora do checkout e da publicação. O comando padrão simula a carga integral sem instalar o driver de banco, abrir conexão ou escrever arquivos de saída com registros.

```bash
python scripts/importar_sgm_v553.py /caminho/privado/pacote.zip --config /caminho/privado/sgm-importacao.local.json
```

A configuração é JSON. Campos aceitos:

| Campo | Como preencher |
| --- | --- |
| `campo_balanco_original` | Caminho pontuado até o booleano de elegibilidade **já registrado** no JSONL. Confirmar o caminho no ZIP privado. Validado separadamente da data e da classificação. |
| `colunas_edificios` | Opcional. As chaves `localidade` e `bloco` apontam para os cabeçalhos do CSV 01. Os padrões são `localidade_id` e `area_id`, a conferir no arquivo privado. |
| `rotulos_localidade` | Opcional. Mapa de ID do CSV 07 para o rótulo `site` usado na navegação V55.5 quando difere de `nome_localidade`. |
| `aliases_localidade` | Opcional. Mapa de rótulo territorial registrado para ID do CSV 07 quando a grafia da fonte difere do catálogo. Não usar a unidade requisitante para resolver campus. |
| `metadados_v55` | Opcional na simulação e obrigatório na escrita. Fornecer `original_metadata` (o objeto de metadados de `D` sem `rows`, `sites` ou `staff`), `sites_catalog` e `staff_catalog` da fonte privada. |

O importador grava a origem, a classificação e o território nas colunas existentes. A terceira migração acrescenta o SHA-256 do manifesto à campanha e o objeto JSONL original em `sgm_orders.source_record`, coluna reservada à operação administrativa. A mesma campanha é protegida por trava transacional. Reexecuções idênticas comparam campanha e linhas completas, sem duplicar. Uma divergência interrompe a carga, preservando o conteúdo anterior. A campanha histórica inteira é carregada na primeira execução, inclusive OS fora dos recortes.

### Verificação e execução remota

1. Em ambiente privado, executar a simulação no ZIP real e reconciliar quaisquer diferenças. Confirmar o campo de elegibilidade, cabeçalhos territoriais, rótulos e metadados da V55.5.
2. Injetar `SGM_SUPABASE_ACCESS_TOKEN` pelo ambiente e rodar `python scripts/importar_sgm_v553.py --verificar-destino` antes de aplicar as migrações. A API de gerenciamento deve confirmar `sgm-seinfra-ufg` e `whjymlcdontmmgdzdheu`. Aplicar as migrações somente na conexão verificada.
3. Validar Auth com contas reais e executar os testes de leitura, bloqueio e escrita negada no projeto confirmado antes da carga institucional. Concluir a validação em ambiente controlado.
4. Instalar o driver com `python -m pip install -r scripts/requirements-importacao.txt`. Injetar `SGM_SUPABASE_DB_PASSWORD` pelo ambiente. O modo de escrita usa o endpoint direto do projeto e TLS com verificação do hostname. A estação precisa alcançar o endpoint direto.
5. Quando autorizado, acrescentar `--aplicar --confirmar-ref whjymlcdontmmgdzdheu` ao comando de simulação. O importador repete a verificação do projeto antes de conectar. Depois da carga, conferir os quantitativos e a leitura autenticada. Uma falha na validação ou divergência de campanha não autoriza atualização ou exclusão automática.

Para repetir o teste de idempotência, execute as migrações em um PostgreSQL descartável com as funções de Auth simuladas, instale o driver e rode a suíte Python com `SGM_TEST_POSTGRES_PORT` apontando para a porta local dessa instância vazia.
