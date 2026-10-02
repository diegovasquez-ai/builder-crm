"use client";

import { ArrowDownUp, Filter, LayoutGrid, List, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ViewMode = "kanban" | "list";

interface ToolbarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSort?: () => void;
  onFilter?: () => void;
  view?: ViewMode;
  onViewChange?: (view: ViewMode) => void;
  primaryAction?: React.ReactNode;
}

export function Toolbar({
  searchPlaceholder = "Buscar...",
  searchValue,
  onSearchChange,
  onSort,
  onFilter,
  view,
  onViewChange,
  primaryAction,
}: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px] max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          type="search"
          placeholder={searchPlaceholder}
          value={searchValue ?? ""}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="pl-9 h-9 bg-muted/40 border-border/60 text-[13px]"
        />
      </div>

      {onSort && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onSort}
          className="h-9 gap-1.5 cursor-pointer"
        >
          <ArrowDownUp className="h-3.5 w-3.5" />
          Ordenar
        </Button>
      )}

      {onFilter && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onFilter}
          className="h-9 gap-1.5 cursor-pointer"
        >
          <Filter className="h-3.5 w-3.5" />
          Filtros
        </Button>
      )}

      {view !== undefined && onViewChange && (
        <ViewToggle view={view} onChange={onViewChange} />
      )}

      {primaryAction && <div className="ml-auto">{primaryAction}</div>}
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (view: ViewMode) => void;
}) {
  return (
    <div className="inline-flex items-center rounded-md border border-border bg-background p-0.5 h-9">
      <ToggleButton active={view === "kanban"} onClick={() => onChange("kanban")}>
        <LayoutGrid className="h-3.5 w-3.5" />
        Kanban
      </ToggleButton>
      <ToggleButton active={view === "list"} onClick={() => onChange("list")}>
        <List className="h-3.5 w-3.5" />
        Lista
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-2.5 h-full text-[12.5px] font-medium transition-colors cursor-pointer",
        active
          ? "bg-secondary text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
