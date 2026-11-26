# Simulação da importação histórica do SGM

A simulação executada nesta etapa usou um ZIP sintético gerado em diretório temporário. O pacote institucional ainda não estava disponível no ambiente de execução.

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

As divergências ainda a conferir no ZIP real são o caminho e o formato do marcador do balanço, os cabeçalhos que ligam edificações a localidades e blocos, os rótulos territoriais da V55.5 e a disponibilidade dos metadados legados para o carregamento da campanha. Os números da revisão do PR sobre o ZIP privado são referência de aceite. Esta simulação não os verificou sobre a base institucional.
