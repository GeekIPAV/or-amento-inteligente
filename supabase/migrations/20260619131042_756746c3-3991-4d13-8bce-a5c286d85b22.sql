
CREATE TABLE public.conta_rubricas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta text NOT NULL UNIQUE,
  rubrica text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conta_rubricas TO authenticated;
GRANT ALL ON public.conta_rubricas TO service_role;

ALTER TABLE public.conta_rubricas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view conta_rubricas" ON public.conta_rubricas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert conta_rubricas" ON public.conta_rubricas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update conta_rubricas" ON public.conta_rubricas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete conta_rubricas" ON public.conta_rubricas FOR DELETE TO authenticated USING (true);

CREATE TRIGGER trg_conta_rubricas_updated_at
  BEFORE UPDATE ON public.conta_rubricas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.contas_listagem()
RETURNS TABLE(conta text, descricao_conta text, rubrica text, linhas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(trim(t.conta), ''), '(Sem conta)') AS conta,
      t.descricao_conta,
      count(*) OVER (PARTITION BY COALESCE(NULLIF(trim(t.conta), ''), '(Sem conta)')) AS linhas,
      row_number() OVER (
        PARTITION BY COALESCE(NULLIF(trim(t.conta), ''), '(Sem conta)')
        ORDER BY t.descricao_conta NULLS LAST
      ) AS rn
    FROM public.transacoes_extrato t
  )
  SELECT
    b.conta,
    b.descricao_conta,
    cr.rubrica,
    b.linhas
  FROM base b
  LEFT JOIN public.conta_rubricas cr ON cr.conta = b.conta
  WHERE b.rn = 1
  ORDER BY b.conta;
$$;

CREATE OR REPLACE FUNCTION public.rubricas_disponiveis()
RETURNS TABLE(rubrica text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT trim(rubrica) AS rubrica
  FROM public.orcamentos
  WHERE rubrica IS NOT NULL AND trim(rubrica) <> ''
  ORDER BY 1;
$$;
