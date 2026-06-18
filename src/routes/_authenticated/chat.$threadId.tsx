import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { carregarMensagens } from "@/lib/chat.functions";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputFooter,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  Tool,
  ToolHeader,
  ToolContent,
  ToolInput,
  ToolOutput,
} from "@/components/ai-elements/tool";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/chat/$threadId")({
  component: ThreadView,
});

function ThreadView() {
  const { threadId } = Route.useParams();
  const qc = useQueryClient();
  const loadFn = useServerFn(carregarMensagens);

  const { data: initial, isLoading } = useQuery({
    queryKey: ["chat-messages", threadId],
    queryFn: () => loadFn({ data: { threadId } }),
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">A carregar…</div>;
  }
  return <ChatWindow key={threadId} threadId={threadId} initial={(initial ?? []) as UIMessage[]} onDone={() => qc.invalidateQueries({ queryKey: ["chat-threads"] })} />;
}

function ChatWindow({
  threadId,
  initial,
  onDone,
}: {
  threadId: string;
  initial: UIMessage[];
  onDone: () => void;
}) {
  const tokenRef = useRef<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      tokenRef.current = data.session?.access_token ?? null;
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: () => ({
          Authorization: `Bearer ${tokenRef.current ?? ""}`,
        }),
        body: { threadId },
      }),
    [threadId],
  );

  const { messages, sendMessage, status, error } = useChat({
    id: threadId,
    messages: initial,
    transport,
    onFinish: () => onDone(),
  });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId, status]);

  const onSubmit = (msg: PromptInputMessage) => {
    const text = msg.text?.trim();
    if (!text) return;
    sendMessage({ text });
  };

  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex flex-col h-full">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              icon={<MessageSquare className="size-10 opacity-50" />}
              title="Pergunta sobre os números"
              description="Ex.: Qual o desvio do projeto X até maio? Quanto gastámos em rendas este ano?"
            />
          ) : (
            messages.map((m) => (
              <Message from={m.role} key={m.id}>
                <MessageContent>
                  {m.parts.map((p, i) => {
                    if (p.type === "text") {
                      return (
                        <div key={i} className="prose prose-sm dark:prose-invert max-w-none">
                          <ReactMarkdown>{p.text}</ReactMarkdown>
                        </div>
                      );
                    }
                    if (p.type?.startsWith("tool-")) {
                      const tp = p as any;
                      return (
                        <Tool key={i} defaultOpen={false}>
                          <ToolHeader
                            type={tp.type}
                            state={tp.state}
                          />
                          <ToolContent>
                            {tp.input && <ToolInput input={tp.input} />}
                            {(tp.output !== undefined || tp.errorText) && (
                              <ToolOutput output={tp.output} errorText={tp.errorText} />
                            )}
                          </ToolContent>
                        </Tool>
                      );
                    }
                    return null;
                  })}
                </MessageContent>
              </Message>
            ))
          )}
          {status === "submitted" && (
            <div className="px-4 py-2">
              <Shimmer>A pensar…</Shimmer>
            </div>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && (
        <div className="px-4 py-2 text-sm text-destructive border-t border-border">
          {error.message}
        </div>
      )}

      <div className="border-t border-border p-3">
        <PromptInput onSubmit={onSubmit}>
          <PromptInputTextarea
            ref={textareaRef}
            placeholder="Pergunta sobre o orçamento ou os movimentos…"
            disabled={!ready}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} disabled={!ready || busy} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
