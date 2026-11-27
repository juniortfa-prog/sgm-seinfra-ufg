# Simulação da importação histórica do SGM

## Pacote institucional V55.3

O importador executou com o ZIP institucional e a configuração privada fornecidos, em modo de simulação. A origem foi lida sem escrita no banco. Todos os quantitativos da tabela abaixo também foram verificados no pacote real.

- A conferência cruzou as 3.366 OS com os CSVs, validou os vínculos de localidade, edifício e bloco e conferiu as 11 revisões.
- A configuração trouxe a data de referência de 09/11/2026, 15 entradas no catálogo legado de locais e 21 no de pessoal. O adaptador montou os 16 locais da interface a partir do catálogo territorial reconciliado.
- A projeção real passou pelo adaptador V55.5 localmente. As 394 OS H2 sem adiamento mantiveram o motivo de emergência registrado. Esse total é independente das 410 preventivas adiadas no histórico inteiro.
- O importador e o adaptador concluíram as validações executadas sem divergências. A atividade não incluiu testes de Auth ou RLS no Supabase remoto.

## Histórico da simulação sintética

A primeira simulação usou um ZIP sintético gerado em diretório temporário, antes do recebimento do pacote institucional.

| Verificação | Resultado com dados sintéticos |
| --- | ---: |
| Arquivos cobertos por SHA-256 | 7 |
| OS históricas distintas | 3.366 |
| OS na janela inclusiva de 09/11/2024 a 09/11/2026 | 2.601 |
| OS marcadas no balanço legado | 2.198 |
| Edificações | 204 |
| Blocos | 10 |
| Localidades e campi | 16 |
| Pendências de localização | 11 |
| Preventivas adiadas no histórico inteiro | 410 |

O relatório da CLI exibiu somente totais. As fixtures cobriram pontuação original de GUT diferente do produto de G, U e T, ausência de GUT, preventiva adiada com hierarquia H2, edifício de ID textual sem bloco, local em revisão e OS anterior ao corte preservada no histórico.

No PostgreSQL 17 local, uma posição de OS repetida no fim da carga causou rollback da campanha e de todas as OS. Duas execuções válidas consecutivas deixaram uma campanha e 3.366 OS únicas. Uma reexecução com conteúdo divergente foi recusada. Os testes de RLS locais confirmaram leitura das colunas da aplicação por perfis ativos, bloqueio de escrita pelo cliente e restrição ao envelope original.

A simulação sintética, isoladamente, não verificou a base institucional. O resultado da simulação com o arquivo real está registrado acima.
