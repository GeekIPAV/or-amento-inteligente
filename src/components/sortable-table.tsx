import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
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

/* -------------------------------------------------------------------------- */
/* Column widths (drag-to-resize)                                             */
/* -------------------------------------------------------------------------- */

export function useColumnWidths(defaults: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(defaults);
  const [resizing, setResizing] = useState<string | null>(null);
  const stateRef = useRef<{ id: string; startX: number; startW: number } | null>(null);

  const start = useCallback(
    (id: string, e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const startX =
        "touches" in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const startW = widths[id] ?? defaults[id] ?? 120;
      stateRef.current = { id, startX, startW };
      setResizing(id);

      const onMove = (ev: MouseEvent | TouchEvent) => {
        const s = stateRef.current;
        if (!s) return;
        const x =
          "touches" in ev ? ev.touches[0].clientX : (ev as MouseEvent).clientX;
        const next = Math.max(60, Math.round(s.startW + (x - s.startX)));
        setWidths((prev) => ({ ...prev, [s.id]: next }));
      };
      const onUp = () => {
        stateRef.current = null;
        setResizing(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        window.removeEventListener("touchmove", onMove);
        window.removeEventListener("touchend", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
      window.addEventListener("touchmove", onMove);
      window.addEventListener("touchend", onUp);
    },
    [widths, defaults],
  );

  return { widths, startResize: start, resizingId: resizing };
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
  onResizeStart,
  resizing,
  resizable = true,
}: {
  id: string;
  sort: SortState;
  onToggle: (id: string) => void;
  align?: "left" | "right" | "center";
  className?: string;
  children: ReactNode;
  sortable?: boolean;
  width?: string | number;
  onResizeStart?: (id: string, e: React.MouseEvent | React.TouchEvent) => void;
  resizing?: boolean;
  resizable?: boolean;
}) {
  const active = sort?.id === id && sort.dir;
  const Icon = active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown;
  return (
    <TableHead
      style={width ? { width, minWidth: width } : undefined}
      className={cn(
        "relative h-9 whitespace-nowrap px-3 text-xs font-medium",
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
            align === "right" && "w-full justify-end",
          )}
        >
          <span>{children}</span>
          <Icon className="h-3.5 w-3.5 opacity-70" />
        </button>
      ) : (
        <span className="text-muted-foreground">{children}</span>
      )}
      {resizable && onResizeStart && (
        <div
          onMouseDown={(e) => onResizeStart(id, e)}
          onTouchStart={(e) => onResizeStart(id, e)}
          onClick={(e) => e.stopPropagation()}
          onDragStart={(e) => e.preventDefault()}
          draggable={false}
          className={cn(
            "absolute right-0 top-0 z-20 h-full w-2.5 cursor-col-resize touch-none select-none bg-transparent hover:bg-primary/60",
            resizing && "bg-primary",
          )}
        />
      )}
    </TableHead>
  );
}
