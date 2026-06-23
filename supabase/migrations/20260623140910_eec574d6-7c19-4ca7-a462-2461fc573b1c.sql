
-- ============= FINANCIADORES =============
CREATE TABLE public.financiadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'Público',
  contacto_nome text,
  contacto_email text,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financiadores TO authenticated;
GRANT ALL ON public.financiadores TO service_role;
ALTER TABLE public.financiadores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read financiadores" ON public.financiadores FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert financiadores" ON public.financiadores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update financiadores" ON public.financiadores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete financiadores" ON public.financiadores FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_financiadores_updated BEFORE UPDATE ON public.financiadores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= FINANCIAMENTOS =============
CREATE TABLE public.financiamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  financiador_id uuid NOT NULL REFERENCES public.financiadores(id) ON DELETE CASCADE,
  projeto text,
  descricao text NOT NULL,
  ano integer NOT NULL,
  valor_aprovado numeric NOT NULL DEFAULT 0,
  valor_recebido numeric NOT NULL DEFAULT 0,
  data_aprovacao date,
  data_prevista_pagamento date,
  data_pagamento_real date,
  estado text NOT NULL DEFAULT 'Aprovado',
  percentagem_projeto numeric,
  notas text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financiamentos TO authenticated;
GRANT ALL ON public.financiamentos TO service_role;
ALTER TABLE public.financiamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read financiamentos" ON public.financiamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert financiamentos" ON public.financiamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update financiamentos" ON public.financiamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete financiamentos" ON public.financiamentos FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_financiamentos_updated BEFORE UPDATE ON public.financiamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_financiamentos_financiador ON public.financiamentos(financiador_id);
CREATE INDEX idx_financiamentos_ano ON public.financiamentos(ano);

-- ============= PREVISOES TESOURARIA =============
CREATE TABLE public.previsoes_tesouraria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL,
  descricao text NOT NULL,
  tipo text NOT NULL,
  categoria text,
  valor numeric NOT NULL,
  projeto text,
  estado text NOT NULL DEFAULT 'Previsto',
  recorrente boolean NOT NULL DEFAULT false,
  recorrencia_meses integer,
  notas text,
  financiamento_id uuid REFERENCES public.financiamentos(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.previsoes_tesouraria TO authenticated;
GRANT ALL ON public.previsoes_tesouraria TO service_role;
ALTER TABLE public.previsoes_tesouraria ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read previsoes" ON public.previsoes_tesouraria FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert previsoes" ON public.previsoes_tesouraria FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update previsoes" ON public.previsoes_tesouraria FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete previsoes" ON public.previsoes_tesouraria FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_previsoes_updated BEFORE UPDATE ON public.previsoes_tesouraria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_previsoes_data ON public.previsoes_tesouraria(data);

-- ============= RELATORIO NOTAS =============
CREATE TABLE public.relatorio_notas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ano integer NOT NULL,
  projeto text NOT NULL DEFAULT '__all__',
  rubrica text NOT NULL DEFAULT '__geral__',
  nota text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ano, projeto, rubrica)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorio_notas TO authenticated;
GRANT ALL ON public.relatorio_notas TO service_role;
ALTER TABLE public.relatorio_notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read notas" ON public.relatorio_notas FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert notas" ON public.relatorio_notas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update notas" ON public.relatorio_notas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete notas" ON public.relatorio_notas FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_notas_updated BEFORE UPDATE ON public.relatorio_notas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============= ALERTAS =============
CREATE TABLE public.alertas_financeiros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  severidade text NOT NULL DEFAULT 'aviso',
  link_rota text,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  lido boolean NOT NULL DEFAULT false,
  resolvido boolean NOT NULL DEFAULT false,
  chave text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.alertas_financeiros TO authenticated;
GRANT ALL ON public.alertas_financeiros TO service_role;
ALTER TABLE public.alertas_financeiros ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read alertas" ON public.alertas_financeiros FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert alertas" ON public.alertas_financeiros FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "auth update alertas" ON public.alertas_financeiros FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth delete alertas" ON public.alertas_financeiros FOR DELETE TO authenticated USING (true);
CREATE TRIGGER trg_alertas_updated BEFORE UPDATE ON public.alertas_financeiros
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE UNIQUE INDEX idx_alertas_unique_active ON public.alertas_financeiros(tipo, chave) WHERE resolvido = false AND chave IS NOT NULL;
CREATE INDEX idx_alertas_resolvido ON public.alertas_financeiros(resolvido, severidade);
