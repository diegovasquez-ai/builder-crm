"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Pipeline, PipelineStage } from "@/types";

interface PipelineEditorProps {
  open: boolean;
  onClose: () => void;
  pipeline: Pipeline;
  dealsByStage: Record<string, number>;
  otherPipelines: Pipeline[];
  onPipelineDeleted: () => void;
}

export function PipelineEditor({
  open,
  onClose,
  pipeline,
  dealsByStage,
  otherPipelines,
  onPipelineDeleted,
}: PipelineEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(pipeline.name);
  const [stages, setStages] = useState<PipelineStage[]>(() =>
    [...pipeline.stages].sort((a, b) => a.order - b.order)
  );
  const stagesSnapshot = useRef<PipelineStage[]>(stages);
  const [moveDialog, setMoveDialog] = useState<{
    stage: PipelineStage;
    targetStageId: string;
  } | null>(null);

  // Sync when pipeline prop changes (refresh / switch)
  useEffect(() => {
    setName(pipeline.name);
    const sorted = [...pipeline.stages].sort((a, b) => a.order - b.order);
    setStages(sorted);
    stagesSnapshot.current = sorted;
  }, [pipeline]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 4 },
    })
  );

  const handleRenamePipeline = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === pipeline.name) return;
    try {
      const res = await fetch(`/api/pipelines/${pipeline.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      toast.success("Pipeline renombrado");
      router.refresh();
    } catch {
      toast.error("No se pudo renombrar");
      setName(pipeline.name);
    }
  };

  const handleDeletePipeline = async () => {
    if (!confirm(`¿Borrar el pipeline "${pipeline.name}"?`)) return;
    try {
      const res = await fetch(`/api/pipelines/${pipeline.id}`, {
        method: "DELETE",
      });
      if (res.status === 409) {
        const body = (await res.json()) as { dealCount?: number };
        toast.error(
          `No se puede borrar: tiene ${body.dealCount ?? 0} deals. Movélos primero.`
        );
        return;
      }
      if (!res.ok) throw new Error();
      toast.success("Pipeline borrado");
      onPipelineDeleted();
      router.refresh();
    } catch {
      toast.error("No se pudo borrar");
    }
  };

  const handleStageRename = async (stage: PipelineStage, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === stage.name) return;
    try {
      const res = await fetch(`/api/stages/${stage.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("No se pudo renombrar la etapa");
    }
  };

  const handleAddStage = async () => {
    try {
      const res = await fetch("/api/stages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: pipeline.id,
          name: "Nueva etapa",
        }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("No se pudo agregar la etapa");
    }
  };

  const handleDeleteStage = async (stage: PipelineStage) => {
    try {
      const res = await fetch(`/api/stages/${stage.id}`, { method: "DELETE" });
      if (res.status === 409) {
        const targetCandidate = stages.find((s) => s.id !== stage.id);
        if (!targetCandidate) {
          toast.error("No hay otra etapa donde mover los deals");
          return;
        }
        setMoveDialog({ stage, targetStageId: targetCandidate.id });
        return;
      }
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      toast.error("No se pudo borrar la etapa");
    }
  };

  const confirmMoveAndDelete = async () => {
    if (!moveDialog) return;
    const { stage, targetStageId } = moveDialog;
    try {
      // Move all deals to target stage via /api/pipeline (one PUT per deal would be too chatty;
      // but with current API we have to). Fetch deals first.
      const dealsRes = await fetch("/api/deals");
      if (!dealsRes.ok) throw new Error("fetch deals");
      const allDeals = (await dealsRes.json()) as Array<{
        id: string;
        stageId: string;
      }>;
      const toMove = allDeals.filter((d) => d.stageId === stage.id);
      await Promise.all(
        toMove.map((d) =>
          fetch("/api/pipeline", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dealId: d.id, stageId: targetStageId }),
          })
        )
      );

      const res = await fetch(`/api/stages/${stage.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success(`Etapa borrada y ${toMove.length} deals movidos`);
      setMoveDialog(null);
      router.refresh();
    } catch {
      toast.error("No se pudo mover y borrar");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = stages.findIndex((s) => s.id === active.id);
    const newIndex = stages.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(stages, oldIndex, newIndex);
    stagesSnapshot.current = stages;
    setStages(reordered);

    try {
      const res = await fetch("/api/stages/reorder", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: pipeline.id,
          stageIds: reordered.map((s) => s.id),
        }),
      });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setStages(stagesSnapshot.current);
      toast.error("No se pudo reordenar");
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-md flex flex-col gap-0">
          <SheetHeader>
            <SheetTitle>Editar pipeline</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="pipeline-name" className="text-xs">
                Nombre del pipeline
              </Label>
              <div className="flex gap-2">
                <Input
                  id="pipeline-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleRenamePipeline}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                  }}
                />
                {otherPipelines.length > 0 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleDeletePipeline}
                    aria-label="Borrar pipeline"
                    className="text-destructive hover:text-destructive cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              {otherPipelines.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No podés borrar el último pipeline.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Etapas</Label>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={stages.map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1.5">
                    {stages.map((stage) => (
                      <SortableStageRow
                        key={stage.id}
                        stage={stage}
                        dealCount={dealsByStage[stage.id] ?? 0}
                        onRename={(name) => handleStageRename(stage, name)}
                        onDelete={() => handleDeleteStage(stage)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              <Button
                variant="outline"
                size="sm"
                onClick={handleAddStage}
                className="w-full cursor-pointer mt-2"
              >
                <Plus className="h-3.5 w-3.5" />
                Agregar etapa
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={moveDialog !== null}
        onOpenChange={(v) => !v && setMoveDialog(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mover deals antes de borrar</DialogTitle>
          </DialogHeader>
          {moveDialog && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                La etapa <span className="font-medium">{moveDialog.stage.name}</span>{" "}
                tiene {dealsByStage[moveDialog.stage.id] ?? 0} deal(s). Elegí
                a qué etapa moverlos:
              </p>
              <Select
                value={moveDialog.targetStageId}
                onValueChange={(v) =>
                  v &&
                  setMoveDialog((prev) =>
                    prev ? { ...prev, targetStageId: v } : prev
                  )
                }
              >
                <SelectTrigger className="cursor-pointer">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {stages
                    .filter((s) => s.id !== moveDialog.stage.id)
                    .map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setMoveDialog(null)}
                  className="cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={confirmMoveAndDelete}
                  className="cursor-pointer"
                >
                  Mover y borrar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

interface SortableStageRowProps {
  stage: PipelineStage;
  dealCount: number;
  onRename: (name: string) => void;
  onDelete: () => void;
}

function SortableStageRow({
  stage,
  dealCount,
  onRename,
  onDelete,
}: SortableStageRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: stage.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-2"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        aria-label="Reordenar"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className="h-2.5 w-2.5 rounded-full shrink-0"
        style={{ backgroundColor: stage.color }}
        aria-hidden
      />
      <Input
        key={stage.id + "-" + stage.name}
        defaultValue={stage.name}
        onBlur={(e) => onRename(e.currentTarget.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="h-8 border-transparent bg-transparent px-2 hover:border-border/60 focus-visible:border-border"
      />
      <span
        className={cn(
          "text-[10px] tabular-nums shrink-0",
          dealCount > 0 ? "text-muted-foreground" : "text-muted-foreground/50"
        )}
      >
        {dealCount}
      </span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onDelete}
        aria-label="Borrar etapa"
        className="text-muted-foreground hover:text-destructive cursor-pointer"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
