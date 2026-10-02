"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn";
import { DealCard } from "./DealCard";
import { toast } from "sonner";
import type { PipelineColumn } from "@/types";
import type { PipelineFilters, PipelineSort } from "./types";
import { applyFilters, applySort } from "./filterSort";

interface KanbanBoardProps {
  initialColumns: PipelineColumn[];
  filters?: PipelineFilters;
  sort?: PipelineSort;
}

export function KanbanBoard({ initialColumns, filters, sort }: KanbanBoardProps) {
  const [columns, setColumns] = useState(initialColumns);
  const [activeId, setActiveId] = useState<string | null>(null);
  const columnsSnapshot = useRef<PipelineColumn[]>(initialColumns);

  // Sync local state when server data changes (pipeline switch / refresh)
  useEffect(() => {
    setColumns(initialColumns);
    columnsSnapshot.current = initialColumns;
  }, [initialColumns]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const viewColumns = useMemo(
    () =>
      columns.map((col) => {
        const filtered = applyFilters(col.deals, filters);
        const sorted = applySort(filtered, sort);
        return { ...col, deals: sorted };
      }),
    [columns, filters, sort]
  );

  const activeDeal = activeId
    ? columns.flatMap((col) => col.deals).find((d) => d.id === activeId)
    : null;

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
      columnsSnapshot.current = columns;
    },
    [columns]
  );

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      const activeColumn = columns.find((col) =>
        col.deals.some((d) => d.id === activeId)
      );
      const overColumn =
        columns.find((col) => col.id === overId) ||
        columns.find((col) => col.deals.some((d) => d.id === overId));

      if (!activeColumn || !overColumn || activeColumn.id === overColumn.id)
        return;

      setColumns((prev) => {
        const activeDeal = activeColumn.deals.find((d) => d.id === activeId);
        if (!activeDeal) return prev;

        return prev.map((col) => {
          if (col.id === activeColumn.id) {
            return {
              ...col,
              deals: col.deals.filter((d) => d.id !== activeId),
            };
          }
          if (col.id === overColumn.id) {
            return {
              ...col,
              deals: [...col.deals, { ...activeDeal, stageId: col.id }],
            };
          }
          return col;
        });
      });
    },
    [columns]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over) return;

      const activeId = active.id as string;
      const overColumn =
        columns.find((col) => col.id === over.id) ||
        columns.find((col) => col.deals.some((d) => d.id === over.id));

      if (!overColumn) return;

      try {
        const res = await fetch("/api/pipeline", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dealId: activeId,
            stageId: overColumn.id,
          }),
        });
        if (!res.ok) {
          throw new Error("API error");
        }
      } catch {
        setColumns(columnsSnapshot.current);
        toast.error("Error al mover el deal. Se revirtio el cambio.");
      }
    },
    [columns]
  );

  if (viewColumns.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        Este pipeline no tiene etapas. Abri{" "}
        <span className="font-medium">Editar pipeline</span> para crear la primera.
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full min-w-0 overflow-x-auto pb-4">
        <div className="flex gap-3 w-max">
        {viewColumns.map((column) => (
          <KanbanColumn
            key={column.id}
            id={column.id}
            name={column.name}
            color={column.color}
            deals={column.deals.map((d) => ({
              id: d.id,
              title: d.title,
              value: d.value,
              contactName: d.contactName || (d.contact?.name ?? null),
              probability: d.probability,
              docCount: d.docCount,
            }))}
          />
        ))}
        </div>
      </div>

      <DragOverlay>
        {activeDeal ? (
          <DealCard
            id={activeDeal.id}
            title={activeDeal.title}
            value={activeDeal.value}
            contactName={
              activeDeal.contactName || (activeDeal.contact?.name ?? null)
            }
            probability={activeDeal.probability}
            docCount={activeDeal.docCount}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
