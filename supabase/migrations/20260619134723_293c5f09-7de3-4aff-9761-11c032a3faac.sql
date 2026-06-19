
-- Funções para mapear projetos (orçamento) -> centros de custo (movimentos)
CREATE OR REPLACE FUNCTION public.projetos_disponiveis()
RETURNS TABLE(projeto text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT DISTINCT trim(projeto) AS projeto
  FROM public.orcamentos
  WHERE projeto IS NOT NULL AND trim(projeto) <> ''
  ORDER BY 1;
$$;

CREATE OR REPLACE FUNCTION public.centros_custo_disponiveis()
RETURNS TABLE(centro_custo text, projeto text, linhas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(trim(t.centro_custo), ''), '(Sem CC)') AS centro_custo,
      count(*)::bigint AS linhas
    FROM public.transacoes_extrato t
    GROUP BY 1
  )
  SELECT b.centro_custo, ccp.nome_projeto AS projeto, b.linhas
  FROM base b
  LEFT JOIN public.centro_custo_projetos ccp ON ccp.centro_custo = b.centro_custo
  ORDER BY b.centro_custo;
$$;

CREATE OR REPLACE FUNCTION public.projetos_listagem()
RETURNS TABLE(projeto text, centros_custo text[], num_centros bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH p AS (
    SELECT DISTINCT trim(projeto) AS projeto
    FROM public.orcamentos
    WHERE projeto IS NOT NULL AND trim(projeto) <> ''
  )
  SELECT
    p.projeto,
    COALESCE(array_agg(ccp.centro_custo ORDER BY ccp.centro_custo) FILTER (WHERE ccp.centro_custo IS NOT NULL), ARRAY[]::text[]) AS centros_custo,
    COUNT(ccp.centro_custo)::bigint AS num_centros
  FROM p
  LEFT JOIN public.centro_custo_projetos ccp ON ccp.nome_projeto = p.projeto
  GROUP BY p.projeto
  ORDER BY p.projeto;
$$;

CREATE OR REPLACE FUNCTION public.atribuir_centros_custo_projeto(p_projeto text, p_centros text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  DELETE FROM public.centro_custo_projetos
  WHERE nome_projeto = p_projeto
    AND NOT (centro_custo = ANY(COALESCE(p_centros, ARRAY[]::text[])));

  IF p_centros IS NOT NULL AND array_length(p_centros, 1) > 0 THEN
    INSERT INTO public.centro_custo_projetos (centro_custo, nome_projeto)
    SELECT unnest(p_centros), p_projeto
    ON CONFLICT (centro_custo) DO UPDATE SET nome_projeto = EXCLUDED.nome_projeto, updated_at = now();
  END IF;
END;
$$;

-- Atualiza resumo_transacoes_projeto para usar o mapeamento (já usa LEFT JOIN, mas garantir agrupamento pelo nome_projeto do mapping)
CREATE OR REPLACE FUNCTION public.resumo_transacoes_projeto(p_ano integer, p_mes integer)
RETURNS TABLE(projeto text, nome_projeto text, receita numeric, despesa numeric, linhas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT
    COALESCE(ccp.nome_projeto, '(Sem projeto)') AS projeto,
    COALESCE(ccp.nome_projeto, '(Sem projeto)') AS nome_projeto,
    COALESCE(sum(CASE WHEN t.conta ~ '^7' THEN t.credito - t.debito ELSE 0 END), 0)::numeric AS receita,
    COALESCE(sum(CASE WHEN t.conta ~ '^6' THEN t.debito - t.credito ELSE 0 END), 0)::numeric AS despesa,
    count(*)::bigint AS linhas
  FROM public.transacoes_extrato t
  LEFT JOIN public.centro_custo_projetos ccp
    ON ccp.centro_custo = COALESCE(NULLIF(trim(t.centro_custo), ''), '(Sem CC)')
  WHERE t.mes_referencia ~ '^[0-9]{4}-[0-9]{2}$'
    AND substring(t.mes_referencia from 1 for 4)::integer = p_ano
    AND substring(t.mes_referencia from 6 for 2)::integer BETWEEN 1 AND p_mes
    AND t.conta ~ '^[67]'
  GROUP BY 1
  ORDER BY 1;
$$;
