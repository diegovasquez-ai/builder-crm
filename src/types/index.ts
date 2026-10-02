export type ActivityType = "call" | "email" | "meeting" | "note" | "follow_up";

export type LeadSource =
  | "website"
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "referido"
  | "redes_sociales"
  | "llamada_fria"
  | "email"
  | "formulario"
  | "evento"
  | "import"
  | "webhook"
  | "gohighlevel"
  | "simulador"
  | "otro";

export interface Contact {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: LeadSource;
  score: number;
  notes: string | null;
  tags: string[];
  /** Campos personalizados (config/cliente.ts -> contacto.campos). */
  customFields?: Record<string, unknown> | null;
  /** Resumen del lead escrito por el agente. */
  aiSummary?: string | null;
  aiSummaryAt?: Date | string | null;
  /** Asesor a cargo (team_members.id). null = sin asignar. */
  ownerId?: string | null;
  ownerName?: string | null;
  ownerEmail?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Deal {
  id: string;
  title: string;
  value: number; // in cents
  stageId: string;
  contactId: string;
  expectedClose: Date | null;
  probability: number; // 0-100
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineStage {
  id: string;
  pipelineId: string;
  /** Clave de config/cliente.ts; null si se creo desde la UI. */
  key?: string | null;
  name: string;
  order: number;
  color: string;
  isWon: boolean;
  isLost: boolean;
}

export interface Pipeline {
  id: string;
  name: string;
  isDefault: boolean;
  order: number;
  stages: PipelineStage[];
}

export interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  contactId: string;
  dealId: string | null;
  scheduledAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
}

// API response types
export interface DealWithContact extends Deal {
  contact?: Contact;
  stage?: PipelineStage;
  contactName?: string | null;
  /** Documentos listos en la ficha del contacto (contador del kanban). */
  docCount?: number;
}

export interface ContactWithDeals extends Contact {
  deals?: Deal[];
  activities?: Activity[];
}

export interface PipelineColumn extends PipelineStage {
  deals: DealWithContact[];
}


export interface DashboardStats {
  totalContacts: number;
  activeDeals: number;
  totalPipelineValue: number;
  wonDealsValue: number;
  conversionRate: number;
}
