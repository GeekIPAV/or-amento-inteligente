## Inverter a lógica: Rubricas → Contas

Substituir a página atual (Contas → Rubrica) por uma nova abordagem onde cada **Rubrica** do orçamento pode ter **uma ou várias Contas** associadas.

### Alterações

**1. Base de dados (migration)**
- A tabela `conta_rubricas` já tem `conta` como UNIQUE (1 conta → 1 rubrica), o que mantém a regra "uma conta só pertence a uma rubrica" — não é preciso alterar a estrutura.
- Nova função RPC `rubricas_listagem()` que devolve, para cada rubrica distinta do orçamento:
  - `rubrica`
  - `contas` (array das contas atribuídas)
  - `num_contas` (contagem)
- Nova função RPC `contas_disponiveis()` que devolve todas as contas distintas dos movimentos (`transacoes_extrato`) com a descrição e a rubrica atualmente atribuída (se existir), para o seletor.

**2. Server functions (`src/lib/contas-rubricas.functions.ts`)**
- Adicionar `listarRubricas` (chama `rubricas_listagem`).
- Adicionar `listarContasDisponiveis` (chama `contas_disponiveis`).
- Adicionar `atribuirContasARubrica({ rubrica, contas[] })`: faz upsert das contas selecionadas com a rubrica indicada, e limpa (set rubrica=null ou delete) as contas que deixaram de pertencer a essa rubrica.

**3. UI (`src/routes/_authenticated/contas-rubricas.tsx`)**
- Reescrever a página: lista de **Rubricas** à esquerda, e para cada uma um **multi-select** de Contas (com a descrição visível) à direita.
- Mostrar resumo: nº rubricas, nº contas atribuídas, nº contas sem rubrica.
- Manter o padrão do "Gravar" que aplica todas as edições pendentes de uma só vez (como nos Centros de Custo).
- Se uma conta já estiver atribuída a outra rubrica e for selecionada noutra, mover (a UNIQUE em `conta` garante consistência).

### Perguntas de confirmação
- Manter o nome da página/rota `/contas-rubricas` e a entrada no menu como "Contas / Rubricas"? Ou prefere renomear para "Rubricas / Contas"?
