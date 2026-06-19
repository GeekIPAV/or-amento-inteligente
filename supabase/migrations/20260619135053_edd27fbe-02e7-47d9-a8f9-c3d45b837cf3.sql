
ALTER TABLE public.centro_custo_projetos DROP CONSTRAINT IF EXISTS centro_custo_projetos_centro_custo_key;
ALTER TABLE public.centro_custo_projetos
  ADD CONSTRAINT centro_custo_projetos_cc_proj_key UNIQUE (centro_custo, nome_projeto);

-- centros_custo_disponiveis: devolve lista de projetos atribuídos (array) por CC
DROP FUNCTION IF EXISTS public.centros_custo_disponiveis();
CREATE OR REPLACE FUNCTION public.centros_custo_disponiveis()
RETURNS TABLE(centro_custo text, projetos text[], linhas bigint)
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
    COALESCE(array_agg(ccp.nome_projeto ORDER BY ccp.nome_projeto) FILTER (WHERE ccp.nome_projeto IS NOT NULL), ARRAY[]::text[]) AS projetos,
    b.linhas
  FROM base b
  LEFT JOIN public.centro_custo_projetos ccp ON ccp.centro_custo = b.centro_custo
  GROUP BY b.centro_custo, b.linhas
  ORDER BY b.centro_custo;
$$;

-- atribuir_centros_custo_projeto: agora faz INSERT ON CONFLICT DO NOTHING (sem mover de outros projetos)
CREATE OR REPLACE FUNCTION public.atribuir_centros_custo_projeto(p_projeto text, p_centros text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.centro_custo_projetos
  WHERE nome_projeto = p_projeto
    AND NOT (centro_custo = ANY(COALESCE(p_centros, ARRAY[]::text[])));

  IF p_centros IS NOT NULL AND array_length(p_centros, 1) > 0 THEN
    INSERT INTO public.centro_custo_projetos (centro_custo, nome_projeto)
    SELECT unnest(p_centros), p_projeto
    ON CONFLICT (centro_custo, nome_projeto) DO NOTHING;
  END IF;
END;
$$;
