Cada **projeto do orçamento** só pode estar atribuído a **1 centro de custo** (cada CC continua a poder ter vários projetos).

## Backend

1. **Migração**:
   - `DELETE` defensivo de duplicados em `centro_custo_projetos` (mantém o mais antigo por `nome_projeto`).
   - Substituir a UNIQUE `(centro_custo, nome_projeto)` por UNIQUE em `nome_projeto`.
   - Atualizar `guardar_centro_custo`: usar `ON CONFLICT (nome_projeto) DO UPDATE SET centro_custo = EXCLUDED.centro_custo, updated_at = now()` — atribuir um projeto a um novo CC move-o do CC anterior.

## Frontend (`src/routes/_authenticated/centros-custo.tsx`)

2. No picker de projetos: esconder os projetos já atribuídos noutro CC (com base nos `edits` locais), exatamente como `ContasPicker`.

3. Quando o utilizador adiciona um projeto a um CC, remover esse projeto dos `edits` dos outros CCs em estado local (a BD garante consistência via UNIQUE).

4. **Novo summary card**: "Projetos por atribuir" = nº de projetos do orçamento que não estão atribuídos a nenhum CC. Calculado a partir de `listarProjetos()` − projetos presentes nos `edits` locais.
