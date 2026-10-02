"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bot, ExternalLink, FlaskConical, Loader2, Plus, Send, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { CamposPersonalizadosLista } from "@/components/contacts/CamposPersonalizados";
import { CHANNELS, CHANNEL_LABELS, type Channel } from "@/lib/channels/types";
import { CHANNEL_COLORS, ChannelIcon } from "@/components/icons/channels";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Mensaje {
  id: string;
  direction: "in" | "out";
  body: string | null;
  createdAt: string | Date;
}

interface ResultadoAgente {
  ok: boolean;
  reason?: string;
  reply?: string;
  toolCalls?: number;
}

interface EstadoCrm {
  name: string;
  tags: string[];
  customFields: Record<string, unknown> | null;
  aiSummary: string | null;
  deals: Array<{ id: string; stageId: string; title: string }>;
  activities: Array<{ id: string; description: string; type: string }>;
}

interface Etapa {
  id: string;
  name: string;
  color: string;
}

/**
 * Chat de prueba contra el agente real, sin ningun canal conectado. El operador
 * escribe como cliente; la respuesta vuelve en la misma llamada. Al lado se ve lo que
 * el agente fue cambiando en el CRM (etapa, campos, resumen, actividades).
 */
export function Simulador() {
  const [canal, setCanal] = useState<Channel>("whatsapp");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [contactId, setContactId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [creando, setCreando] = useState(false);
  const [ultimo, setUltimo] = useState<ResultadoAgente | null>(null);
  const [estado, setEstado] = useState<EstadoCrm | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/pipeline")
      .then((r) => r.json())
      .then((data: Etapa[]) => setEtapas(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes.length, ocupado]);

  const cargarEstado = async (id: string) => {
    try {
      const res = await fetch(`/api/contacts/${id}`, { cache: "no-store" });
      if (res.ok) setEstado((await res.json()) as EstadoCrm);
    } catch {
      /* el panel es informativo */
    }
  };

  const nuevaConversacion = async () => {
    setCreando(true);
    try {
      const res = await fetch("/api/simulador/conversaciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canal }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? "No se pudo crear");
      const data = (await res.json()) as { conversationId: string; contactId: string };
      setConversationId(data.conversationId);
      setContactId(data.contactId);
      setMensajes([]);
      setUltimo(null);
      setEstado(null);
      void cargarEstado(data.contactId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setCreando(false);
    }
  };

  const enviar = async () => {
    const t = texto.trim();
    if (!t || !conversationId || ocupado) return;
    setTexto("");
    setOcupado(true);
    setMensajes((prev) => [...prev, { id: `tmp-${Date.now()}`, direction: "in", body: t, createdAt: new Date() }]);
    try {
      const res = await fetch("/api/simulador/mensajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, texto: t }),
      });
      const data = (await res.json()) as { agente?: ResultadoAgente; messages?: Mensaje[]; mensaje?: string; error?: string; estado?: unknown };
      if (!res.ok) throw new Error(data.mensaje ?? data.error ?? "Error");
      setMensajes(data.messages ?? []);
      setUltimo(data.agente ?? null);
      if (data.agente && !data.agente.ok) {
        toast.message(`El agente no respondio: ${data.agente.reason ?? "sin motivo"}`);
      }
      if (contactId) void cargarEstado(contactId);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error");
    } finally {
      setOcupado(false);
    }
  };

  const etapaActual = (() => {
    const deal = estado?.deals?.[0];
    if (!deal) return null;
    return etapas.find((e) => e.id === deal.stageId) ?? null;
  })();

  return (
    <div>
      <PageHeader
        title="Simulador"
        subtitle="Habla con el agente como si fueras un cliente. Nada sale a un canal real."
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2 flex flex-col min-h-[560px]">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />
              Conversacion simulada
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {CHANNELS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCanal(c)}
                    aria-pressed={canal === c}
                    title={CHANNEL_LABELS[c]}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border transition-colors cursor-pointer",
                      canal === c ? "border-primary bg-primary/10" : "border-border bg-muted/40",
                      CHANNEL_COLORS[c]
                    )}
                  >
                    <ChannelIcon channel={c} className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
              <Button size="sm" onClick={nuevaConversacion} disabled={creando} className="cursor-pointer">
                {creando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Nueva conversacion
              </Button>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col gap-3">
            <div className="flex-1 overflow-y-auto rounded-lg border bg-muted/20 p-3 space-y-2 min-h-[380px] max-h-[60vh]">
              {!conversationId ? (
                <p className="text-sm text-muted-foreground text-center py-16">
                  Elegi el canal a simular y crea una conversacion nueva.
                </p>
              ) : mensajes.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-16">
                  Escribi el primer mensaje como si fueras el cliente.
                </p>
              ) : (
                mensajes.map((m) => (
                  <div key={m.id} className={cn("flex", m.direction === "in" ? "justify-end" : "justify-start")}>
                    <div
                      className={cn(
                        "max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-line shadow-xs",
                        m.direction === "in"
                          ? "bg-primary text-primary-foreground rounded-br-sm"
                          : "bg-card border rounded-bl-sm"
                      )}
                    >
                      <span className="mr-1.5 inline-flex align-middle opacity-70">
                        {m.direction === "in" ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
                      </span>
                      {m.body}
                    </div>
                  </div>
                ))
              )}
              {ocupado && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm border bg-card px-3.5 py-2 text-sm text-muted-foreground flex items-center gap-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    El agente esta pensando...
                  </div>
                </div>
              )}
              <div ref={finRef} />
            </div>

            <div className="flex gap-2">
              <Input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void enviar();
                  }
                }}
                placeholder={conversationId ? "Escribi como el cliente..." : "Primero crea una conversacion"}
                disabled={!conversationId || ocupado}
              />
              <Button onClick={enviar} disabled={!conversationId || ocupado || !texto.trim()} className="cursor-pointer">
                <Send className="h-4 w-4" />
                Enviar
              </Button>
            </div>

            {ultimo && (
              <p className="text-[11px] text-muted-foreground">
                Ultimo turno: {ultimo.ok ? "respondio" : `no respondio (${ultimo.reason ?? "?"})`}
                {typeof ultimo.toolCalls === "number" && ` · ${ultimo.toolCalls} herramienta${ultimo.toolCalls === 1 ? "" : "s"}`}
                {conversationId && (
                  <>
                    {" · "}
                    <Link href={`/conversations/${conversationId}`} className="text-primary hover:underline inline-flex items-center gap-0.5">
                      ver en la bandeja <ExternalLink className="h-3 w-3" />
                    </Link>
                  </>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lo que ve el CRM</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {!estado ? (
              <p className="text-muted-foreground">
                Cuando el agente actue sobre la ficha, lo vas a ver aqui: etapa, campos, resumen y actividades.
              </p>
            ) : (
              <>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Contacto</p>
                  <p className="font-medium">{estado.name}</p>
                  {estado.tags?.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">{estado.tags.join(" · ")}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Etapa</p>
                  {etapaActual ? (
                    <span className="inline-flex items-center gap-1.5 mt-1 rounded-full border px-2 py-0.5 text-xs font-medium">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: etapaActual.color }} />
                      {etapaActual.name}
                    </span>
                  ) : (
                    <p className="text-muted-foreground">Sin operacion todavia</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Datos</p>
                  <CamposPersonalizadosLista valores={estado.customFields} compacto mostrarVacios />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Resumen del agente</p>
                  <p className={cn("mt-0.5 whitespace-pre-line", !estado.aiSummary && "text-muted-foreground")}>
                    {estado.aiSummary ?? "Todavia no hay resumen."}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">
                    Actividades ({estado.activities?.length ?? 0})
                  </p>
                  <ul className="mt-1 space-y-1">
                    {(estado.activities ?? []).slice(-5).reverse().map((a) => (
                      <li key={a.id} className="text-xs text-muted-foreground truncate">
                        {a.description}
                      </li>
                    ))}
                  </ul>
                </div>
                {contactId && (
                  <Link href={`/contacts/${contactId}`} className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                    Abrir la ficha <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
