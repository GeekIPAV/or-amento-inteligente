import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  convertToModelMessages,
  streamText,
  tool,
  stepCountIs,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) {
          return new Response("Unauthorized", { status: 401 });
        }
        const token = auth.slice(7);
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY!;
        const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
        if (!LOVABLE_API_KEY) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          global: { headers: { Authorization: `Bearer ${token}` } },
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: userData, error: userErr } = await supabase.auth.getUser(token);
        if (userErr || !userData.user) {
          return new Response("Unauthorized", { status: 401 });
        }
        const userId = userData.user.id;

        const body = (await request.json()) as {
          messages: UIMessage[];
          threadId: string;
        };
        if (!body.threadId) {
          return new Response("Missing threadId", { status: 400 });
        }

        // Verify thread ownership
        const { data: thread, error: thrErr } = await supabase
          .from("chat_threads")
          .select("id, title")
          .eq("id", body.threadId)
          .maybeSingle();
        if (thrErr || !thread) {
          return new Response("Thread not found", { status: 404 });
        }

        // Persist the latest user message (if not yet stored)
        const lastUser = [...body.messages].reverse().find((m) => m.role === "user");
        if (lastUser) {
          const { data: existing } = await supabase
            .from("chat_messages")
            .select("id")
            .eq("thread_id", body.threadId)
            .eq("message_id", lastUser.id)
            .maybeSingle();
          if (!existing) {
            await supabase.from("chat_messages").insert({
              thread_id: body.threadId,
              user_id: userId,
              role: "user",
              parts: lastUser.parts as any,
              message_id: lastUser.id,
            });
            // Auto-title with first user message
            if (thread.title === "Nova conversa") {
              const text = lastUser.parts
                .map((p: any) => (p.type === "text" ? p.text : ""))
                .join(" ")
                .trim()
                .slice(0, 80);
              if (text) {
                await supabase
                  .from("chat_threads")
                  .update({ title: text })
                  .eq("id", body.threadId);
              }
            }
          }
        }

        const gateway = createLovableAiGatewayProvider(LOVABLE_API_KEY);
        const model = gateway("google/gemini-3-flash-preview");

        const anoAtual = new Date().getFullYear();

        const result = streamText({
          model,
          system: `És um assistente financeiro do IPAV em português de Portugal.
Tens acesso a duas fontes de dados:
- Orçamento (tabela orcamentos): linhas por projeto/rubrica/tipo/ano/mês/valor.
- Movimentos contabilísticos (tabela transacoes_extrato): linhas com conta, débito, crédito, centro de custo, mes_referencia (YYYY-MM).
Convenções: receitas = contas que começam por 7 (crédito - débito); despesas = contas que começam por 6 (débito - crédito). Valores no orçamento estão em valor absoluto.
Ano atual: ${anoAtual}.
Sempre que precisares de números reais, usa as ferramentas. Responde com valores formatados em € e, quando útil, mostra desvios entre orçamentado e realizado. Sê conciso e mostra tabelas em markdown quando faz sentido.`,
          messages: await convertToModelMessages(body.messages),
          stopWhen: stepCountIs(50),
          tools: {
            consultar_orcamento: tool({
              description:
                "Devolve o orçamento agregado. Filtra por ano (obrigatório), opcionalmente por tipo (RECEITA/DESPESA), projeto (substring) e rubrica (substring). Agrega por projeto+rubrica+mes.",
              inputSchema: z.object({
                ano: z.number().int(),
                tipo: z.enum(["RECEITA", "DESPESA"]).optional(),
                projeto: z.string().optional(),
                rubrica: z.string().optional(),
              }),
              execute: async ({ ano, tipo, projeto, rubrica }) => {
                let q = supabase
                  .from("orcamentos")
                  .select("projeto, rubrica, tipo, mes, valor")
                  .eq("ano", ano)
                  .limit(5000);
                if (tipo) q = q.eq("tipo", tipo);
                if (projeto) q = q.ilike("projeto", `%${projeto}%`);
                if (rubrica) q = q.ilike("rubrica", `%${rubrica}%`);
                const { data, error } = await q;
                if (error) return { error: error.message };
                const totalPorMes = Array(12).fill(0);
                const porRubrica = new Map<string, number>();
                const porProjeto = new Map<string, number>();
                let total = 0;
                for (const r of data ?? []) {
                  const v = Number(r.valor);
                  total += v;
                  if (r.mes >= 1 && r.mes <= 12) totalPorMes[r.mes - 1] += v;
                  porRubrica.set(r.rubrica ?? "(sem)", (porRubrica.get(r.rubrica ?? "(sem)") ?? 0) + v);
                  porProjeto.set(r.projeto, (porProjeto.get(r.projeto) ?? 0) + v);
                }
                return {
                  linhas: data?.length ?? 0,
                  total,
                  totalPorMes,
                  porRubrica: Object.fromEntries(porRubrica),
                  porProjeto: Object.fromEntries(porProjeto),
                };
              },
            }),
            consultar_movimentos: tool({
              description:
                "Devolve agregados dos movimentos contabilísticos (extrato real). Filtra por ano (obrigatório), opcionalmente mes (1-12), projeto (substring no centro_custo), conta_prefixo (ex. '6' para despesas, '62' para serviços externos). Devolve receita, despesa e contagem por mes.",
              inputSchema: z.object({
                ano: z.number().int(),
                mes: z.number().int().min(1).max(12).optional(),
                projeto: z.string().optional(),
                conta_prefixo: z.string().optional(),
              }),
              execute: async ({ ano, mes, projeto, conta_prefixo }) => {
                let q = supabase
                  .from("transacoes_extrato")
                  .select("conta, debito, credito, centro_custo, mes_referencia")
                  .like("mes_referencia", `${ano}-%`)
                  .limit(10000);
                if (mes) {
                  const mm = String(mes).padStart(2, "0");
                  q = q.eq("mes_referencia", `${ano}-${mm}`);
                }
                if (projeto) q = q.ilike("centro_custo", `%${projeto}%`);
                if (conta_prefixo) q = q.like("conta", `${conta_prefixo}%`);
                const { data, error } = await q;
                if (error) return { error: error.message };
                const porMes: Record<number, { receita: number; despesa: number; linhas: number }> = {};
                let totalReceita = 0;
                let totalDespesa = 0;
                for (const t of data ?? []) {
                  const m = Number((t.mes_referencia ?? "").slice(5, 7));
                  if (!(m >= 1 && m <= 12)) continue;
                  const conta = t.conta ?? "";
                  const d = Number(t.debito ?? 0);
                  const c = Number(t.credito ?? 0);
                  const entry = porMes[m] ?? { receita: 0, despesa: 0, linhas: 0 };
                  entry.linhas += 1;
                  if (conta.startsWith("7")) {
                    const v = c - d;
                    entry.receita += v;
                    totalReceita += v;
                  } else if (conta.startsWith("6")) {
                    const v = d - c;
                    entry.despesa += v;
                    totalDespesa += v;
                  }
                  porMes[m] = entry;
                }
                return {
                  linhas: data?.length ?? 0,
                  totalReceita,
                  totalDespesa,
                  porMes,
                };
              },
            }),
            listar_projetos: tool({
              description: "Lista os projetos (centros de custo) distintos no orçamento de um dado ano.",
              inputSchema: z.object({ ano: z.number().int() }),
              execute: async ({ ano }) => {
                const { data, error } = await supabase
                  .from("orcamentos")
                  .select("projeto")
                  .eq("ano", ano)
                  .limit(5000);
                if (error) return { error: error.message };
                return { projetos: Array.from(new Set((data ?? []).map((r) => r.projeto))).sort() };
              },
            }),
          },
        });

        return result.toUIMessageStreamResponse({
          originalMessages: body.messages,
          onFinish: async ({ messages }) => {
            const assistant = messages.findLast?.((m) => m.role === "assistant");
            if (!assistant) return;
            const { data: existing } = await supabase
              .from("chat_messages")
              .select("id")
              .eq("thread_id", body.threadId)
              .eq("message_id", assistant.id)
              .maybeSingle();
            if (existing) return;
            await supabase.from("chat_messages").insert({
              thread_id: body.threadId,
              user_id: userId,
              role: "assistant",
              parts: assistant.parts as any,
              message_id: assistant.id,
            });
            await supabase
              .from("chat_threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", body.threadId);
          },
        });
      },
    },
  },
});
