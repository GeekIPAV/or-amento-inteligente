
CREATE TABLE public.centro_custo_projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  centro_custo text NOT NULL UNIQUE,
  nome_projeto text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.centro_custo_projetos TO authenticated;
GRANT ALL ON public.centro_custo_projetos TO service_role;
ALTER TABLE public.centro_custo_projetos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view ccp" ON public.centro_custo_projetos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert ccp" ON public.centro_custo_projetos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update ccp" ON public.centro_custo_projetos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete ccp" ON public.centro_custo_projetos FOR DELETE TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_ccp_updated_at BEFORE UPDATE ON public.centro_custo_projetos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.centros_custo_listagem()
RETURNS TABLE(centro_custo text, nome_projeto text, linhas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(NULLIF(trim(t.centro_custo), ''), '(Sem projeto)') AS centro_custo,
    COALESCE(p.nome_projeto, COALESCE(NULLIF(trim(t.centro_custo), ''), '(Sem projeto)')) AS nome_projeto,
    count(*)::bigint AS linhas
  FROM public.transacoes_extrato t
  LEFT JOIN public.centro_custo_projetos p
    ON p.centro_custo = COALESCE(NULLIF(trim(t.centro_custo), ''), '(Sem projeto)')
  GROUP BY 1, p.nome_projeto
  ORDER BY 1;
$$;

-- Atualiza resumo_transacoes_projeto para devolver nome_projeto também
DROP FUNCTION IF EXISTS public.resumo_transacoes_projeto(integer, integer);
CREATE OR REPLACE FUNCTION public.resumo_transacoes_projeto(p_ano integer, p_mes integer)
RETURNS TABLE(projeto text, nome_projeto text, receita numeric, despesa numeric, linhas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(NULLIF(trim(t.centro_custo), ''), '(Sem projeto)') AS projeto,
    COALESCE(p.nome_projeto, COALESCE(NULLIF(trim(t.centro_custo), ''), '(Sem projeto)')) AS nome_projeto,
    COALESCE(sum(CASE WHEN t.conta ~ '^7' THEN t.credito - t.debito ELSE 0 END), 0)::numeric AS receita,
    COALESCE(sum(CASE WHEN t.conta ~ '^6' THEN t.debito - t.credito ELSE 0 END), 0)::numeric AS despesa,
    count(*)::bigint AS linhas
  FROM public.transacoes_extrato t
  LEFT JOIN public.centro_custo_projetos p
    ON p.centro_custo = COALESCE(NULLIF(trim(t.centro_custo), ''), '(Sem projeto)')
  WHERE t.mes_referencia ~ '^[0-9]{4}-[0-9]{2}$'
    AND substring(t.mes_referencia from 1 for 4)::integer = p_ano
    AND substring(t.mes_referencia from 6 for 2)::integer BETWEEN 1 AND p_mes
    AND t.conta ~ '^[67]'
  GROUP BY 1, p.nome_projeto
  ORDER BY 1;
$$;
