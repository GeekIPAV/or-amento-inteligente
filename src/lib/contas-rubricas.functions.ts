import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listarContas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("contas_listagem");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      conta: string;
      descricao_conta: string | null;
      rubrica: string | null;
      linhas: number;
    }>;
  });

export const listarRubricasDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("rubricas_disponiveis");
    if (error) throw new Error(error.message);
    return ((data ?? []) as Array<{ rubrica: string }>).map((r) => r.rubrica);
  });

export const listarRubricas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("rubricas_listagem");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      rubrica: string;
      contas: string[];
      num_contas: number;
    }>;
  });

export const listarContasDisponiveis = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("contas_disponiveis");
    if (error) throw new Error(error.message);
    return (data ?? []) as Array<{
      conta: string;
      descricao_conta: string | null;
      rubrica: string | null;
    }>;
  });

export const guardarRubricaConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { conta: string; rubrica: string }) =>
    z
      .object({
        conta: z.string().min(1),
        rubrica: z.string().trim().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("conta_rubricas")
      .upsert(
        { conta: data.conta, rubrica: data.rubrica },
        { onConflict: "conta" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const atribuirContasARubrica = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rubrica: string; contas: string[] }) =>
    z
      .object({
        rubrica: z.string().trim().min(1).max(200),
        contas: z.array(z.string().min(1)),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.rpc("atribuir_contas_rubrica", {
      p_rubrica: data.rubrica,
      p_contas: data.contas,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
