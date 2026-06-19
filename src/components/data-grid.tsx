import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  ColumnDef,
  ColumnFiltersState,
  ColumnOrderState,
  ColumnSizingState,
  ExpandedState,
  FilterFn,
  GroupingState,
  Row,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getFilteredRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Eye,
  Filter,
  GripVertical,
  Layers,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Filter ops + fns                                                   */
/* ------------------------------------------------------------------ */

export type TextOp = "contains" | "equals";
export type NumOp = "eq" | "gt" | "lt";
export type FilterValue =
  | { operator: TextOp | NumOp; value: string }
  | undefined;

const TEXT_OPS: { value: TextOp; label: string }[] = [
  { value: "contains", label: "Contém" },
  { value: "equals", label: "É exatamente" },
];
const NUM_OPS: { value: NumOp; label: string }[] = [
  { value: "eq", label: "Igual a" },
  { value: "gt", label: "Maior que" },
  { value: "lt", label: "Menor que" },
];

export const textFilterFn: FilterFn<any> = (row, id, filter: FilterValue) => {
  if (!filter || !filter.value) return true;
  const cell = String(row.getValue(id) ?? "").toLowerCase();
  const v = String(filter.value).toLowerCase();
  if (filter.operator === "equals") return cell === v;
  return cell.includes(v);
};
export const numFilterFn: FilterFn<any> = (row, id, filter: FilterValue) => {
  if (!filter || filter.value === "" || filter.value == null) return true;
  const n = Number(filter.value);
  if (!Number.isFinite(n)) return true;
  const cell = Number(row.getValue(id));
  if (!Number.isFinite(cell)) return false;
  if (filter.operator === "gt") return cell > n;
  if (filter.operator === "lt") return cell < n;
  return cell === n;
};

/* ------------------------------------------------------------------ */
/* Format helpers                                                     */
/* ------------------------------------------------------------------ */

const eur = new Intl.NumberFormat("pt-PT", {
  style: "currency",
  currency: "EUR",
});
export const fmtEur = (n: number) => eur.format(Number(n) || 0);

/* ------------------------------------------------------------------ */
/* Headers                                                            */
/* ------------------------------------------------------------------ */

