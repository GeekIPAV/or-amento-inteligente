## Objetivo
Tornar as linhas das tabelas "Resumo por Projeto" e "Resumo por Rubrica" clicáveis, abrindo o mesmo painel de detalhes (orçamento + movimentos) que já aparece ao clicar nos gráficos.

## Mudanças

### 1. `src/components/data-grid.tsx`
- Adicionar prop opcional `onRowClick?: (row: T) => void` em `DataGrid`.
- Quando definido, aplicar à `<TableRow>` (apenas para linhas normais, não agrupadas):
  - `onClick={() => onRowClick(row.original)}`
  - `className` com `cursor-pointer hover:bg-muted/50`.
- Não disparar em linhas de grupo nem ao clicar em controlos interativos (botões de expandir já têm o seu próprio handler).

### 2. `src/routes/_authenticated/index.tsx`
- `ResumoProjetosGrid`: aceitar novo prop `onRowClick` e repassar ao `DataGrid`.
- `ResumoRubricasGrid`: idem.
- No componente `Dashboard`:
  - Passar `onRowClick={(p) => openProjeto(p.projeto, p.nome ?? p.projeto)}` à grid de projetos (reutiliza o handler do gráfico).
  - Criar `openRubrica(rubrica: string)` que faz `setPeek({...})` com novo campo `rubrica` e passar como `onRowClick` à grid de rubricas.

### 3. `src/components/dashboard-peek.tsx`
- Estender `PeekScope` com `rubrica?: string | null`.
- Passar `rubrica` ao `detalhesIntervalo`.
- Mostrar o nome da rubrica no título (já vem via `scope.titulo`).

### 4. `src/lib/dashboard.functions.ts` — `detalhesIntervalo`
- Aceitar novo input opcional `rubrica?: string | null`.
- Se vier `rubrica`:
  - Buscar `conta_rubricas` onde `rubrica = X` → lista de contas.
  - Filtrar `transacoes_extrato` por `conta IN (...)` (ignora o filtro 6%/7% por defeito; mantém `tipo` se vier).
  - Filtrar `orcamentos` por `rubrica = X`.
- Sem alterações ao caso atual (projeto/tipo).

## Resultado
Clicar numa linha das duas tabelas abre o `DashboardPeek` com:
- Lista de movimentos filtrados (por projeto ou pelas contas dessa rubrica).
- Linhas de orçamento correspondentes.
Mesma experiência que o clique nas barras dos gráficos.
