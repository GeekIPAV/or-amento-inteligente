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
    COALESCE(sum(credito), 0)::numeric AS receita,
    COALESCE(sum(debito), 0)::numeric AS despesa,
    count(*)::bigint AS linhas
  FROM public.transacoes_extrato
  WHERE mes_referencia ~ '^\d{4}-\d{2}$'
    AND substring(mes_referencia from 1 for 4)::integer = p_ano
    AND substring(mes_referencia from 6 for 2)::integer BETWEEN 1 AND 12
  GROUP BY 1
  ORDER BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.resumo_transacoes_mensal(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resumo_transacoes_mensal(integer) TO service_role;

CREATE OR REPLACE FUNCTION public.anos_transacoes_disponiveis()
RETURNS TABLE (ano integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT substring(mes_referencia from 1 for 4)::integer AS ano
  FROM public.transacoes_extrato
  WHERE mes_referencia ~ '^\d{4}-\d{2}$'
  ORDER BY 1 DESC;
$$;

GRANT EXECUTE ON FUNCTION public.anos_transacoes_disponiveis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.anos_transacoes_disponiveis() TO service_role;