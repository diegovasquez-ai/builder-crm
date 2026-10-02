"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Kanban,
  Webhook,
  Bell,
  Copy,
  Bot,
  MessageSquare,
  Users,
  Workflow,
} from "lucide-react";
import { toast } from "sonner";
import { NotificationToggle } from "@/components/shared/NotificationToggle";
import { PageHeader } from "@/components/layout/PageHeader";
import { AgentSettings } from "@/components/settings/AgentSettings";
import { ChannelsSettings } from "@/components/settings/ChannelsSettings";
import { TeamSettings } from "@/components/settings/TeamSettings";
import Link from "next/link";
import { PushSettings } from "@/components/settings/PushSettings";

export default function SettingsPage() {
  const [stages, setStages] = useState<
    Array<{ id: string; name: string; color: string; order: number }>
  >([]);

  useEffect(() => {
    fetch("/api/pipeline")
      .then((r) => r.json())
      .then(setStages)
      .catch(() => {});
  }, []);

  return (
    <div>
      <PageHeader
        title="Configuracion"
        subtitle="Canales, equipo, agente y notificaciones"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pipeline stages */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Kanban className="h-4 w-4" />
              Etapas del Pipeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stages.map((stage) => (
                <div
                  key={stage.id}
                  className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                >
                  <div
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-sm flex-1">{stage.name}</span>
                  <Badge variant="outline" className="text-xs">
                    #{stage.order}
                  </Badge>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Las etapas se editan desde el{" "}
              <Link href="/pipeline" className="text-primary hover:underline">
                Pipeline
              </Link>
              .
            </p>
          </CardContent>
        </Card>

        {/* Canales conectados */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Canales
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChannelsSettings />
          </CardContent>
        </Card>

        {/* Equipo */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Equipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TeamSettings />
          </CardContent>
        </Card>

        {/* Automatizaciones: tienen su propia pagina */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Workflow className="h-4 w-4" />
              Automatizaciones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Las reglas, el encendido/apagado y el historial estan en{" "}
              <Link href="/automatizaciones" className="text-primary hover:underline">
                Automatizaciones
              </Link>
              , en el menu lateral.
            </p>
          </CardContent>
        </Card>

        {/* Agente IA */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Agente IA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AgentSettings />
          </CardContent>
        </Card>

        {/* Webhook config */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Webhook className="h-4 w-4" />
              Webhook
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Recibe leads automaticamente desde formularios, landing pages, o cualquier herramienta que soporte webhooks.
            </p>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <code className="flex-1 text-sm bg-muted p-2 rounded font-mono truncate">
                  POST {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/webhooks/leads
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/api/webhooks/leads`
                    );
                    toast.success("URL copiada");
                  }}
                  className="p-2 rounded hover:bg-muted cursor-pointer"
                  title="Copiar URL"
                >
                  <Copy className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-xs font-mono">
                <p className="text-muted-foreground mb-1">Ejemplo:</p>
                <p>curl -X POST {typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"}/api/webhooks/leads \</p>
                <p className="pl-4">-H &quot;Content-Type: application/json&quot; \</p>
                <p className="pl-4">-d &apos;{`{"name":"Juan","email":"j@test.com","phone":"555-1234"}`}&apos;</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Soporta campos en espanol e ingles: name/nombre, email/correo, phone/telefono, company/empresa, notes/notas.
                Si <code className="bg-muted px-1 rounded">LEADS_WEBHOOK_SECRET</code> esta definido, hay que mandarlo en el header{" "}
                <code className="bg-muted px-1 rounded">x-webhook-secret</code>.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notificaciones
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <PushSettings />
            <Separator />
            <NotificationToggle />
            <p className="text-xs text-muted-foreground">
              Lo de arriba son avisos push: llegan al telefono aunque el CRM este cerrado.
              Lo de abajo son las alertas de seguimientos vencidos, que solo funcionan con
              el CRM abierto.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
