
ALTER TABLE public.orcamento_versoes ADD COLUMN IF NOT EXISTS ano integer;
UPDATE public.orcamento_versoes v SET ano = COALESCE((SELECT min(ano) FROM public.orcamentos WHERE versao_id = v.id), EXTRACT(YEAR FROM now())::int) WHERE ano IS NULL;
ALTER TABLE public.orcamento_versoes ALTER COLUMN ano SET NOT NULL;
DROP INDEX IF EXISTS public.uniq_orcamento_versao_ativa;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_orcamento_versao_ativa_ano ON public.orcamento_versoes (ano) WHERE ativa = true;
