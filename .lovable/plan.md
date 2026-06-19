## Problema

A página **Orçamento** importa CSV com um parser inline rígido (`onUploadCsv` em `src/routes/_authenticated/orcamento.tsx`) que:

- Exige cabeçalhos exatos `projeto, tipo, ano, mes, valor`.
- Rebenta se `tipo` não for `RECEITA`/`DESPESA`.
- Rejeita linhas com `mes` vazio, `0`, ou `mes` em texto (`jan`, `fev`…).
- Não reconhece `centro de custos`, `Mês`, `Valor (dos eur)`, `descrição`, `Rubrica`.

O CSV `Orcamento_Consolidado_2025.csv` usa esses cabeçalhos alternativos e tem linhas onde algumas colunas podem vir vazias.

Já existe `parseOrcamentoCSV` em `src/lib/csv-parser.ts` que normaliza estes cabeçalhos e infere `tipo` pelo sinal — mas também ela descarta linhas com `mes` inválido ou `valor=0`.

## Solução

1. Trocar o parser inline pelo `parseOrcamentoCSV` (com pequenas alterações para ser mais tolerante).
2. Tornar o parser tolerante a campos vazios:
   - **Mês vazio / `0` / não reconhecido**: tratar como "ano inteiro" → distribuir o valor pelos 12 meses (uma linha por mês com `valor/12`), ou — mais simples e claro — criar **12 linhas iguais com o mesmo valor** se for um valor mensal recorrente. Vou pedir confirmação ao utilizador antes de assumir (ver pergunta abaixo).
   - **Ano vazio**: usar o ano atual como fallback e avisar no toast (`X linhas sem ano usaram 2026`).
   - **Centro de custos vazio**: usar `"(Sem projeto)"`.
   - **Descrição/Rubrica vazias**: aceitar como `null`.
   - **Valor vazio ou `0`**: ignorar a linha silenciosamente (não é erro).
3. Achatar o resultado agregado em linhas individuais `{projeto, descricao, rubrica, tipo, ano, mes, valor}` e enviar para `uploadMut`.
4. Mostrar um toast resumo: `N linhas importadas, M ignoradas (sem valor), K com mês em falta tratadas como anuais`.

## Detalhes técnicos

Em `src/lib/csv-parser.ts` (`parseOrcamentoCSV`):

- Quando `mes` não resolve para 1-12 (vazio, `0`, texto desconhecido) **e** `valor ≠ 0`: marcar a linha como "anual" e replicá-la pelos 12 meses no bucket (em vez de descartar).
- Ano em falta: usar `new Date().getFullYear()`.
- Devolver contadores extra: `semMes`, `semValor`, para o toast.

Em `src/routes/_authenticated/orcamento.tsx` (`onUploadCsv`):

- Ler o ficheiro como texto, chamar `parseOrcamentoCSV`.
- Validar apenas que existem cabeçalhos para `centro de custos` e `valor` — os restantes têm fallbacks.
- Achatar `OrcamentoLinhaAgg.meses[]` em linhas `Linha` (uma por mês com valor ≠ 0).
- Chamar `uploadMut.mutate({ nome, linhas })`.

Sem alterações em BD, servidor ou outras páginas.

## Pergunta antes de implementar

Quando o **mês está vazio** mas o valor existe, o que queres?

1. **Replicar o valor pelos 12 meses** (ex.: `-70€` sem mês → `-70€` em cada mês, total `-840€`). Bom para custos mensais recorrentes.
2. **Dividir o valor pelos 12 meses** (ex.: `-840€` sem mês → `-70€` em cada mês, total `-840€`). Bom para totais anuais.
3. **Pôr tudo em janeiro** e deixar para editares depois.

Diz-me qual queres e implemento.
