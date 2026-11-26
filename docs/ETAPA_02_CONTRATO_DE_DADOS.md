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
