import { useMemo, useState, type ReactNode } from "react";
import { TableHead } from "@/components/ui/table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc" | null;
export type SortState = { id: string; dir: SortDir } | null;

export type SortAccessors<T> = Record<string, (row: T) => string | number | null | undefined>;

export function useSortableRows<T>(
  rows: T[],
  accessors: SortAccessors<T>,
  initial: SortState = null,
) {
  const [sort, setSort] = useState<SortState>(initial);

  const sorted = useMemo(() => {
    if (!sort || !sort.dir) return rows;
    const fn = accessors[sort.id];
    if (!fn) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = fn(a);
      const vb = fn(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * dir;
      return String(va).localeCompare(String(vb), "pt", { sensitivity: "base" }) * dir;
    });
  }, [rows, sort, accessors]);

  const toggle = (id: string) => {
    setSort((prev) => {
      if (!prev || prev.id !== id) return { id, dir: "asc" };
      if (prev.dir === "asc") return { id, dir: "desc" };
      return null;
    });
  };

  return { sorted, sort, toggle, setSort };
}

export function SortHeader({
  id,
  sort,
  onToggle,
  align = "left",
  className,
  children,
  sortable = true,
  width,
}: {
  id: string;
  sort: SortState;
  onToggle: (id: string) => void;
  align?: "left" | "right" | "center";
  className?: string;
  children: ReactNode;
  sortable?: boolean;
  width?: string | number;
}) {
  const active = sort?.id === id && sort.dir;
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <TableHead
      style={width ? { width } : undefined}
      className={cn(
        "h-9 whitespace-nowrap px-3 text-xs font-medium",
        align === "right" && "text-right",
        align === "center" && "text-center",
        className,
      )}
    >
      {sortable ? (
        <button
          type="button"
          onClick={() => onToggle(id)}
          className={cn(
            "inline-flex items-center gap-1 hover:text-foreground",
            active ? "text-foreground" : "text-muted-foreground",
            align === "right" && "justify-end w-full",
          )}
        >
          <span>{children}</span>
          <Icon className="h-3.5 w-3.5 opacity-70" />
        </button>
      ) : (
        <span className="text-muted-foreground">{children}</span>
      )}
    </TableHead>
  );
}
