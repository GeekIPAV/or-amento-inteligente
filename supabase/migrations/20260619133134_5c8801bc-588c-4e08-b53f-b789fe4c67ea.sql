
CREATE OR REPLACE FUNCTION public.resumo_transacoes_rubrica(p_ano integer, p_mes integer)
RETURNS TABLE(rubrica text, receita numeric, despesa numeric, linhas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    cr.rubrica,
    COALESCE(sum(CASE WHEN t.conta ~ '^7' THEN t.credito - t.debito ELSE 0 END), 0)::numeric AS receita,
    COALESCE(sum(CASE WHEN t.conta ~ '^6' THEN t.debito - t.credito ELSE 0 END), 0)::numeric AS despesa,
    count(*)::bigint AS linhas
  FROM public.transacoes_extrato t
  JOIN public.conta_rubricas cr
    ON cr.conta = COALESCE(NULLIF(trim(t.conta), ''), '(Sem conta)')
  WHERE t.mes_referencia ~ '^[0-9]{4}-[0-9]{2}$'
    AND substring(t.mes_referencia from 1 for 4)::integer = p_ano
    AND substring(t.mes_referencia from 6 for 2)::integer BETWEEN 1 AND p_mes
    AND t.conta ~ '^[67]'
  GROUP BY 1
  ORDER BY 1;
$$;
