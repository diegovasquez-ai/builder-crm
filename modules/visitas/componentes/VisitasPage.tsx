"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, MapPin, Phone, CalendarClock, Pencil, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { VisitForm } from "./VisitForm";
import { API_VISITAS, ETIQUETA_ESTADO, type Visita, type EstadoVisita, type VisitaConContacto } from "../tipos";

const STATUS_BADGE: Record<EstadoVisita, string> = {
  coordinating: "bg-amber-50 text-amber-700 border-amber-200",
  scheduled: "bg-emerald-50 text-emerald-700 border-emerald-200",
  completed: "bg-sky-50 text-sky-700 border-sky-200",
  cancelled: "bg-rose-50 text-rose-700 border-rose-200",
};

function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "Sin fecha";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "Sin fecha";
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

export function VisitasPage() {
  const [visits, setVisits] = useState<VisitaConContacto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Visita | null>(null);
  const [defaultStatus, setDefaultStatus] = useState<EstadoVisita>("coordinating");

  // `reloadKey` dispara la carga; `load()` solo se llama desde handlers de eventos.
  const [reloadKey, setReloadKey] = useState(0);
  const load = useCallback(() => {
    setLoading(true);
    setReloadKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let active = true;
    fetch(API_VISITAS)
      .then((r) => r.json())
      .then((data: VisitaConContacto[]) => {
        if (!active) return;
        setVisits(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const handleClose = () => {
    setShowForm(false);
    setEditing(null);
    load();
  };

  const updateStatus = async (id: string, status: EstadoVisita) => {
    const res = await fetch(`${API_VISITAS}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      toast.success("Visita actualizada");
      load();
    } else {
      toast.error("Error al actualizar");
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Eliminar esta visita?")) return;
    const res = await fetch(`${API_VISITAS}/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Visita eliminada");
      load();
    } else {
      toast.error("Error al eliminar");
    }
  };

  const coordinated = visits.filter((v) => v.status === "scheduled");
  const inProcess = visits.filter((v) => v.status === "coordinating");
  const past = visits.filter((v) => v.status === "completed" || v.status === "cancelled");

  const abrirNueva = () => {
    setEditing(null);
    setDefaultStatus("coordinating");
    setShowForm(true);
  };

  return (
    <div>
      <PageHeader
        title="Visitas"
        subtitle="Visitas coordinadas y en proceso"
        actions={
          <Button onClick={abrirNueva} className="cursor-pointer">
            <Plus className="h-4 w-4" />
            Nueva visita
          </Button>
        }
      />

      <VisitForm open={showForm} onClose={handleClose} visit={editing} defaultStatus={defaultStatus} />

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          <VisitSection
            title="Visitas coordinadas"
            description="Con fecha y hora confirmada"
            count={coordinated.length}
            visits={coordinated}
            emptyText="No hay visitas coordinadas"
            onEdit={(v) => {
              setEditing(v);
              setShowForm(true);
            }}
            onMarkCompleted={(id) => updateStatus(id, "completed")}
            onCancel={(id) => updateStatus(id, "cancelled")}
            onRemove={remove}
            showQuickActions
          />

          <VisitSection
            title="En proceso de coordinacion"
            description="Pendientes de confirmar fecha con el cliente"
            count={inProcess.length}
            visits={inProcess}
            emptyText="No hay visitas en coordinacion"
            onEdit={(v) => {
              setEditing(v);
              setShowForm(true);
            }}
            onConfirm={(v) => {
              setEditing(v);
              setDefaultStatus("scheduled");
              setShowForm(true);
            }}
            onRemove={remove}
            actionAddNew={abrirNueva}
          />

          {past.length > 0 && (
            <VisitSection
              title="Historial"
              description="Visitas realizadas o canceladas"
              count={past.length}
              visits={past}
              emptyText=""
              onEdit={(v) => {
                setEditing(v);
                setShowForm(true);
              }}
              onRemove={remove}
              muted
            />
          )}
        </div>
      )}
    </div>
  );
}

interface SectionProps {
  title: string;
  description: string;
  count: number;
  visits: VisitaConContacto[];
  emptyText: string;
  onEdit: (v: Visita) => void;
  onMarkCompleted?: (id: string) => void;
  onCancel?: (id: string) => void;
  onConfirm?: (v: Visita) => void;
  onRemove: (id: string) => void;
  showQuickActions?: boolean;
  actionAddNew?: () => void;
  muted?: boolean;
}

function VisitSection({ title, description, count, visits, emptyText, onEdit, onMarkCompleted, onCancel, onConfirm, onRemove, showQuickActions, actionAddNew, muted }: SectionProps) {
  return (
    <Card className={cn("surface-card", muted && "opacity-90")}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base font-semibold tracking-tight font-heading flex items-center gap-2">
            {title}
            <Badge variant="secondary" className="text-[10.5px] h-5">
              {count}
            </Badge>
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
        {actionAddNew && (
          <Button variant="outline" size="sm" onClick={actionAddNew} className="cursor-pointer">
            <Plus className="h-3.5 w-3.5" />
            Agregar
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {visits.length === 0 ? (
          emptyText ? <EmptyState icon={CalendarClock} title={emptyText} description="Las visitas que crees apareceran aqui." /> : null
        ) : (
          <div className="space-y-2">
            {visits.map((v) => (
              <VisitRow
                key={v.id}
                visit={v}
                onEdit={() => onEdit(v)}
                onMarkCompleted={onMarkCompleted ? () => onMarkCompleted(v.id) : undefined}
                onCancel={onCancel ? () => onCancel(v.id) : undefined}
                onConfirm={onConfirm ? () => onConfirm(v) : undefined}
                onRemove={() => onRemove(v.id)}
                showQuickActions={showQuickActions}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VisitRow({ visit, onEdit, onMarkCompleted, onCancel, onConfirm, onRemove, showQuickActions }: {
  visit: VisitaConContacto;
  onEdit: () => void;
  onMarkCompleted?: () => void;
  onCancel?: () => void;
  onConfirm?: () => void;
  onRemove: () => void;
  showQuickActions?: boolean;
}) {
  const status = visit.status;
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-card hover:bg-muted/30 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium truncate">{visit.contactName || "Sin contacto"}</span>
          <span className={cn("text-[10.5px] px-1.5 py-0.5 rounded border font-medium", STATUS_BADGE[status])}>{ETIQUETA_ESTADO[status]}</span>
        </div>
        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          {visit.propertyAddress && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {visit.propertyAddress}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            {formatDateTime(visit.scheduledAt)}
          </span>
          {visit.contactPhone && (
            <span className="inline-flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {visit.contactPhone}
            </span>
          )}
        </div>
        {visit.notes && <p className="mt-1 text-xs text-muted-foreground/90 line-clamp-2">{visit.notes}</p>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onConfirm && (
          <Button size="sm" variant="outline" onClick={onConfirm} className="cursor-pointer h-8">
            <CalendarClock className="h-3.5 w-3.5" />
            Confirmar fecha
          </Button>
        )}
        {showQuickActions && onMarkCompleted && (
          <Button size="sm" variant="ghost" onClick={onMarkCompleted} title="Marcar como realizada" className="cursor-pointer h-8 w-8 p-0">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </Button>
        )}
        {showQuickActions && onCancel && (
          <Button size="sm" variant="ghost" onClick={onCancel} title="Cancelar" className="cursor-pointer h-8 w-8 p-0">
            <XCircle className="h-4 w-4 text-rose-600" />
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onEdit} title="Editar" className="cursor-pointer h-8 w-8 p-0">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onRemove} title="Eliminar" className="cursor-pointer h-8 w-8 p-0 text-destructive hover:text-destructive">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
