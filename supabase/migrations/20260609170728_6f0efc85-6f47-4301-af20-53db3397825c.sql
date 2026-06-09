REVOKE EXECUTE ON FUNCTION public.resumo_transacoes_mensal(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resumo_transacoes_mensal(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.resumo_transacoes_mensal(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resumo_transacoes_mensal(integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.anos_transacoes_disponiveis() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.anos_transacoes_disponiveis() FROM anon;
GRANT EXECUTE ON FUNCTION public.anos_transacoes_disponiveis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.anos_transacoes_disponiveis() TO service_role;