
-- Restart the orcamentos table in long format (one row per month value)
DROP TABLE IF EXISTS public.orcamentos CASCADE;

CREATE TABLE public.orcamentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  projeto text NOT NULL,
  descricao text,
  rubrica text,
  tipo tipo_orcamento NOT NULL,
  ano integer NOT NULL,
  mes integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  valor numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos TO authenticated;
GRANT ALL ON public.orcamentos TO service_role;

ALTER TABLE public.orcamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view orcamentos" ON public.orcamentos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert orcamentos" ON public.orcamentos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update orcamentos" ON public.orcamentos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete orcamentos" ON public.orcamentos FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_orcamentos_updated_at
  BEFORE UPDATE ON public.orcamentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_orcamentos_ano ON public.orcamentos(ano);
CREATE INDEX idx_orcamentos_projeto ON public.orcamentos(projeto);
