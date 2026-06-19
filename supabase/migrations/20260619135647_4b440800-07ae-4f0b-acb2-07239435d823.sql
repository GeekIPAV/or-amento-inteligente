
CREATE TABLE IF NOT EXISTS public.centros_custo_meta (
  centro_custo text PRIMARY KEY,
  nome_display text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.centros_custo_meta TO authenticated;
GRANT ALL ON public.centros_custo_meta TO service_role;

ALTER TABLE public.centros_custo_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "centros_custo_meta_select" ON public.centros_custo_meta FOR SELECT TO authenticated USING (true);
CREATE POLICY "centros_custo_meta_insert" ON public.centros_custo_meta FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "centros_custo_meta_update" ON public.centros_custo_meta FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "centros_custo_meta_delete" ON public.centros_custo_meta FOR DELETE TO authenticated USING (true);

CREATE TRIGGER centros_custo_meta_updated_at
  BEFORE UPDATE ON public.centros_custo_meta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- centros_custo_disponiveis: agora inclui nome_display
DROP FUNCTION IF EXISTS public.centros_custo_disponiveis();
CREATE OR REPLACE FUNCTION public.centros_custo_disponiveis()
RETURNS TABLE(centro_custo text, nome_display text, projetos text[], linhas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(trim(t.centro_custo), ''), '(Sem CC)') AS centro_custo,
      count(*)::bigint AS linhas
    FROM public.transacoes_extrato t
    GROUP BY 1
  )
  SELECT
    b.centro_custo,
    COALESCE(m.nome_display, b.centro_custo) AS nome_display,
    COALESCE(array_agg(ccp.nome_projeto ORDER BY ccp.nome_projeto) FILTER (WHERE ccp.nome_projeto IS NOT NULL), ARRAY[]::text[]) AS projetos,
    b.linhas
  FROM base b
  LEFT JOIN public.centros_custo_meta m ON m.centro_custo = b.centro_custo
  LEFT JOIN public.centro_custo_projetos ccp ON ccp.centro_custo = b.centro_custo
  GROUP BY b.centro_custo, m.nome_display, b.linhas
  ORDER BY b.centro_custo;
$$;

-- Salva nome_display + sincroniza projetos atribuídos a um CC
CREATE OR REPLACE FUNCTION public.guardar_centro_custo(
  p_centro_custo text,
  p_nome_display text,
  p_projetos text[]
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF p_nome_display IS NOT NULL AND trim(p_nome_display) <> '' THEN
    INSERT INTO public.centros_custo_meta (centro_custo, nome_display)
    VALUES (p_centro_custo, trim(p_nome_display))
    ON CONFLICT (centro_custo) DO UPDATE SET nome_display = EXCLUDED.nome_display, updated_at = now();
  ELSE
    DELETE FROM public.centros_custo_meta WHERE centro_custo = p_centro_custo;
  END IF;

  DELETE FROM public.centro_custo_projetos
  WHERE centro_custo = p_centro_custo
    AND NOT (nome_projeto = ANY(COALESCE(p_projetos, ARRAY[]::text[])));

  IF p_projetos IS NOT NULL AND array_length(p_projetos, 1) > 0 THEN
    INSERT INTO public.centro_custo_projetos (centro_custo, nome_projeto)
    SELECT p_centro_custo, unnest(p_projetos)
    ON CONFLICT (centro_custo, nome_projeto) DO NOTHING;
  END IF;
END;
$$;

-- resumo_transacoes_projeto: agrupa por nome_display
CREATE OR REPLACE FUNCTION public.resumo_transacoes_projeto(p_ano integer, p_mes integer)
RETURNS TABLE(projeto text, nome_projeto text, receita numeric, despesa numeric, linhas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    COALESCE(m.nome_display, NULLIF(trim(t.centro_custo), ''), '(Sem projeto)') AS projeto,
    COALESCE(m.nome_display, NULLIF(trim(t.centro_custo), ''), '(Sem projeto)') AS nome_projeto,
    COALESCE(sum(CASE WHEN t.conta ~ '^7' THEN t.credito - t.debito ELSE 0 END), 0)::numeric AS receita,
    COALESCE(sum(CASE WHEN t.conta ~ '^6' THEN t.debito - t.credito ELSE 0 END), 0)::numeric AS despesa,
    count(*)::bigint AS linhas
  FROM public.transacoes_extrato t
  LEFT JOIN public.centros_custo_meta m
    ON m.centro_custo = COALESCE(NULLIF(trim(t.centro_custo), ''), '(Sem CC)')
  WHERE t.mes_referencia ~ '^[0-9]{4}-[0-9]{2}$'
    AND substring(t.mes_referencia from 1 for 4)::integer = p_ano
    AND substring(t.mes_referencia from 6 for 2)::integer BETWEEN 1 AND p_mes
    AND t.conta ~ '^[67]'
  GROUP BY 1
  ORDER BY 1;
$$;