export function sortHeader(label: string) {
  return ({ column }: any) => (
    <button
      type="button"
      className="flex items-center gap-1 font-semibold uppercase tracking-wide"
      onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
    >
      {label}
      {column.getIsSorted() === "asc" ? (
        <ArrowUp className="h-3 w-3" />
      ) : column.getIsSorted() === "desc" ? (
        <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Filter popover                                                     */
/* ------------------------------------------------------------------ */

function FilterPopover({ column }: { column: any }) {
  const filterType = (column.columnDef.meta?.filterType ?? "text") as
    | "text"
    | "number";
  const current = column.getFilterValue() as FilterValue;
  const active = !!current?.value;
  const ops = filterType === "number" ? NUM_OPS : TEXT_OPS;

  const [operator, setOperator] = useState<string>(
    current?.operator ?? ops[0].value,
  );
  const [value, setValue] = useState<string>(current?.value ?? "");

  useEffect(() => {
    setOperator(current?.operator ?? ops[0].value);
    setValue(current?.value ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.operator, current?.value]);

  const apply = (op: string, val: string) => {
    if (!val) column.setFilterValue(undefined);
    else column.setFilterValue({ operator: op, value: val });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-6 w-full items-center gap-1 rounded px-1.5 text-xs transition-colors",
            active
              ? "bg-primary/10 text-primary"
              : "text-muted-foreground hover:bg-muted",
          )}
        >
          <Filter className="h-3 w-3" />
          <span className="truncate">
            {active
              ? `${ops.find((o) => o.value === current!.operator)?.label}: ${current!.value}`
              : "filtrar…"}
          </span>
          {active && (
            <X
              className="ml-auto h-3 w-3 shrink-0 hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation();
                column.setFilterValue(undefined);
              }}
            />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="space-y-2">
          <Select
            value={operator}
            onValueChange={(v) => {
              setOperator(v);
              apply(v, value);
            }}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ops.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            autoFocus
            type={filterType === "number" ? "number" : "text"}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              apply(operator, e.target.value);
            }}
            placeholder="Valor…"
            className="h-8"
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/* Summary card                                                       */
/* ------------------------------------------------------------------ */

export function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "receita" | "despesa" | "neutral";
}) {
  return (
    <div className="min-w-[140px] rounded-md border bg-card px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-lg font-semibold tabular-nums",
          tone === "receita" && "text-emerald-600 dark:text-emerald-400",
          tone === "despesa" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Currency cell                                                      */
/* ------------------------------------------------------------------ */

export function CurrencyCell({
  value,
  tone,
  showZeroAsDash = false,
}: {
  value: number;
  tone?: "receita" | "despesa" | "auto" | "neutral";
  showZeroAsDash?: boolean;
}) {
  const n = Number(value) || 0;
  if (showZeroAsDash && n === 0)
    return <span className="text-muted-foreground">—</span>;
  const t =
    tone === "auto"
      ? n >= 0
        ? "receita"
        : "despesa"
      : tone;
  return (
    <div
      className={cn(
        "text-right tabular-nums",
        t === "receita" && "font-medium text-emerald-600 dark:text-emerald-400",
        t === "despesa" && "font-medium text-rose-600 dark:text-rose-400",
      )}
    >
      {fmtEur(n)}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* DataGrid                                                           */
/* ------------------------------------------------------------------ */

export type GroupableOption = { id: string; label: string };

export interface DataGridProps<T> {
  data: T[];
  columns: ColumnDef<T, any>[];
  getRowId?: (row: T) => string;
  groupable?: GroupableOption[];
  defaultColumnOrder?: string[];
  initialGrouping?: string[];
  toolbarExtra?: ReactNode;
  searchPlaceholder?: string;
  showSearch?: boolean;
  showColumns?: boolean;
  isLoading?: boolean;
  maxHeight?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function DataGrid<T>({
  data,
  columns,
  getRowId,
  groupable = [],
  defaultColumnOrder,
  initialGrouping = [],
  toolbarExtra,
  searchPlaceholder = "Pesquisar…",
  showSearch = true,
  showColumns = true,
  isLoading = false,
  maxHeight = "72vh",
  emptyMessage = "Sem dados.",
  onRowClick,
}: DataGridProps<T>) {

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>(
    defaultColumnOrder ?? [],
  );
  const [globalFilter, setGlobalFilter] = useState("");
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});
  const [grouping, setGrouping] = useState<GroupingState>(initialGrouping);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const dragColRef = useRef<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      columnOrder,
      globalFilter,
      columnSizing,
      grouping,
      expanded,
    },
    getRowId: getRowId,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    onGlobalFilterChange: setGlobalFilter,
    onColumnSizingChange: setColumnSizing,
    onGroupingChange: setGrouping,
    onExpandedChange: setExpanded,
    enableColumnResizing: true,
    columnResizeMode: "onEnd",
    defaultColumn: { minSize: 60, size: 160, maxSize: 800 },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    autoResetExpanded: false,
    globalFilterFn: "includesString",
  });

  const reorderColumn = (sourceId: string, targetId: string) => {
    if (sourceId === targetId) return;
    const order = table.getState().columnOrder.length
      ? [...table.getState().columnOrder]
      : table.getAllLeafColumns().map((c) => c.id);
    const from = order.indexOf(sourceId);
    const to = order.indexOf(targetId);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, sourceId);
    setColumnOrder(order);
  };

  const rows = table.getRowModel().rows;

  const scrollerRef = useRef<HTMLDivElement>(null);
  const ROW_HEIGHT = 33; // px (h-8 + border)
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollerRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 12,
  });
  const virtualItems = rowVirtualizer.getVirtualItems();
  const totalSize = rowVirtualizer.getTotalSize();
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0 ? totalSize - virtualItems[virtualItems.length - 1].end : 0;
  const visibleColCount = table.getVisibleLeafColumns().length;


  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        {groupable.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Layers className="mr-2 h-4 w-4" />
                Agrupar
                {grouping.length > 0 && (
                  <span className="ml-1 rounded bg-primary/10 px-1.5 text-xs text-primary">
                    {grouping.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Agrupar por</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {groupable.map((g) => (
                <DropdownMenuCheckboxItem
                  key={g.id}
                  checked={grouping.includes(g.id)}
                  onCheckedChange={(v) => {
                    setGrouping((prev) =>
                      v
                        ? [...prev.filter((x) => x !== g.id), g.id]
                        : prev.filter((x) => x !== g.id),
                    );
                  }}
                >
                  {g.label}
                </DropdownMenuCheckboxItem>
              ))}
              {grouping.length > 0 && (
                <>
                  <DropdownMenuSeparator />
                  <button
                    className="w-full px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted"
                    onClick={() => setGrouping([])}
                  >
                    Limpar agrupamento
                  </button>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {showSearch && (
          <Input
            placeholder={searchPlaceholder}
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="h-8 w-[260px]"
          />
        )}
        <div className="ml-auto flex items-center gap-2">
          {toolbarExtra}
          {showColumns && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Eye className="mr-2 h-4 w-4" /> Colunas
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Mostrar colunas</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllLeafColumns()
                  .filter((c) => c.getCanHide())
                  .map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.id}
                      checked={c.getIsVisible()}
                      onCheckedChange={(v) => c.toggleVisibility(!!v)}
                    >
                      {String(c.columnDef.header && typeof c.columnDef.header === "string" ? c.columnDef.header : c.id)}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Grid */}
      <div className="rounded-md border">
        <div ref={scrollerRef} className="overflow-auto" style={{ maxHeight, height: maxHeight }}>

          <Table
            className="text-sm"
            style={{
              width: table.getTotalSize(),
              tableLayout: "fixed",
            }}
          >
            <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="hover:bg-transparent">
                  {hg.headers.map((h) => {
                    const isDragOver = dragOverCol === h.column.id;
                    return (
                      <TableHead
                        key={h.id}
                        style={{ width: h.getSize() }}
                        onDragOver={(e) => {
                          if (!dragColRef.current) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          if (dragOverCol !== h.column.id)
                            setDragOverCol(h.column.id);
                        }}
                        onDragLeave={() => {
                          if (dragOverCol === h.column.id) setDragOverCol(null);
                        }}
                        onDrop={(e) => {
                          if (!dragColRef.current) return;
                          e.preventDefault();
                          const src = dragColRef.current;
                          dragColRef.current = null;
                          setDragOverCol(null);
                          if (src) reorderColumn(src, h.column.id);
                        }}
                        onDragEnd={() => {
                          dragColRef.current = null;
                          setDragOverCol(null);
                        }}
                        className={cn(
                          "group relative h-8 select-none whitespace-nowrap px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                          isDragOver && "bg-primary/10",
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-1 pr-3">
                          <span
                            role="button"
                            aria-label={`Mover coluna ${h.column.id}`}
                            tabIndex={0}
                            draggable
                            onDragStart={(e) => {
                              dragColRef.current = h.column.id;
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => {
                              dragColRef.current = null;
                              setDragOverCol(null);
                            }}
                            className="-ml-1 inline-flex h-6 w-4 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground active:cursor-grabbing"
                          >
                            <GripVertical className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1 overflow-hidden">
                            {h.isPlaceholder
                              ? null
                              : flexRender(
                                  h.column.columnDef.header,
                                  h.getContext(),
                                )}
                          </div>
                        </div>
                        {h.column.getCanResize() && (
                          <div
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              h.getResizeHandler()(e);
                            }}
                            onTouchStart={(e) => {
                              e.stopPropagation();
                              h.getResizeHandler()(e);
                            }}
                            onDragStart={(e) => e.preventDefault()}
                            onClick={(e) => e.stopPropagation()}
                            draggable={false}
                            className={cn(
                              "absolute right-0 top-0 z-20 h-full w-2.5 cursor-col-resize touch-none select-none bg-transparent hover:bg-primary/60",
                              h.column.getIsResizing() && "bg-primary",
                            )}
                          />
                        )}
                      </TableHead>
                    );
                  })}
                </TableRow>
              ))}
              <TableRow className="hover:bg-transparent">
                {table.getHeaderGroups()[0]?.headers.map((h) => (
                  <TableHead
                    key={`f-${h.id}`}
                    style={{ width: h.getSize() }}
                    className="h-8 whitespace-nowrap px-2 py-1"
                  >
                    {h.column.getCanFilter() ? (
                      <FilterPopover column={h.column} />
                    ) : null}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={`sk-${i}`} className="h-8 border-b border-border/50">
                    <TableCell colSpan={visibleColCount} className="h-8 px-2 py-1">
                      <div className="h-4 w-full animate-pulse rounded bg-muted" />
                    </TableCell>
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleColCount}
                    className="h-24 text-center text-muted-foreground"
                  >
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {paddingTop > 0 && (
                    <tr aria-hidden style={{ height: paddingTop }}>
                      <td colSpan={visibleColCount} className="p-0" />
                    </tr>
                  )}
                  {virtualItems.map((vi) => {
                    const row = rows[vi.index] as Row<T>;
                    return (
                      <TableRow
                        key={row.id}
                        data-index={vi.index}
                        className={cn(
                          "h-8 border-b border-border/50",
                          row.getIsGrouped() && "bg-muted/40 font-medium",
                          onRowClick && !row.getIsGrouped() && "cursor-pointer hover:bg-muted/50",
                        )}
                        style={{ height: ROW_HEIGHT }}
                        onClick={
                          onRowClick && !row.getIsGrouped()
                            ? () => onRowClick(row.original)
                            : undefined
                        }
                      >

                        {row.getVisibleCells().map((cell) => {
                          const isGrouped = cell.getIsGrouped();
                          const isAggregated = cell.getIsAggregated();
                          const isPlaceholder = cell.getIsPlaceholder();
                          return (
                            <TableCell
                              key={cell.id}
                              style={{ width: cell.column.getSize() }}
                              className="h-8 overflow-hidden whitespace-nowrap px-2 py-1 align-middle"
                            >
                              {isGrouped ? (
                                <button
                                  type="button"
                                  onClick={row.getToggleExpandedHandler()}
                                  className="flex items-center gap-1 text-left hover:text-primary"
                                  style={{ paddingLeft: `${row.depth * 12}px` }}
                                >
                                  {row.getIsExpanded() ? (
                                    <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                                  ) : (
                                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                                  )}
                                  <span className="truncate">
                                    {String(cell.getValue() ?? "—")}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    ({row.subRows.length})
                                  </span>
                                </button>
                              ) : isAggregated ? (
                                flexRender(
                                  cell.column.columnDef.aggregatedCell ??
                                    cell.column.columnDef.cell,
                                  cell.getContext(),
                                )
                              ) : isPlaceholder ? null : (
                                flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext(),
                                )
                              )}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                  {paddingBottom > 0 && (
                    <tr aria-hidden style={{ height: paddingBottom }}>
                      <td colSpan={visibleColCount} className="p-0" />
                    </tr>
                  )}
                </>
              )}
            </TableBody>
            <DataGridFooter table={table} />


          </Table>
        </div>
      </div>
    </div>
  );
}
