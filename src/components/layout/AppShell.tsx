import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  FileSpreadsheet,
  Upload,
  LogOut,
  Wallet,
  Table as TableIcon,
  FolderKanban,
  ListTree,
  Sparkles,
  Users,
  PanelLeftClose,
  PanelLeftOpen,
  Landmark,
  Waves,
  FileText,
  BellDot,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, Fragment } from "react";
import { supabase } from "@/integrations/supabase/client";
import { verificarAdmin } from "@/lib/admin-users.functions";
import { contarAlertas } from "@/lib/alertas.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
};

type NavGroup = { label: string | null; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: null,
    items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "FINANCEIRO",
    items: [
      { to: "/orcamento", label: "Orçamento", icon: FileSpreadsheet },
      { to: "/movimentos", label: "Movimentos", icon: TableIcon },
      { to: "/importar-extratos", label: "Importar extratos", icon: Upload },
    ],
  },
  {
    label: "FINANCIAMENTO",
    items: [
      { to: "/financiadores", label: "Financiadores", icon: Landmark },
      { to: "/tesouraria", label: "Tesouraria", icon: Waves },
      { to: "/relatorio", label: "Relatório", icon: FileText },
      { to: "/alertas", label: "Alertas", icon: BellDot },
    ],
  },
  {
    label: "ESTRUTURA",
    items: [
      { to: "/centros-custo", label: "Centros de Custo", icon: FolderKanban },
      { to: "/contas-rubricas", label: "Contas / Rubricas", icon: ListTree },
    ],
  },
  {
    label: "FERRAMENTAS",
    items: [
      { to: "/prompts", label: "Prompts", icon: Sparkles },
      { to: "/admin", label: "Utilizadores", icon: Users, adminOnly: true },
    ],
  },
];

const STORAGE_KEY = "appshell:collapsed";

export function AppShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const verificarAdminFn = useServerFn(verificarAdmin);
  const contarAlertasFn = useServerFn(contarAlertas);
  const { data: adminInfo } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => verificarAdminFn(),
    staleTime: 5 * 60_000,
  });
  const isAdmin = !!adminInfo?.isAdmin;

  const { data: alertaInfo } = useQuery({
    queryKey: ["alertas-count"],
    queryFn: () => contarAlertasFn() as Promise<{ count: number }>,
    staleTime: 2 * 60_000,
    refetchInterval: 2 * 60_000,
  });
  const alertaCount = alertaInfo?.count ?? 0;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 768px)");
    const apply = () => {
      if (mq.matches) setCollapsed(true);
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <TooltipProvider delayDuration={100}>
      <div className="flex min-h-screen bg-background">
        <aside
          className={cn(
            "border-r border-border bg-card flex flex-col transition-[width] duration-200",
            collapsed ? "w-16" : "w-64",
          )}
        >
          <div
            className={cn(
              "py-5 border-b border-border flex items-center gap-2",
              collapsed ? "px-3 justify-center" : "px-6",
            )}
          >
            <div className="size-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Wallet className="size-5" />
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="font-semibold leading-tight truncate">Finanças</div>
                <div className="text-xs text-muted-foreground truncate">Controlo Orçamental</div>
              </div>
            )}
          </div>

          <div className={cn("px-3 pt-3", collapsed && "flex justify-center")}>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
              title={collapsed ? "Expandir menu" : "Colapsar menu"}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </Button>
          </div>

          <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
            {navGroups.map((group, gi) => {
              const items = group.items.filter((i) => !i.adminOnly || isAdmin);
              if (items.length === 0) return null;
              return (
                <Fragment key={gi}>
                  {group.label && !collapsed && (
                    <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60 px-3 pt-4 pb-1">
                      {group.label}
                    </div>
                  )}
                  {group.label && collapsed && gi > 0 && (
                    <div className="my-2 mx-2 border-t border-border/60" />
                  )}
                  {items.map((item) => {
                    const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
                    const Icon = item.icon;
                    const isAlerts = item.to === "/alertas";
                    const showBadge = isAlerts && alertaCount > 0;
                    const link = (
                      <Link
                        key={item.to}
                        to={item.to}
                        className={cn(
                          "relative flex items-center gap-3 rounded-md text-sm transition-colors",
                          collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        )}
                      >
                        <span className="relative">
                          <Icon className="size-4 shrink-0" />
                          {showBadge && collapsed && (
                            <span className="absolute -top-1 -right-1 size-2 rounded-full bg-red-500 ring-2 ring-card" />
                          )}
                        </span>
                        {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                        {!collapsed && showBadge && (
                          <span
                            className={cn(
                              "ml-auto inline-flex items-center justify-center rounded-full px-1.5 min-w-[18px] h-[18px] text-[10px] font-semibold tabular-nums",
                              active
                                ? "bg-primary-foreground/20 text-primary-foreground"
                                : "bg-red-500 text-white",
                            )}
                          >
                            {alertaCount > 99 ? "99+" : alertaCount}
                          </span>
                        )}
                      </Link>
                    );

                    if (collapsed) {
                      return (
                        <Tooltip key={item.to}>
                          <TooltipTrigger asChild>{link}</TooltipTrigger>
                          <TooltipContent side="right">{item.label}</TooltipContent>
                        </Tooltip>
                      );
                    }
                    return link;
                  })}
                </Fragment>
              );
            })}
          </nav>

          <div className="p-3 border-t border-border">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-full"
                    onClick={handleLogout}
                    aria-label="Terminar sessão"
                  >
                    <LogOut className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Terminar sessão</TooltipContent>
              </Tooltip>
            ) : (
              <Button variant="ghost" className="w-full justify-start gap-2" onClick={handleLogout}>
                <LogOut className="size-4" /> Terminar sessão
              </Button>
            )}
          </div>
        </aside>
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </TooltipProvider>
  );
}
