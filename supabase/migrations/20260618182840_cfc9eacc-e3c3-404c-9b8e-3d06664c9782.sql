CREATE OR REPLACE FUNCTION public.resumo_transacoes_mensal(p_ano integer)
RETURNS TABLE (
  mes integer,
  receita numeric,
  despesa numeric,
  linhas bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    substring(mes_referencia from 6 for 2)::integer AS mes,
    COALESCE(
      sum(
        CASE
          WHEN conta ~ '^7' THEN credito - debito
          ELSE 0
        END
      ),
      0
    )::numeric AS receita,
    COALESCE(
      sum(
        CASE
          WHEN conta ~ '^6' THEN debito - credito
          ELSE 0
        END
      ),
      0
    )::numeric AS despesa,
    count(*) FILTER (WHERE conta ~ '^[67]')::bigint AS linhas
  FROM public.transacoes_extrato
  WHERE mes_referencia ~ '^\d{4}-\d{2}$'
    AND substring(mes_referencia from 1 for 4)::integer = p_ano
    AND substring(mes_referencia from 6 for 2)::integer BETWEEN 1 AND 12
    AND conta ~ '^[67]'
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.resumo_transacoes_mensal(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resumo_transacoes_mensal(integer) TO service_role;