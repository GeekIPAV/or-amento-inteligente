import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/tesouraria")({
  component: TesourariaPage,
});

function TesourariaPage() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold">Previsão de Tesouraria</h1>
      <p className="mt-2 text-sm text-muted-foreground">Em construção.</p>
    </div>
  );
}
