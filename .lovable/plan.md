
# Dashboard de Finanças (PT-PT)

Aplicação interna para controlo orçamental plurianual, importação de extratos contabilísticos e análise de desvios Orçado vs Realizado.

## 1. Backend (Lovable Cloud)

### Autenticação
- Email/password (sem Google), sem tabela `profiles` (não precisamos de dados de perfil extra).
- Página `/auth` para login e registo.
- Todas as páginas da aplicação ficam sob `_authenticated/` (gate gerido pela integração).
- Dados partilhados entre todos os utilizadores autenticados (ferramenta de equipa) — RLS permite SELECT/INSERT/UPDATE/DELETE a qualquer utilizador autenticado.

### Tabelas

**`orcamentos`** — meta orçamental por projeto/ano com versionamento:
- `id` (uuid, PK)
- `projeto` (text)
- `ano` (int)
- `versao` (int) — incremental por (projeto, ano)
- `ativo` (boolean) — apenas uma versão ativa por (projeto, ano, tipo)
- `tipo` (enum `RECEITA` | `DESPESA`)
- `m1`..`m12` (numeric, default 0)
- `created_at`, `created_by` (uuid → auth.users)
- Índice: (ano, ativo, tipo)

**`transacoes_extrato`** — linhas importadas dos CSVs:
- `id` (uuid, PK)
- `conta` (text), `descricao_conta` (text)
- `data` (date)
- `num_documento` (text), `diario` (text), `movimento` (text)
- `centro_custo` (text, nullable)
- `debito` (numeric, default 0), `credito` (numeric, default 0)
- `mes_referencia` (text, formato `YYYY-MM`)
- `importado_em` (timestamptz), `importado_por` (uuid)
- Índice: (mes_referencia), (data)

RLS: ambas as tabelas permitem tudo a `authenticated`; GRANTs para `authenticated` e `service_role`.

## 2. Frontend (TanStack Start)

Layout com sidebar de navegação (Dashboard, Orçamento, Importar Extratos) + header com logout.

### `/` — Dashboard Principal
- Seletores: **Ano** (dropdown) e **Mês de referência** (1–12).
- Cards KPI:
  - Receita Orçada (acumulada m1..mês) vs Receita Realizada (soma de `credito` das transações com `mes_referencia` ≤ mês selecionado do ano).
  - Despesa Orçada vs Despesa Realizada (soma de `debito`).
  - Desvio Absoluto (Orçado − Realizado) e % Execução (Realizado / Orçado).
- Gráfico de barras (Recharts) mensal m1..m12: Orçado vs Realizado, separado por Receita e Despesa (tabs ou dois gráficos).
- Tabela-resumo por projeto com desvios.
- Usa apenas a versão `ativo = true` de cada orçamento.

### `/orcamento` — Gestão de Orçamento
- Seletores: Ano, Tipo (Receita/Despesa), Versão (dropdown com histórico; default = ativa).
- Tabela editável: linhas = projetos, colunas = m1..m12 + Total.
  - Inputs numéricos inline; guardar em batch.
  - Botão **+ Adicionar Projeto** (nova linha).
- Botão **Criar Nova Versão**:
  1. Marca versão atual `ativo = false`.
  2. Copia todas as linhas com `versao = max+1`, `ativo = true`.
  3. Abre nova versão em modo edição.
- Versões antigas são read-only (apenas consulta).

### `/importar-extratos` — Importação CSV
- Seletores: Ano e Mês de referência (preenche `mes_referencia`).
- Dropzone drag-and-drop (react-dropzone) para um ou mais CSV.
- Parser cliente-side (PapaParse):
  - **Deteção automática** de separador (`,` ou `;`) e formato de data (`DD/MM/AAAA` ou `AAAA-MM-DD`).
  - Mapeamento case-insensitive de cabeçalhos: `Conta`, `Descrição Conta`/`Descricao_Conta`, `Data`, `Nº Documento`/`Num_Documento`, `Diário`/`Diario`, `Movimento`, `Centro de Custo`/`Centro_Custo`, `Débito`/`Debito`, `Crédito`/`Credito`.
  - Valores numéricos: aceita vírgula decimal e separadores de milhar.
- Pré-visualização das primeiras 10 linhas + contagem total + avisos de linhas inválidas.
- Botão **Importar** → insere em `transacoes_extrato` (batch insert via server function).
- Histórico recente de importações (últimas 10).

## 3. Stack técnica
- TanStack Start + TanStack Query.
- Server functions (`createServerFn` + `requireSupabaseAuth`) para todas as queries (CRUD orçamentos, criar nova versão, insert extratos, agregações do dashboard).
- shadcn/ui (Table, Input, Select, Button, Card, Tabs, Dialog, Sonner para toasts).
- Recharts para gráficos.
- PapaParse para CSV.
- Zod para validação de inputs (server fns e formulários).
- Formatação PT-PT: `Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' })`, datas `dd/MM/yyyy`.

## 4. Ordem de implementação
1. Ativar Lovable Cloud + auth email/password + página `/auth`.
2. Migration: tabelas, GRANTs, RLS, índices.
3. Layout autenticado + sidebar.
4. Server functions de orçamento + página `/orcamento` (editar, criar versão, histórico).
5. Server function de import + página `/importar-extratos` (parser, preview, insert).
6. Server function de agregação + dashboard com KPIs e gráficos.
7. QA visual no preview para os três ecrãs.

## Fora de âmbito (a confirmar mais tarde se necessário)
- Multi-tenant / dados por utilizador (atualmente partilhados).
- Mapeamento conta→projeto (Realizado é global por mês, não dividido por projeto).
- Exportação para Excel/PDF.
