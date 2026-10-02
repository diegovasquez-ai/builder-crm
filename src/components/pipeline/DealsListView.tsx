"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/constants";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DealWithContact, PipelineStage } from "@/types";

interface DealsListViewProps {
  deals: DealWithContact[];
  stages: PipelineStage[];
}

export function DealsListView({ deals, stages }: DealsListViewProps) {
  const stageById = new Map(stages.map((s) => [s.id, s]));

  if (deals.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
        No hay deals en este pipeline.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Título</TableHead>
            <TableHead>Contacto</TableHead>
            <TableHead>Etapa</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="text-right">Probabilidad</TableHead>
            <TableHead>Creado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {deals.map((d) => {
            const stage = stageById.get(d.stageId);
            return (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.title}</TableCell>
                <TableCell className="text-muted-foreground">
                  {d.contactName || d.contact?.name || "—"}
                </TableCell>
                <TableCell>
                  {stage && (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: stage.color }}
                        aria-hidden
                      />
                      <span className="text-xs">{stage.name}</span>
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium">
                  {formatCurrency(d.value)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {d.probability}%
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {d.createdAt
                    ? format(new Date(d.createdAt), "d MMM yyyy", { locale: es })
                    : "—"}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
