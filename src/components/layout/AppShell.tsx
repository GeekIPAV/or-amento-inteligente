import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, FileSpreadsheet, Upload, LogOut, Wallet, Table as TableIcon, FolderKanban, ListTree, Sparkles, Users, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { verificarAdmin } from "@/lib/admin-users.functions";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, adminOnly: false },
  { to: "/orcamento", label: "Orçamento", icon: FileSpreadsheet, adminOnly: false },
  { to: "/movimentos", label: "Movimentos", icon: TableIcon, adminOnly: false },
  { to: "/centros-custo", label: "Centros de Custo", icon: FolderKanban, adminOnly: false },
  { to: "/contas-rubricas", label: "Contas / Rubricas", icon: ListTree, adminOnly: false },
  { to: "/prompts", label: "Prompts", icon: Sparkles, adminOnly: false },
  { to: "/admin", label: "Utilizadores", icon: Users, adminOnly: true },
] as const;

const STORAGE_KEY = "appshell:collapsed";

export function AppShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const verificarAdminFn = useServerFn(verificarAdmin);
  const { data: adminInfo } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => verificarAdminFn(),
    staleTime: 5 * 60_000,
  });
  const isAdmin = !!adminInfo?.isAdmin;

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // Auto-collapse on small screens
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
          <div className={cn(
            "py-5 border-b border-border flex items-center gap-2",
            collapsed ? "px-3 justify-center" : "px-6",
          )}>
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

          <nav className="flex-1 p-3 space-y-1">
            {nav.filter((i) => !i.adminOnly || isAdmin).map((item) => {
              const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
              const Icon = item.icon;
              const link = (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-md text-sm transition-colors",
                    collapsed ? "justify-center px-2 py-2" : "px-3 py-2",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
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
