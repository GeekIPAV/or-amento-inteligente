import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listarCentrosCusto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("centros_custo_listagem");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{ centro_custo: string; nome_projeto: string; linhas: number }>;
  });

export const guardarNomeProjeto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { centro_custo: string; nome_projeto: string }) =>
    z.object({
      centro_custo: z.string().min(1),
      nome_projeto: z.string().trim().min(1).max(200),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("centro_custo_projetos")
      .upsert(
        { centro_custo: data.centro_custo, nome_projeto: data.nome_projeto },
        { onConflict: "centro_custo" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
