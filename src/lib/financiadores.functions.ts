import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Financiador = {
  id: string;
  nome: string;
  tipo: string;
  contacto_nome: string | null;
  contacto_email: string | null;
  notas: string | null;
};

export type Financiamento = {
  id: string;
  financiador_id: string;
  financiador_nome: string;
  financiador_tipo: string;
  projeto: string | null;
  descricao: string;
  ano: number;
  valor_aprovado: number;
  valor_recebido: number;
  por_receber: number;
  data_aprovacao: string | null;
  data_prevista_pagamento: string | null;
  data_pagamento_real: string | null;
  estado: string;
  percentagem_projeto: number | null;
  notas: string | null;
};

export const listarFinanciadores = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("financiadores")
      .select("id, nome, tipo, contacto_nome, contacto_email, notas")
      .order("nome");
    if (error) throw new Error(error.message);
    return (data ?? []) as Financiador[];
  });

export const guardarFinanciador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        nome: z.string().trim().min(1).max(200),
        tipo: z.enum(["Público", "Privado", "UE", "Outro"]),
        contacto_nome: z.string().trim().max(200).nullable().optional(),
        contacto_email: z.string().trim().max(200).nullable().optional(),
        notas: z.string().trim().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      nome: data.nome,
      tipo: data.tipo,
      contacto_nome: data.contacto_nome ?? null,
      contacto_email: data.contacto_email ?? null,
      notas: data.notas ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("financiadores")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("financiadores")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const apagarFinanciador = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("financiadores")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listarFinanciamentos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({ financiadorId: z.string().uuid().nullable().optional() })
      .optional()
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("financiamentos")
      .select(
        "id, financiador_id, projeto, descricao, ano, valor_aprovado, valor_recebido, data_aprovacao, data_prevista_pagamento, data_pagamento_real, estado, percentagem_projeto, notas, financiadores(nome, tipo)",
      )
      .order("data_prevista_pagamento", { ascending: true, nullsFirst: false });
    if (data?.financiadorId) q = q.eq("financiador_id", data.financiadorId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return ((rows ?? []) as any[]).map((r): Financiamento => {
      const ap = Number(r.valor_aprovado) || 0;
      const re = Number(r.valor_recebido) || 0;
      return {
        id: r.id,
        financiador_id: r.financiador_id,
        financiador_nome: r.financiadores?.nome ?? "—",
        financiador_tipo: r.financiadores?.tipo ?? "—",
        projeto: r.projeto,
        descricao: r.descricao,
        ano: r.ano,
        valor_aprovado: ap,
        valor_recebido: re,
        por_receber: ap - re,
        data_aprovacao: r.data_aprovacao,
        data_prevista_pagamento: r.data_prevista_pagamento,
        data_pagamento_real: r.data_pagamento_real,
        estado: r.estado,
        percentagem_projeto: r.percentagem_projeto != null ? Number(r.percentagem_projeto) : null,
        notas: r.notas,
      };
    });
  });

export const guardarFinanciamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        financiador_id: z.string().uuid(),
        projeto: z.string().trim().max(200).nullable().optional(),
        descricao: z.string().trim().min(1).max(400),
        ano: z.number().int().min(2000).max(2100),
        valor_aprovado: z.number(),
        valor_recebido: z.number(),
        data_aprovacao: z.string().nullable().optional(),
        data_prevista_pagamento: z.string().nullable().optional(),
        data_pagamento_real: z.string().nullable().optional(),
        estado: z.enum([
          "Em candidatura",
          "Aprovado",
          "Parcialmente pago",
          "Pago",
          "Rejeitado",
          "Cancelado",
        ]),
        percentagem_projeto: z.number().nullable().optional(),
        notas: z.string().trim().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const payload = {
      financiador_id: data.financiador_id,
      projeto: data.projeto ?? null,
      descricao: data.descricao,
      ano: data.ano,
      valor_aprovado: data.valor_aprovado,
      valor_recebido: data.valor_recebido,
      data_aprovacao: data.data_aprovacao || null,
      data_prevista_pagamento: data.data_prevista_pagamento || null,
      data_pagamento_real: data.data_pagamento_real || null,
      estado: data.estado,
      percentagem_projeto: data.percentagem_projeto ?? null,
      notas: data.notas ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase
        .from("financiamentos")
        .update(payload)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("financiamentos")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const apagarFinanciamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("financiamentos")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
