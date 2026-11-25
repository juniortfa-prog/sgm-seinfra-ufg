# Mapa de dados da V54.9 — apenas campos, sem registros

O JSON incorporado no HTML original é interpretado como `D`.

**Estrutura de origem:** `rows` (OS consolidadas), `sites` (localidades/equipes), `staff` (capacidade) e `raw`, `reqoffice`, `refdate`, `latest`, `histrefs`, `sources` (metadados).

**Campos da OS por grupo:**
- Identidade e origem: `id`, `req`, `reqs`, `count`, `first`, `date`, `href`, `hist`, `archive`, `duplicate`, `dupWith`.
- Técnico: `div`, `office`, `service`, `unit`, `local`, `desc`, `obs`, `status`, `category`, `priority`, `prof`.
- Território: `site`, `team`, `locconf`, `building`, `buildingConfirmed`.
- Planejamento: `g`, `u`, `t`, `gut`, `reason`, `review`, `h`, `material`.
- Campos opcionais de revisão também deverão ser preservados.

**Persistência local do sistema:** a função `snapshot()` possui `execution`, `settings`, `caps`, `splitMode`, `baseline`, `moves`, `closures`, `period`, `teamAssignments`, `refrigTerritory`, `tripPlans`, `sdiRecords`, `locationAssignments`. O módulo de gestão mantém `users`, `workers`, `fronts`, `routes`, `assignments`, `permissions`, `audit`.

## Modelo relacional preliminar — ainda não aplicado

| Grupo | Tabelas candidatas |
|---|---|
| Importação | `import_batches` |
| Ordens de serviço | `service_orders`, `service_order_sources` |
| Execução/auditoria | `execution_events`, `audit_events` |
| OT | `work_orders`, `work_order_items` |
| Programação | `routes`, `route_items` |
| Recursos | `teams`, `staffing`, `capacity_settings` |
| Autorização | `profiles` com vínculo a `auth.users` |

Os identificadores legados precisam ser preservados. Reconciliação por lote deve registrar inclusões, atualizações, divergências e ausências. Nenhuma tabela será criada sem revisão das políticas de acesso.
