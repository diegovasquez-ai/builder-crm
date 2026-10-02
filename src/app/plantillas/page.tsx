"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  RefreshCw,
  FileText,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { CreateTemplateDialog } from "@/components/whatsapp/CreateTemplateDialog";
import { getBodyText, extractVariables } from "@/lib/whatsapp-templates";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Template {
  id: string;
  name: string;
  language: string;
  category: string;
  components: unknown;
  status: string;
  metaTemplateId: string | null;
}

const STATUS_META: Record<
  string,
  { label: string; badge: string; icon: typeof CheckCircle2 }
> = {
  APPROVED: {
    label: "Aprobada",
    badge: "bg-emerald-50 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  PENDING: {
    label: "En revision",
    badge: "bg-amber-50 text-amber-700 border-amber-200",
    icon: Clock,
  },
  REJECTED: {
    label: "Rechazada",
    badge: "bg-rose-50 text-rose-700 border-rose-200",
    icon: XCircle,
  },
};

function statusInfo(status: string) {
  return (
    STATUS_META[status?.toUpperCase()] ?? {
      label: status || "Desconocido",
      badge: "bg-muted text-muted-foreground border-border",
      icon: Clock,
    }
  );
}

export default function PlantillasPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async (sync = false) => {
    if (sync) setSyncing(true);
    else setLoading(true);
    try {
      const res = await fetch(
        `/api/whatsapp/templates${sync ? "?sync=1" : ""}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      setTemplates(json.templates || []);
      if (json.syncError) {
        toast.error("No se pudo sincronizar con Meta", {
          description: json.syncError,
          duration: 8000,
        });
      } else if (sync) {
        toast.success("Estados sincronizados con Meta");
      }
    } catch {
      toast.error("Error al cargar plantillas");
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader
        title="Plantillas de WhatsApp"
        subtitle="Mensajes preaprobados por Meta para escribir fuera de la ventana de 24h"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => load(true)}
              disabled={syncing || loading}
              className="cursor-pointer"
            >
              <RefreshCw
                className={cn("h-4 w-4", syncing && "animate-spin")}
              />
              Sincronizar
            </Button>
            <Button
              onClick={() => setShowForm(true)}
              className="cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Nueva plantilla
            </Button>
          </div>
        }
      />

      <CreateTemplateDialog
        open={showForm}
        onClose={() => setShowForm(false)}
        onCreated={() => load()}
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Todavia no hay plantillas"
          description="Crea tu primera plantilla. Meta la revisa y, una vez aprobada, vas a poder enviarla desde cualquier conversacion."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template }: { template: Template }) {
  const info = statusInfo(template.status);
  const body = getBodyText(template.components);
  const varCount = extractVariables(body).length;
  const Icon = info.icon;

  return (
    <Card className="surface-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-tight truncate font-mono">
              {template.name}
            </p>
            <p className="mt-0.5 text-[11px] text-muted-foreground uppercase tracking-wide">
              {template.category} · {template.language}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex items-center gap-1 shrink-0 text-[10.5px] px-2 py-0.5 rounded-full border font-medium",
              info.badge
            )}
          >
            <Icon className="h-3 w-3" />
            {info.label}
          </span>
        </div>

        <p className="text-[13px] text-foreground/90 leading-relaxed whitespace-pre-wrap line-clamp-4">
          {body || (
            <span className="italic text-muted-foreground">(sin cuerpo)</span>
          )}
        </p>

        {varCount > 0 && (
          <p className="text-[11px] text-muted-foreground">
            {varCount} variable{varCount > 1 ? "s" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
