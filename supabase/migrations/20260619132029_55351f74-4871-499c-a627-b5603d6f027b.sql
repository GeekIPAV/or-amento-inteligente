CREATE OR REPLACE FUNCTION public.rubricas_listagem()
RETURNS TABLE(rubrica text, contas text[], num_contas bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH rubs AS (
    SELECT DISTINCT trim(rubrica) AS rubrica
    FROM public.orcamentos
    WHERE rubrica IS NOT NULL AND trim(rubrica) <> ''
  )
  SELECT
    r.rubrica,
    COALESCE(array_agg(cr.conta ORDER BY cr.conta) FILTER (WHERE cr.conta IS NOT NULL), ARRAY[]::text[]) AS contas,
    COUNT(cr.conta)::bigint AS num_contas
  FROM rubs r
  LEFT JOIN public.conta_rubricas cr ON cr.rubrica = r.rubrica
  GROUP BY r.rubrica
  ORDER BY r.rubrica;
$$;

CREATE OR REPLACE FUNCTION public.contas_disponiveis()
RETURNS TABLE(conta text, descricao_conta text, rubrica text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH base AS (
    SELECT
      COALESCE(NULLIF(trim(t.conta), ''), '(Sem conta)') AS conta,
      t.descricao_conta,
      row_number() OVER (
        PARTITION BY COALESCE(NULLIF(trim(t.conta), ''), '(Sem conta)')
        ORDER BY t.descricao_conta NULLS LAST
      ) AS rn
    FROM public.transacoes_extrato t
  )
  SELECT b.conta, b.descricao_conta, cr.rubrica
  FROM base b
  LEFT JOIN public.conta_rubricas cr ON cr.conta = b.conta
  WHERE b.rn = 1
  ORDER BY b.conta;
$$;

CREATE OR REPLACE FUNCTION public.atribuir_contas_rubrica(p_rubrica text, p_contas text[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Remove contas that were previously on this rubrica but no longer selected
  DELETE FROM public.conta_rubricas
  WHERE rubrica = p_rubrica
    AND NOT (conta = ANY(COALESCE(p_contas, ARRAY[]::text[])));

  -- Upsert each selected conta to this rubrica (moves it from any other rubrica)
  IF p_contas IS NOT NULL AND array_length(p_contas, 1) > 0 THEN
    INSERT INTO public.conta_rubricas (conta, rubrica)
    SELECT unnest(p_contas), p_rubrica
    ON CONFLICT (conta) DO UPDATE SET rubrica = EXCLUDED.rubrica, updated_at = now();
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rubricas_listagem() TO authenticated;
GRANT EXECUTE ON FUNCTION public.contas_disponiveis() TO authenticated;
GRANT EXECUTE ON FUNCTION public.atribuir_contas_rubrica(text, text[]) TO authenticated;