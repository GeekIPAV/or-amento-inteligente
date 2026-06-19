import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Copy, Trash2, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/prompts")({
  component: PromptsPage,
});

type Prompt = { id: string; titulo: string; descricaoHtml: string };

const STORAGE_KEY = "prompts:v1";

function loadPrompts(): Prompt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Prompt[]) : [];
  } catch {
    return [];
  }
}

function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);

  useEffect(() => {
    setPrompts(loadPrompts());
  }, []);

  const persist = (next: Prompt[]) => {
    setPrompts(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const adicionar = () => {
    const novo: Prompt = {
      id: crypto.randomUUID(),
      titulo: "",
      descricaoHtml: "",
    };
    persist([novo, ...prompts]);
  };

  const atualizar = (id: string, patch: Partial<Prompt>) => {
    persist(prompts.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const remover = (id: string) => {
    persist(prompts.filter((p) => p.id !== id));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Prompts</h1>
          <p className="text-sm text-muted-foreground">
            Guarda e copia os teus prompts favoritos.
          </p>
        </div>
        <Button onClick={adicionar} className="gap-2">
          <Plus className="size-4" /> Novo prompt
        </Button>
      </div>

      {prompts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center text-muted-foreground">
            Ainda não tens prompts. Clica em "Novo prompt" para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {prompts.map((p) => (
            <PromptCard
              key={p.id}
              prompt={p}
              onChange={(patch) => atualizar(p.id, patch)}
              onDelete={() => remover(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PromptCard({
  prompt,
  onChange,
  onDelete,
}: {
  prompt: Prompt;
  onChange: (patch: Partial<Prompt>) => void;
  onDelete: () => void;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [copiado, setCopiado] = useState(false);

  // Initialize editor content once
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== prompt.descricaoHtml) {
      editorRef.current.innerHTML = prompt.descricaoHtml;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exec = (cmd: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    if (editorRef.current) onChange({ descricaoHtml: editorRef.current.innerHTML });
  };

  const copiar = async () => {
    const html = editorRef.current?.innerHTML ?? "";
    const text = editorRef.current?.innerText ?? "";
    try {
      if (navigator.clipboard && "write" in navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([html], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopiado(true);
      toast.success("Copiado para a área de transferência");
      setTimeout(() => setCopiado(false), 1500);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-center gap-2">
          <Input
            value={prompt.titulo}
            onChange={(e) => onChange({ titulo: e.target.value })}
            placeholder="Título do prompt"
            className="text-base font-medium"
          />
          <Button variant="outline" size="sm" onClick={copiar} className="gap-2 shrink-0">
            {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
            Copiar
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete} className="shrink-0 text-muted-foreground hover:text-destructive">
            <Trash2 className="size-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1 border rounded-md p-1 w-fit">
          <ToolbarBtn onClick={() => exec("bold")} title="Negrito"><Bold className="size-4" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec("italic")} title="Itálico"><Italic className="size-4" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec("underline")} title="Sublinhado"><UnderlineIcon className="size-4" /></ToolbarBtn>
          <div className="w-px h-5 bg-border mx-1" />
          <ToolbarBtn onClick={() => exec("insertUnorderedList")} title="Lista"><List className="size-4" /></ToolbarBtn>
          <ToolbarBtn onClick={() => exec("insertOrderedList")} title="Lista numerada"><ListOrdered className="size-4" /></ToolbarBtn>
        </div>
      </CardHeader>
      <CardContent>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onChange({ descricaoHtml: (e.target as HTMLDivElement).innerHTML })}
          className="min-h-32 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring prose prose-sm max-w-none dark:prose-invert [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
          data-placeholder="Escreve aqui a tua descrição..."
        />
      </CardContent>
    </Card>
  );
}

function ToolbarBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="h-8 w-8 inline-flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground"
    >
      {children}
    </button>
  );
}
