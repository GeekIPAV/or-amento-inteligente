import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listarProjetos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("projetos_disponiveis");
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<{ projeto: string }>).map((r) => r.projeto);
  });

export const listarCentrosCustoDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc(
      "centros_custo_disponiveis",
    );
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as Array<{
      centro_custo: string;
      nome_display: string;
      projetos: string[];
      linhas: number;
    }>;
  });

export const guardarCentroCusto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { centro_custo: string; nome_display: string; projetos: string[] }) =>
      z
        .object({
          centro_custo: z.string().min(1),
          nome_display: z.string().trim().min(1).max(200),
          projetos: z.array(z.string().min(1)),
        })
        .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("guardar_centro_custo", {
      p_centro_custo: data.centro_custo,
      p_nome_display: data.nome_display,
      p_projetos: data.projetos,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
