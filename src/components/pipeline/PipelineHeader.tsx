"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, LayoutGrid, List, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Pipeline } from "@/types";

interface PipelineHeaderProps {
  pipelines: Pipeline[];
  selectedPipelineId: string | null;
  onSelect: (id: string) => void;
  dealCount: number;
  view: "kanban" | "list";
  onViewChange: (view: "kanban" | "list") => void;
  onOpenEditor: () => void;
}

export function PipelineHeader({
  pipelines,
  selectedPipelineId,
  onSelect,
  dealCount,
  view,
  onViewChange,
  onOpenEditor,
}: PipelineHeaderProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const selected =
    pipelines.find((p) => p.id === selectedPipelineId) ?? pipelines[0] ?? null;

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Nombre requerido");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/pipelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("error");
      const created = (await res.json()) as { id: string };
      toast.success("Pipeline creado");
      setNewName("");
      setCreateOpen(false);
      router.refresh();
      // Select after refresh
      setTimeout(() => onSelect(created.id), 0);
    } catch {
      toast.error("No se pudo crear el pipeline");
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button className="flex items-center gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm font-medium hover:bg-muted/40 transition-colors cursor-pointer min-w-50" />
              }
            >
              <span className="truncate flex-1 text-left">
                {selected?.name ?? "Sin pipeline"}
              </span>
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-60">
              {pipelines.map((p) => (
                <DropdownMenuItem
                  key={p.id}
                  onClick={() => onSelect(p.id)}
                  className={cn(
                    "cursor-pointer",
                    p.id === selected?.id && "bg-muted/60"
                  )}
                >
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.isDefault && (
                    <span className="text-[10px] text-muted-foreground">
                      default
                    </span>
                  )}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => setCreateOpen(true)}
                className="cursor-pointer text-primary"
              >
                <Plus className="h-4 w-4" />
                Crear pipeline nuevo
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <span className="text-sm text-muted-foreground tabular-nums">
            {dealCount} {dealCount === 1 ? "oportunidad" : "oportunidades"}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex rounded-lg border border-border/60 bg-card p-0.5">
            <button
              type="button"
              onClick={() => onViewChange("kanban")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer",
                view === "kanban"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Vista kanban"
              title="Kanban"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onViewChange("list")}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-colors cursor-pointer",
                view === "list"
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="Vista lista"
              title="Lista"
            >
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={onOpenEditor}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-card text-muted-foreground hover:bg-muted/40 hover:text-foreground transition-colors cursor-pointer"
            aria-label="Editar pipeline"
            title="Editar pipeline"
          >
            <Settings2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <Dialog open={createOpen} onOpenChange={(v) => !v && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Crear pipeline nuevo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="new-pipeline-name">Nombre</Label>
              <Input
                id="new-pipeline-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ej: Funnel redes sociales"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Se creará con etapas por defecto: Prospecto · Contactado · Propuesta · Negociación · Cerrado Ganado · Cerrado Perdido.
              </p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setCreateOpen(false)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleCreate}
                disabled={creating}
                className="cursor-pointer"
              >
                {creating ? "Creando..." : "Crear"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
