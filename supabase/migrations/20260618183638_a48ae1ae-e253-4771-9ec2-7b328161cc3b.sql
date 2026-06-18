CREATE OR REPLACE FUNCTION public.resumo_transacoes_projeto(p_ano integer, p_mes integer)
RETURNS TABLE(projeto text, receita numeric, despesa numeric, linhas bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(NULLIF(trim(centro_custo), ''), '(Sem projeto)') AS projeto,
    COALESCE(sum(CASE WHEN conta ~ '^7' THEN credito - debito ELSE 0 END), 0)::numeric AS receita,
    COALESCE(sum(CASE WHEN conta ~ '^6' THEN debito - credito ELSE 0 END), 0)::numeric AS despesa,
    count(*)::bigint AS linhas
  FROM public.transacoes_extrato
  WHERE mes_referencia ~ '^[0-9]{4}-[0-9]{2}$'
    AND substring(mes_referencia from 1 for 4)::integer = p_ano
    AND substring(mes_referencia from 6 for 2)::integer BETWEEN 1 AND p_mes
    AND conta ~ '^[67]'
  GROUP BY 1
  ORDER BY 1;
$$;

REVOKE ALL ON FUNCTION public.resumo_transacoes_projeto(integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resumo_transacoes_projeto(integer, integer) TO authenticated;