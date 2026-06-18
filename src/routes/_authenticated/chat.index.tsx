import { createFileRoute } from "@tanstack/react-router";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat/")({
  component: ChatIndex,
});

function ChatIndex() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center p-8 text-muted-foreground">
      <MessageSquare className="size-12 mb-4 opacity-50" />
      <h2 className="text-lg font-medium text-foreground">Assistente Financeiro</h2>
      <p className="text-sm mt-2 max-w-md">
        Faz perguntas sobre o orçamento e os movimentos contabilísticos. Cria
        uma nova conversa para começar.
      </p>
    </div>
  );
}
