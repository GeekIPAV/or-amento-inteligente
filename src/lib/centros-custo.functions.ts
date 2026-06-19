import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listarProjetos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("projetos_listagem");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      projeto: string;
      centros_custo: string[];
      num_centros: number;
    }>;
  });

export const listarCentrosCustoDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc(
      "centros_custo_disponiveis",
    );
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      centro_custo: string;
      projeto: string | null;
      linhas: number;
    }>;
  });

export const atribuirCentrosCustoAProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projeto: string; centros_custo: string[] }) =>
    z
      .object({
        projeto: z.string().trim().min(1).max(200),
        centros_custo: z.array(z.string().min(1)),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc(
      "atribuir_centros_custo_projeto",
      {
        p_projeto: data.projeto,
        p_centros: data.centros_custo,
      },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
