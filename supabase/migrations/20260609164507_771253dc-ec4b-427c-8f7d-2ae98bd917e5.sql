
CREATE TYPE public.tipo_orcamento AS ENUM ('RECEITA', 'DESPESA');

CREATE TABLE public.orcamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto TEXT NOT NULL,
  ano INTEGER NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  tipo public.tipo_orcamento NOT NULL,
  m1 NUMERIC(14,2) NOT NULL DEFAULT 0,
  m2 NUMERIC(14,2) NOT NULL DEFAULT 0,
  m3 NUMERIC(14,2) NOT NULL DEFAULT 0,
  m4 NUMERIC(14,2) NOT NULL DEFAULT 0,
  m5 NUMERIC(14,2) NOT NULL DEFAULT 0,
  m6 NUMERIC(14,2) NOT NULL DEFAULT 0,
  m7 NUMERIC(14,2) NOT NULL DEFAULT 0,
  m8 NUMERIC(14,2) NOT NULL DEFAULT 0,
  m9 NUMERIC(14,2) NOT NULL DEFAULT 0,
  m10 NUMERIC(14,2) NOT NULL DEFAULT 0,
  m11 NUMERIC(14,2) NOT NULL DEFAULT 0,
  m12 NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_orcamentos_ano_tipo_ativo ON public.orcamentos (ano, tipo, ativo);
CREATE INDEX idx_orcamentos_projeto ON public.orcamentos (projeto);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos TO authenticated;
GRANT ALL ON public.orcamentos TO service_role;
ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view orcamentos" ON public.orcamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert orcamentos" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update orcamentos" ON public.orcamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete orcamentos" ON public.orcamentos FOR DELETE TO authenticated USING (true);

CREATE TABLE public.transacoes_extrato (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conta TEXT,
  descricao_conta TEXT,
  data DATE,
  num_documento TEXT,
  diario TEXT,
  movimento TEXT,
  centro_custo TEXT,
  debito NUMERIC(14,2) NOT NULL DEFAULT 0,
  credito NUMERIC(14,2) NOT NULL DEFAULT 0,
  mes_referencia TEXT NOT NULL,
  importado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  importado_por UUID
);

CREATE INDEX idx_transacoes_mes ON public.transacoes_extrato (mes_referencia);
CREATE INDEX idx_transacoes_data ON public.transacoes_extrato (data);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transacoes_extrato TO authenticated;
GRANT ALL ON public.transacoes_extrato TO service_role;
ALTER TABLE public.transacoes_extrato ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view transacoes" ON public.transacoes_extrato FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert transacoes" ON public.transacoes_extrato FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update transacoes" ON public.transacoes_extrato FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete transacoes" ON public.transacoes_extrato FOR DELETE TO authenticated USING (true);
