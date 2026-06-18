REVOKE EXECUTE ON FUNCTION public.resumo_transacoes_mensal(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resumo_transacoes_mensal(integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.resumo_transacoes_mensal(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resumo_transacoes_mensal(integer) TO service_role;