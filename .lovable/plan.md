Reaproveitar a tabela existente `centro_custo_projetos` e transformar a página `/centros-custo` no mesmo padrão de **Contas → Rubricas**, mas com **Projetos (do orçamento) → Centros de Custo**.

A coluna `nome_projeto` passa a guardar o **projeto do orçamento** (`orcamentos.projeto`) em vez de texto livre. Cada centro de custo só pode estar atribuído a um projeto (já garantido pela PK `centro_custo`).

## Base de dados (migration — sem tabela nova)

1. **Funções SQL novas** (espelham as de rubricas, usando `centro_custo_projetos`):
   - `projetos_disponiveis()` → distinct `projeto` de `orcamentos`
   - `centros_custo_disponiveis()` → distinct CC de `transacoes_extrato` + projeto atribuído (LEFT JOIN `centro_custo_projetos`)
   - `projetos_listagem()` → cada projeto + array de CCs atribuídos + contagem
   - `atribuir_centros_custo_projeto(p_projeto, p_centros[])` → upsert no `centro_custo_projetos` (campo `nome_projeto = p_projeto`), apaga os CCs que deixaram de pertencer

2. **Atualizar `resumo_transacoes_projeto(p_ano, p_mes)`** para agrupar pelo `nome_projeto` da tabela `centro_custo_projetos` (em vez de pelo `centro_custo` cru). CCs sem mapeamento → `(Sem projeto)`.

3. `centros_custo_listagem()` mantém-se (usada na listagem antiga, ainda útil como referência) — sem alterações destrutivas.

## Frontend

4. **Substituir `src/routes/_authenticated/centros-custo.tsx`** pelo padrão de `contas-rubricas.tsx`:
   - Linhas = projetos do orçamento
   - Por linha: popover com checkboxes dos CCs disponíveis (com indicação se já estão noutro projeto — atribuir move-os)
   - Pesquisa, badges, save com dirty-tracking
   - Título: "Projetos → Centros de Custo"

5. **Server functions** em `src/lib/centros-custo.functions.ts`:
   - Substituir `listarCentrosCusto` / `guardarNomeProjeto` por `listarProjetos`, `listarCentrosCustoDisponiveis`, `atribuirCentrosCustoAProjeto` (chamam as novas RPCs).

6. **Dashboard** — já chama `resumo_transacoes_projeto`; passa a usar o novo cruzamento automaticamente, sem mudanças de UI.

## Notas

- A entrada de menu mantém-se ("Centros de Custo") — só a UX e a semântica mudam.
- Migrations não tocam em dados existentes de `centro_custo_projetos`; os registos que tenham `nome_projeto` que não bata certo com nenhum projeto do orçamento simplesmente não aparecem listados nesse projeto (e os CCs ficam disponíveis para reatribuir).
