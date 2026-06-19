import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Plus, Copy, Trash2, Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Check, Pencil, ChevronDown, ChevronUp } from "lucide-react";
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
  const [editando, setEditando] = useState(false);
  const [colapsado, setColapsado] = useState(true);

  // Populate editor content whenever entering edit mode
  useEffect(() => {
    if (editando && editorRef.current && editorRef.current.innerHTML !== prompt.descricaoHtml) {
      editorRef.current.innerHTML = prompt.descricaoHtml;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editando]);

  const exec = (cmd: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    if (editorRef.current) onChange({ descricaoHtml: editorRef.current.innerHTML });
  };

  const copiar = async () => {
    const html = prompt.descricaoHtml;
    const text = editorRef.current?.innerText ?? prompt.descricaoHtml.replace(/<[^>]*>/g, "");
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

  const guardar = () => {
    if (editorRef.current) {
      onChange({ descricaoHtml: editorRef.current.innerHTML });
    }
    setEditando(false);
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
          {editando ? (
            <Button variant="outline" size="sm" onClick={guardar} className="gap-2 shrink-0">
              <Check className="size-4" />
              Guardar
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setEditando(true)} className="gap-2 shrink-0">
              <Pencil className="size-4" />
              Editar
            </Button>
          )}
          <Button variant="secondary" size="icon" onClick={copiar} className="shrink-0">
            {copiado ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
          {!editando && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setColapsado((c) => !c)}
              className="shrink-0 gap-1 text-muted-foreground hover:text-foreground"
            >
              {colapsado ? (
                <>
                  <ChevronDown className="size-4" /> Ver
                </>
              ) : (
                <>
                  <ChevronUp className="size-4" /> Ocultar
                </>
              )}
            </Button>
          )}
          <Button variant="ghost" size="icon" onClick={() => { if (confirm("Tens a certeza que queres apagar este prompt?")) onDelete(); }} className="shrink-0 text-muted-foreground hover:text-destructive">
            <Trash2 className="size-4" />
          </Button>
        </div>
        {editando && (
          <div className="flex items-center gap-1 border rounded-md p-1 w-fit">
            <ToolbarBtn onClick={() => exec("bold")} title="Negrito"><Bold className="size-4" /></ToolbarBtn>
            <ToolbarBtn onClick={() => exec("italic")} title="Itálico"><Italic className="size-4" /></ToolbarBtn>
            <ToolbarBtn onClick={() => exec("underline")} title="Sublinhado"><UnderlineIcon className="size-4" /></ToolbarBtn>
            <div className="w-px h-5 bg-border mx-1" />
            <ToolbarBtn onClick={() => exec("insertUnorderedList")} title="Lista"><List className="size-4" /></ToolbarBtn>
            <ToolbarBtn onClick={() => exec("insertOrderedList")} title="Lista numerada"><ListOrdered className="size-4" /></ToolbarBtn>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {editando ? (
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => onChange({ descricaoHtml: (e.target as HTMLDivElement).innerHTML })}
            className="min-h-32 rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring prose prose-sm max-w-none dark:prose-invert [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
            data-placeholder="Escreve aqui a tua descrição..."
          />
        ) : (
          !colapsado && (
            <div
              className="rounded-md border border-transparent bg-background px-3 py-2 text-sm prose prose-sm max-w-none dark:prose-invert [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
              dangerouslySetInnerHTML={{ __html: prompt.descricaoHtml || '<span class="text-muted-foreground italic">Sem descrição</span>' }}
            />
          )
        )}
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
