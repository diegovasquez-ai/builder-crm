"use client";

import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DealCard } from "./DealCard";
import { formatCurrency } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface Deal {
  id: string;
  title: string;
  value: number;
  contactName: string | null;
  probability: number;
  docCount?: number;
}

interface KanbanColumnProps {
  id: string;
  name: string;
  color: string;
  deals: Deal[];
}

export function KanbanColumn({ id, name, color, deals }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col w-65 shrink-0 rounded-xl border border-border/60 bg-card transition-colors",
        isOver && "border-primary/50 bg-primary/5",
      )}
    >
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3.5 py-3 border-b border-border/60 bg-card rounded-t-xl">
        <div
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: color }}
        />
        <h3 className="text-[13px] font-semibold tracking-tight flex-1 truncate">
          {name}
        </h3>
        <span className="text-[10.5px] font-semibold tabular-nums text-muted-foreground bg-muted rounded-full px-1.5 py-0.5">
          {deals.length}
        </span>
      </div>

      <div className="px-3.5 py-2 border-b border-border/60 bg-muted/20">
        <p className="text-[11px] text-muted-foreground tabular-nums">
          <span className="font-semibold text-foreground">
            {formatCurrency(totalValue)}
          </span>{" "}
          en valor total
        </p>
      </div>

      <SortableContext
        items={deals.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex-1 p-2.5 space-y-2 min-h-[200px] max-h-[calc(100vh-260px)] overflow-y-auto">
          {deals.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/60 bg-muted/20 p-4 text-center text-[11px] text-muted-foreground">
              Sin deals en esta etapa
            </div>
          ) : (
            deals.map((deal) => <DealCard key={deal.id} {...deal} />)
          )}
        </div>
      </SortableContext>
    </div>
  );
}
