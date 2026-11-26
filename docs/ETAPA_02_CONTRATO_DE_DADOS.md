# SGM — etapa 2 (em preparação)

A base integral consolidada da V54.9 contém **3.366 OS**. No recorte temporal de referência de 24 meses (09/11/2026) há **2.601**, das quais **2.198** entram no balanço operacional V54.9. As outras **403** permanecem presentes e consultáveis, mas fora do balanço operacional daquele recorte.

A classificação técnica foi calculada **antes da migração**. O sistema deverá ler prioridade/GUT/hierarquia fixos e só atualizar progresso e programação.

Arquitetura:
- `sgm_campaigns` guarda os metadados, catálogos de localidades e equipe.
- `sgm_orders` conserva cada OS original, sua classificação já preparada e posição original (sem eliminar OS fora do filtro).
- `sgm_order_progress` registra o estado operacional sem alterar os dados originais.
- `sgm_execution_events` registrará histórico de conclusão/reabertura.
- `sgm_profiles` controlará perfis reais; RLS habilitada, sem autorização de escrita até revisão.

O módulo `src/sgm_data_adapter.mjs` recupera o formato `D` esperado pela V54.9 e **recusa dados incompletos**. Ele não se conecta sozinho nem substitui o login: são necessários o Supabase autorizado, o SQL aplicado e a adaptação da inicialização do HTML.

Segurança: o repositório é público, portanto **NÃO** adicionar ZIPs de OS, HTML com OS incorporadas, perfis nominativos ou segredos. A Vercel de produção continua com a página temporária.

Próximos passos: aplicar SQL revisado apenas no projeto novo; importar base privada com validação transacional; testar RLS; integrar autenticação e persistência; comparar visualmente todos os 23 módulos com o HTML original.

## Contrato de importação para a V55.5

O pacote privado ainda precisa ser conferido. Os campos abaixo definem a **projeção a produzir na importação**, com conversão explícita de nomes e tipos da fonte. Não se presume que o JSONL privado tenha as mesmas chaves.

| Destino | Campos e origem |
| --- | --- |
| `sgm_orders.original_os` | Objeto legado completo da fonte, incluindo `id`; permanece independente dos campos tratados. |
| `prepared_classification` | `g`, `u`, `t`, `gut` numéricos ou nulos, `priority` com o rótulo operacional preparado, `hierarchy` com H1/H2/H3, `deferredPreventive` booleano, `emergencyLabel` e `team` quando disponíveis. Copiar a pontuação GUT registrada, inclusive se divergir do produto de G, U e T. |
| `reconciled_location` | `situacao` (`CATALOGO_CONFIRMADO`, `UNIDADE_IDENTIFICADA` ou `REVISAR_LOCAL`), `edificio_id_catalogo`, `area_id`, `localidade_id`, rótulo `building` sem vínculo de catálogo e `team` quando conciliada. IDs textuais, omitidos ou nulos quando não aplicáveis. |
| `territory_catalog.buildings` | `id`, `name`, `locality_id`, `block_id` (nulo quando sem bloco) e `area_m2` quando disponível. |
| `territory_catalog.blocks` | `id`, `number` oficial de 1 a 10, `name`, `campus` para a vista V55.5 e, quando disponíveis, `team` e `technician`. |
| `territory_catalog.localities` | `id`, `name` para o catálogo, `site` único para a navegação legada, `city` (com UF) e equipe territorial quando disponível. |

O adaptador mantém os três objetos de origem em `sourceById`, separado das linhas mutáveis da interface. Em `D.rows`, os campos preparados substituem somente seus equivalentes de exibição. A equipe explicitamente conciliada prevalece sobre a equipe preparada e a de origem. O identificador da OS permanece o original. A localização usa os IDs do catálogo e a situação preparada. Um vínculo explícito com área nula conserva a ausência de bloco, enquanto uma área omitida herda o bloco do edifício quando houver. Uma unidade identificada pode continuar sem edifício. Somente `REVISAR_LOCAL` entra nas 11 pendências.

A campanha canônica exige 3.366 OS distintas na sequência da fonte, 2.601 no filtro inclusivo de 24 meses da referência 09/11/2026 e 2.198 marcadas no balanço legado. Os catálogos e as pendências são conferidos separadamente (204/10/16/11). O Balanço V55.5 integrado usa a marcação importada, enquanto os filtros das consultas preservam todas as linhas da campanha.

## Modelo relacional a preparar antes da operação compartilhada

| Estrutura | Chave e regra |
| --- | --- |
| Localidades e blocos | Chaves textuais por campanha; número de bloco único por campanha. |
| Edificações | Chave textual por campanha, FK obrigatória para localidade e FK opcional para bloco. Validar que os vínculos apontam para a mesma campanha. |
| Vínculo territorial da OS | Uma linha por OS, com FKs opcionais para localidade, edifício e bloco, situação territorial e origem da conciliação. Não forçar confirmação de edifício para uma unidade identificada. |
| Equipes e técnicos | Entidades distintas, com vínculo à área/equipe e período de vigência. Distinguir técnico de referência, equipe responsável e usuário autenticado. |
| Pendências cadastrais | OS, motivo, status, evidência, autor, resolução e datas. Uma resolução cria histórico e mantém a classificação da importação. |
| Execução | Estado atual versionado por OS e eventos de transição acrescentados em transação. Registrar autor via Auth, data do servidor e estados anterior/posterior. O papel operacional determina quem pode registrar, concluir ou reabrir. |

Até essa normalização, a migração do catálogo usa um snapshot JSON por campanha protegido pelas mesmas políticas de leitura. O importador deve conferir manifesto e IDs, normalizar as chaves acima e validar a campanha completa em uma transação antes de disponibilizá-la. Aplicar e testar apenas no projeto novo após confirmar nome e ref. A V55.5 integrada inicializa após Auth, RLS e validação integral, com estado de operação temporário em memória e compartilhamento externo por janela desativado. A operação institucional exige a persistência auditável e a validação dos relatórios/PDF e fluxos com sessões reais.
