import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Plus, Trash2, MessageSquare } from "lucide-react";
import { listarThreads, criarThread, apagarThread } from "@/lib/chat.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/chat")({
  component: ChatLayout,
});

function ChatLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const listFn = useServerFn(listarThreads);
  const createFn = useServerFn(criarThread);
  const deleteFn = useServerFn(apagarThread);

  const { data: threads = [] } = useQuery({
    queryKey: ["chat-threads"],
    queryFn: () => listFn(),
  });

  const createMut = useMutation({
    mutationFn: () => createFn(),
    onSuccess: (t: any) => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      navigate({ to: "/chat/$threadId", params: { threadId: t.id } });
    },
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ["chat-threads"] });
      if (pathname.includes(id)) navigate({ to: "/chat" });
    },
  });

  return (
    <div className="flex h-screen">
      <aside className="w-72 border-r border-border flex flex-col bg-card">
        <div className="p-3 border-b border-border">
          <Button
            className="w-full"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
          >
            <Plus className="size-4" /> Nova conversa
          </Button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {threads.length === 0 && (
            <p className="text-xs text-muted-foreground p-3">
              Sem conversas. Cria uma nova para começar.
            </p>
          )}
          {threads.map((t: any) => {
            const active = pathname.endsWith(t.id);
            return (
              <div
                key={t.id}
                className={cn(
                  "group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm",
                  active ? "bg-accent" : "hover:bg-accent/50",
                )}
              >
                <Link
                  to="/chat/$threadId"
                  params={{ threadId: t.id }}
                  className="flex-1 truncate flex items-center gap-2"
                >
                  <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{t.title}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Apagar conversa?")) delMut.mutate(t.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive"
                  aria-label="Apagar"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </aside>
      <div className="flex-1 min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
