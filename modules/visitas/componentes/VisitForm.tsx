"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { API_VISITAS, type Visita, type EstadoVisita } from "../tipos";

const visitSchema = z
  .object({
    contactId: z.string().min(1, "El contacto es requerido"),
    propertyAddress: z.string(),
    status: z.enum(["coordinating", "scheduled", "completed", "cancelled"]),
    scheduledAt: z.string(),
    durationMinutes: z.number().int().min(15).max(480),
    notes: z.string(),
  })
  .refine((d) => d.status !== "scheduled" || d.scheduledAt.length > 0, {
    message: "Una visita coordinada requiere fecha y hora",
    path: ["scheduledAt"],
  });

type VisitFormData = z.infer<typeof visitSchema>;

interface VisitFormProps {
  open: boolean;
  onClose: () => void;
  visit?: Visita | null;
  preselectedContactId?: string;
  defaultStatus?: EstadoVisita;
}

function toLocalInputValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function VisitForm({ open, onClose, visit, preselectedContactId, defaultStatus = "coordinating" }: VisitFormProps) {
  const [contactsList, setContacts] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (open) {
      fetch("/api/contacts")
        .then((r) => r.json())
        .then(setContacts)
        .catch(() => {});
    }
  }, [open]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VisitFormData>({
    resolver: zodResolver(visitSchema),
    defaultValues: {
      contactId: visit?.contactId || preselectedContactId || "",
      propertyAddress: visit?.propertyAddress || "",
      status: visit?.status || defaultStatus,
      scheduledAt: toLocalInputValue(visit?.scheduledAt),
      durationMinutes: visit?.durationMinutes || 60,
      notes: visit?.notes || "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        contactId: visit?.contactId || preselectedContactId || "",
        propertyAddress: visit?.propertyAddress || "",
        status: visit?.status || defaultStatus,
        scheduledAt: toLocalInputValue(visit?.scheduledAt),
        durationMinutes: visit?.durationMinutes || 60,
        notes: visit?.notes || "",
      });
    }
  }, [open, visit, preselectedContactId, defaultStatus, reset]);

  const status = watch("status");

  const onSubmit = async (data: VisitFormData) => {
    try {
      const payload = {
        contactId: data.contactId,
        propertyAddress: data.propertyAddress || null,
        status: data.status,
        scheduledAt: data.scheduledAt ? new Date(data.scheduledAt).toISOString() : null,
        durationMinutes: data.durationMinutes,
        notes: data.notes || null,
      };
      const url = visit ? `${API_VISITAS}/${visit.id}` : API_VISITAS;
      const res = await fetch(url, {
        method: visit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error");
      }
      toast.success(visit ? "Visita actualizada" : "Visita registrada");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{visit ? "Editar visita" : "Nueva visita"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label>Estado</Label>
            <Select value={status} onValueChange={(v) => v && setValue("status", v as VisitFormData["status"])}>
              <SelectTrigger className="cursor-pointer">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="coordinating">En proceso de coordinacion</SelectItem>
                <SelectItem value="scheduled">Coordinada</SelectItem>
                <SelectItem value="completed">Realizada</SelectItem>
                <SelectItem value="cancelled">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!preselectedContactId && (
            <div className="space-y-2">
              <Label>Contacto *</Label>
              <Select value={watch("contactId")} onValueChange={(v) => v && setValue("contactId", v)}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Seleccionar contacto" />
                </SelectTrigger>
                <SelectContent>
                  {contactsList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.contactId && <p className="text-xs text-destructive">{errors.contactId.message}</p>}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="visit-address">Direccion / lugar</Label>
            <Input id="visit-address" {...register("propertyAddress")} placeholder="Ej: Av. Principal 1234, depto 502" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="visit-date">Fecha y hora{status === "scheduled" ? " *" : ""}</Label>
              <Input id="visit-date" type="datetime-local" {...register("scheduledAt")} />
              {errors.scheduledAt && <p className="text-xs text-destructive">{errors.scheduledAt.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="visit-duration">Duracion (min)</Label>
              <Input id="visit-duration" type="number" min={15} max={480} step={15} {...register("durationMinutes", { valueAsNumber: true })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visit-notes">Notas</Label>
            <Textarea id="visit-notes" {...register("notes")} placeholder="Detalles adicionales, preferencias del cliente..." rows={3} />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose} className="cursor-pointer">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="cursor-pointer">
              {isSubmitting ? "Guardando..." : visit ? "Actualizar" : "Crear"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
