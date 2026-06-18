ALTER TABLE public.orcamentos
  ADD COLUMN IF NOT EXISTS conta text,
  ADD COLUMN IF NOT EXISTS descricao_conta text;

CREATE INDEX IF NOT EXISTS orcamentos_ano_tipo_versao_idx
  ON public.orcamentos (ano, tipo, versao, ativo);