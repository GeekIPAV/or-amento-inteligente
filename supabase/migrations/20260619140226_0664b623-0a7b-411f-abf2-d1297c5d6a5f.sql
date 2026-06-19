
-- Remove duplicados (mantém o mais antigo por nome_projeto)
DELETE FROM public.centro_custo_projetos a
USING public.centro_custo_projetos b
WHERE a.nome_projeto = b.nome_projeto
  AND a.created_at > b.created_at;

ALTER TABLE public.centro_custo_projetos
  DROP CONSTRAINT IF EXISTS centro_custo_projetos_cc_proj_key;

ALTER TABLE public.centro_custo_projetos
  ADD CONSTRAINT centro_custo_projetos_nome_projeto_key UNIQUE (nome_projeto);

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
    ON CONFLICT (nome_projeto) DO UPDATE SET centro_custo = EXCLUDED.centro_custo, updated_at = now();
  END IF;
END;
$$;
