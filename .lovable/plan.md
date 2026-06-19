## Objetivo
Uniformizar as páginas **Centros de Custo** e **Rubricas / Contas** numa tabela com o mesmo estilo, com cabeçalhos clicáveis para ordenar, e mostrar em cada linha o total de movimentos (e nº de contas/projetos) para ajudar a identificar.

## Abordagem
Não usar `DataGrid` (virtualização com altura fixa não combina com as linhas que têm pickers de badges variáveis). Em vez disso, criar um pequeno helper de cabeçalho ordenável e usar `<Table>` do shadcn nas duas páginas, com o mesmo layout visual.

## Mudanças

### 1. `src/components/sortable-table.tsx` (novo)
- Exporta `useSortableColumns<T>(rows, initial)` — hook que devolve `{ sorted, sort, setSort, SortHeader }`.
- `SortHeader({ id, label, align? })` — `<TableHead>` clicável com ícone (↑ ↓ ↕) e `cursor-pointer`.
- Suporta sort por string ou número. Click cicla: asc → desc → none.

### 2. `src/routes/_authenticated/centros-custo.tsx`
Substituir a `<table>` actual por `<Table>` do shadcn com colunas ordenáveis:
- **Centro de Custo** (código mono) — sort por código
- **Movimentos** (`linhas`, alinhado à direita) — sort numérico, default desc
- **Projetos do Orçamento** (`nº`) — sort numérico (`edits[cc].projetos.length`)
- **Projetos** — badges + `ProjetoPicker` (não ordenável)
- **Nome do Projeto** — input (não ordenável)
- **Ação** — botão guardar
Manter pesquisa, summary cards, botão "Gravar" global e toda a lógica de edição.

### 3. `src/routes/_authenticated/contas-rubricas.tsx`
Substituir a lista de cards por `<Table>` com mesmo estilo:
- **Rubrica** — sort alfabético
- **Contas** (nº atribuídas) — sort numérico
- **Movimentos** (soma de `linhas` das contas atribuídas) — sort numérico, default desc
- **Contas atribuídas** — badges + `ContasPicker` (não ordenável)
- **Ação** — vazio (usa botão "Gravar" global; mantém comportamento actual)

Para obter o `linhas` por conta, trocar `listarContasDisponiveis` por `listarContas` (já existe em `src/lib/contas-rubricas.functions.ts`, devolve `linhas`). `ContasPicker` passa a mostrar `X mov.` ao lado de cada conta para ajudar a identificar.

Manter pesquisa, summary cards, botão "Gravar" global, lógica de edição e impedimento de atribuir conta a >1 rubrica.

### 4. `ContasPicker` (no mesmo ficheiro)
- Receber contas com `linhas` e mostrar `· X mov.` ao lado da descrição.

## Resultado
- Ambas as páginas têm tabelas com o mesmo estilo (header com sort, hover, linhas alinhadas).
- Cada linha mostra explicitamente o nº de movimentos (e contas/projetos) que toca, ordenável por essa coluna.
- O resto do fluxo (edição inline, gravar, pickers, summary cards) permanece intacto.
