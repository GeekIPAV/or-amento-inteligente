Página `/centros-custo` com **3 campos por linha**:

| Centro de Custo (movimentos) | Projetos do Orçamento (multi-select) | Nome do Projeto (texto livre) |

O **Nome do Projeto** é o rótulo que aparece em todo o lado (dashboard, gráficos). A coluna de Projetos do Orçamento serve para "puxar" os valores orçamentados desses projetos para este Nome do Projeto.

## Backend

1. **Nova tabela `centros_custo_meta`** (1 linha por CC, guarda o nome de display):
   - `centro_custo text PRIMARY KEY`
   - `nome_display text not null`
   - timestamps + trigger updated_at
   - RLS + GRANTs standard (mesmo padrão de `centro_custo_projetos`)

2. A tabela `centro_custo_projetos` continua a guardar a relação muitos-para-muitos CC ↔ projetos do orçamento (já alterada).

3. **RPCs novas/atualizadas**:
   - `centros_custo_disponiveis()` passa a devolver `(centro_custo, nome_display, projetos[], linhas)` (LEFT JOIN com `centros_custo_meta`; quando vazio, devolve o próprio CC).
   - `guardar_centro_custo(p_centro_custo, p_nome_display, p_projetos[])` — upsert do nome em `centros_custo_meta` + sincronização das ligações em `centro_custo_projetos` para esse CC.

4. **`resumo_transacoes_projeto(p_ano, p_mes)`** — passa a agregar pelo `nome_display` da tabela `centros_custo_meta` (fallback: o próprio CC ou `(Sem projeto)` se a CC vier vazia dos movimentos). É o nome que aparece no dashboard.

5. **Orçamentado por projeto no dashboard** — em `src/lib/dashboard.functions.ts` o `orcado` por projeto passa a ser somado pelo `nome_display`: para cada linha do orçamento, encontrar todos os CCs que têm esse `projeto` em `centro_custo_projetos`, obter o `nome_display` desses CCs, e somar o orçamento ao(s) `nome_display` correspondente(s). Quando um projeto do orçamento não está mapeado a nenhum CC, vai para `(Sem projeto)`.

## Frontend

6. **Reescrever `src/routes/_authenticated/centros-custo.tsx`** como DataGrid com 3 colunas:
   - `centro_custo` (read-only, mono)
   - `projetos` (popover multi-select da lista `listarProjetos()` do orçamento; badges com X para remover)
   - `nome_display` (Input editável)
   - Botão "Gravar" por linha + gravar todas com dirty tracking
   - Pesquisa e summary cards (Total CCs, com nome, sem nome)

7. **Server functions** em `src/lib/centros-custo.functions.ts`:
   - Manter `listarProjetos` (alimenta o picker)
   - Atualizar `listarCentrosCustoDisponiveis` para incluir `nome_display`
   - Nova `guardarCentroCusto({ centro_custo, nome_display, projetos[] })` que chama a RPC `guardar_centro_custo`
   - Remover `atribuirCentrosCustoAProjeto` (deixa de ser usada)

## Notas

- A migração não toca em dados existentes; CCs sem `centros_custo_meta` aparecem com `nome_display` = código do CC até serem editados.
- Por agora não removo a tabela `centro_custo_projetos`; ela continua a ser a fonte da ligação CC → projetos do orçamento.
