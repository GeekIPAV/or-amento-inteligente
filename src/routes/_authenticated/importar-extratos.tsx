import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/importar-extratos")({
  head: () => ({ meta: [{ title: "Importar Extratos — Finanças" }] }),
  loader: () => {
    throw redirect({ to: "/movimentos" });
  },
  component: () => null,
});
