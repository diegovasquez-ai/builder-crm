"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import { KanbanBoard } from "./KanbanBoard";
import { PipelineHeader } from "./PipelineHeader";
import { PipelineToolbar } from "./PipelineToolbar";
import { PipelineEditor } from "./PipelineEditor";
import { DealsListView } from "./DealsListView";
import { DEFAULT_FILTERS, DEFAULT_SORT } from "./types";
import type { PipelineFilters, PipelineSort } from "./types";
import { applyFilters, applySort } from "./filterSort";
import type { Pipeline, PipelineColumn, DealWithContact } from "@/types";

interface PipelineWorkspaceProps {
  pipelines: Pipeline[];
  deals: DealWithContact[];
}

const STORAGE_KEY = "propcrm:selectedPipelineId";

function subscribeToStorage(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function PipelineWorkspace({ pipelines, deals }: PipelineWorkspaceProps) {
  const storedId = useSyncExternalStore(
    subscribeToStorage,
    () => (typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null),
    () => null
  );
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [filters, setFilters] = useState<PipelineFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<PipelineSort>(DEFAULT_SORT);
  const [editorOpen, setEditorOpen] = useState(false);

  const validStoredId =
    storedId && pipelines.some((p) => p.id === storedId) ? storedId : null;
  const selectedPipelineId =
    overrideId ?? validStoredId ?? pipelines[0]?.id ?? null;

  const setSelectedPipelineId = (id: string) => {
    setOverrideId(id);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, id);
    }
  };

  const selectedPipeline = useMemo(
    () => pipelines.find((p) => p.id === selectedPipelineId) ?? null,
    [pipelines, selectedPipelineId]
  );

  const columns: PipelineColumn[] = useMemo(() => {
    if (!selectedPipeline) return [];
    return selectedPipeline.stages
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((stage) => ({
        ...stage,
        deals: deals.filter((d) => d.stageId === stage.id),
      }));
  }, [selectedPipeline, deals]);

  const allPipelineDeals = useMemo(
    () => columns.flatMap((c) => c.deals),
    [columns]
  );

  const visibleDeals = useMemo(
    () => applySort(applyFilters(allPipelineDeals, filters), sort),
    [allPipelineDeals, filters, sort]
  );

  if (pipelines.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        No hay pipelines configurados. Recargá la página después de aplicar la migración.
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
      <div className="sticky top-0 z-20 bg-background -mt-6 md:-mt-8 lg:-mt-10 pt-3 pb-2.5 border-b border-border/60 mb-4 space-y-2.5">
        <PipelineHeader
          pipelines={pipelines}
          selectedPipelineId={selectedPipelineId}
          onSelect={setSelectedPipelineId}
          dealCount={allPipelineDeals.length}
          view={view}
          onViewChange={setView}
          onOpenEditor={() => setEditorOpen(true)}
        />
        <PipelineToolbar
          filters={filters}
          onFiltersChange={setFilters}
          sort={sort}
          onSortChange={setSort}
        />
      </div>

      {view === "kanban" ? (
        <KanbanBoard initialColumns={columns} filters={filters} sort={sort} />
      ) : (
        <DealsListView deals={visibleDeals} stages={selectedPipeline?.stages ?? []} />
      )}

      {selectedPipeline && (
        <PipelineEditor
          open={editorOpen}
          onClose={() => setEditorOpen(false)}
          pipeline={selectedPipeline}
          dealsByStage={Object.fromEntries(
            columns.map((c) => [c.id, c.deals.length])
          )}
          otherPipelines={pipelines.filter((p) => p.id !== selectedPipeline.id)}
          onPipelineDeleted={() => {
            const next = pipelines.find((p) => p.id !== selectedPipeline.id);
            if (next) setSelectedPipelineId(next.id);
            setEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}
