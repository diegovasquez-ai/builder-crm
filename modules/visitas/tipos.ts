export type EstadoVisita = "coordinating" | "scheduled" | "completed" | "cancelled";

export interface Visita {
  id: string;
  contactId: string;
  dealId: string | null;
  propertyAddress: string | null;
  status: EstadoVisita;
  scheduledAt: Date | string | null;
  durationMinutes: number;
  notes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface VisitaConContacto extends Visita {
  contactName: string | null;
  contactPhone: string | null;
}

export const ESTADOS_VISITA: EstadoVisita[] = ["coordinating", "scheduled", "completed", "cancelled"];

export const ETIQUETA_ESTADO: Record<EstadoVisita, string> = {
  coordinating: "En coordinacion",
  scheduled: "Coordinada",
  completed: "Realizada",
  cancelled: "Cancelada",
};

/** Ruta de la API del modulo (catch-all /api/m/<modulo>). */
export const API_VISITAS = "/api/m/visitas";
