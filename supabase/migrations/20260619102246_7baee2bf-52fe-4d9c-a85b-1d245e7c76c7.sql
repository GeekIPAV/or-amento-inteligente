
-- 1. Versions table
CREATE TABLE public.orcamento_versoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  ativa boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamento_versoes TO authenticated;
GRANT ALL ON public.orcamento_versoes TO service_role;

ALTER TABLE public.orcamento_versoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view versoes" ON public.orcamento_versoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert versoes" ON public.orcamento_versoes
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update versoes" ON public.orcamento_versoes
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete versoes" ON public.orcamento_versoes
  FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_orcamento_versoes_updated_at
  BEFORE UPDATE ON public.orcamento_versoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Only one active version at a time
CREATE UNIQUE INDEX uniq_orcamento_versao_ativa
  ON public.orcamento_versoes ((ativa)) WHERE ativa = true;

-- 2. Add versao_id to orcamentos
ALTER TABLE public.orcamentos
  ADD COLUMN versao_id uuid REFERENCES public.orcamento_versoes(id) ON DELETE CASCADE;

-- 3. Backfill: create "Original" version if there are existing rows
DO $$
DECLARE v_id uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.orcamentos) THEN
    INSERT INTO public.orcamento_versoes (nome, ativa)
    VALUES ('Original', true)
    RETURNING id INTO v_id;
    UPDATE public.orcamentos SET versao_id = v_id WHERE versao_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.orcamentos
  ALTER COLUMN versao_id SET NOT NULL;

CREATE INDEX idx_orcamentos_versao ON public.orcamentos(versao_id);
