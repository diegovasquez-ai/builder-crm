"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, Phone, X, Check, Bot, AlertCircle, Megaphone } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { avatarBg, getInitials } from "@/lib/avatar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CHANNEL_LABELS, type Channel } from "@/lib/channels/types";
import { CHANNEL_COLORS, ChannelIcon } from "@/components/icons/channels";
import { OwnerSelect } from "@/components/contacts/OwnerSelect";
import { CamposPersonalizadosLista } from "@/components/contacts/CamposPersonalizados";
import { camposContacto } from "@/lib/config";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  tags: string[];
  notes: string | null;
  aiEnabled?: boolean;
  needsHuman?: boolean;
  needsHumanReason?: string | null;
  ownerId?: string | null;
  customFields?: Record<string, unknown> | null;
  aiSummary?: string | null;
  aiSummaryAt?: Date | string | null;
}

export interface ContactThread {
  conversationId: string;
  channel: Channel;
}

interface Props {
  contact: Contact;
  open?: boolean;
  /** Todos los hilos del contacto, para saltar entre canales. */
  threads?: ContactThread[];
  activeConversationId?: string;
  /** metadata de la conversacion: campos ctwa_* / meta_ad_* que captura Zernio. */
  metadata?: unknown;
  /** Estado del agente en ESTE hilo (combinado con el kill-switch del contacto). */
  agente?: { aiEnabled: boolean; needsHuman: boolean; needsHumanReason: string | null };
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function ContactDetailPanel({
  contact,
  agente,
  open = true,
  threads = [],
  activeConversationId,
  metadata,
}: Props) {
  const [tags, setTags] = useState<string[]>(contact.tags ?? []);
  const [tagDraft, setTagDraft] = useState("");
  const [notes, setNotes] = useState(contact.notes ?? "");
  const [notesState, setNotesState] = useState<SaveState>("idle");
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialNotes = useRef(contact.notes ?? "");
  const [aiEnabled, setAiEnabled] = useState(agente?.aiEnabled ?? contact.aiEnabled ?? true);
  const [needsHuman, setNeedsHuman] = useState(agente?.needsHuman ?? contact.needsHuman ?? false);
  const [needsHumanReason, setNeedsHumanReason] = useState(
    agente?.needsHumanReason ?? contact.needsHumanReason ?? null,
  );
  const [aiBusy, setAiBusy] = useState(false);

  // Reset local state when the active contact changes
  useEffect(() => {
    setTags(contact.tags ?? []);
    setNotes(contact.notes ?? "");
    initialNotes.current = contact.notes ?? "";
    setNotesState("idle");
    setAiEnabled(agente?.aiEnabled ?? contact.aiEnabled ?? true);
    setNeedsHuman(agente?.needsHuman ?? contact.needsHuman ?? false);
    setNeedsHumanReason(agente?.needsHumanReason ?? contact.needsHumanReason ?? null);
  }, [
    contact.id,
    contact.tags,
    contact.notes,
    contact.aiEnabled,
    contact.needsHuman,
    contact.needsHumanReason,
    agente?.aiEnabled,
    agente?.needsHuman,
    agente?.needsHumanReason,
  ]);

  const updateAi = async (body: { enabled?: boolean; clearNeedsHuman?: boolean }) => {
    setAiBusy(true);
    try {
      // Con hilo activo se pausa/reactiva SOLO ese hilo; sin hilo, el contacto entero.
      const url = activeConversationId
        ? `/api/conversations/${activeConversationId}/agente`
        : `/api/contacts/${contact.id}/ai`;
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("update_failed");
      const data = await res.json();
      setAiEnabled(data.aiEnabled);
      setNeedsHuman(data.needsHuman);
      setNeedsHumanReason(data.needsHumanReason);
      toast.success(
        data.aiEnabled
          ? "Agente reactivado en esta conversacion"
          : "Agente pausado en esta conversacion",
      );
    } catch {
      toast.error("No se pudo actualizar el estado del bot");
    } finally {
      setAiBusy(false);
    }
  };

  const persistTags = async (next: string[]) => {
    const previous = tags;
    setTags(next);
    try {
      const res = await fetch(`/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags: next }),
      });
      if (!res.ok) throw new Error("save_failed");
    } catch {
      setTags(previous);
      toast.error("No se pudo guardar la etiqueta");
    }
  };

  const addTag = () => {
    const t = tagDraft.trim();
    if (!t || tags.includes(t)) {
      setTagDraft("");
      return;
    }
    setTagDraft("");
    void persistTags([...tags, t]);
  };

  const removeTag = (tag: string) => {
    void persistTags(tags.filter((t) => t !== tag));
  };

  const onNotesChange = (v: string) => {
    setNotes(v);
    setNotesState("saving");
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      if (v === initialNotes.current) {
        setNotesState("idle");
        return;
      }
      try {
        const res = await fetch(`/api/contacts/${contact.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ notes: v }),
        });
        if (!res.ok) throw new Error("save_failed");
        initialNotes.current = v;
        setNotesState("saved");
        setTimeout(() => setNotesState("idle"), 1200);
      } catch {
        setNotesState("error");
      }
    }, 800);
  };

  // El early-return va DESPUES de los hooks: si estuviera arriba, togglear el panel
  // cambiaria la cantidad de hooks entre renders y React tira "rendered fewer hooks".
  if (!open) return null;

  const attribution = extractAttribution(metadata);

  return (
    <aside className="hidden lg:flex w-80 shrink-0 border-l border-border h-full flex-col bg-card">
      <div className="h-14 px-4 flex items-center border-b border-border shrink-0">
        <h2 className="text-sm font-semibold tracking-tight font-heading">
          Detalles del contacto
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-5 flex flex-col items-center text-center border-b border-border">
          <div
            className={cn(
              "h-14 w-14 rounded-full flex items-center justify-center text-base font-semibold mb-3",
              avatarBg(contact.name),
            )}
          >
            {getInitials(contact.name)}
          </div>
          <p className="text-sm font-semibold tracking-tight">{contact.name}</p>
          {contact.phone && (
            <a
              href={`tel:${contact.phone}`}
              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Phone className="h-3 w-3" />
              {contact.phone}
            </a>
          )}
          {contact.email && (
            <a
              href={`mailto:${contact.email}`}
              className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <Mail className="h-3 w-3" />
              {contact.email}
            </a>
          )}

          {threads.length > 1 && (
            <div className="mt-3 flex flex-wrap justify-center gap-1">
              {threads.map((t) => {
                const isActive = t.conversationId === activeConversationId;
                return (
                  <Link
                    key={t.conversationId}
                    href={`/conversations/${t.conversationId}`}
                    title={`Ver el hilo de ${CHANNEL_LABELS[t.channel]}`}
                    className={cn(
                      "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-medium transition-colors",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted/60 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <ChannelIcon
                      channel={t.channel}
                      className={cn(
                        "h-2.5 w-2.5",
                        isActive ? "" : CHANNEL_COLORS[t.channel]
                      )}
                    />
                    {CHANNEL_LABELS[t.channel]}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {attribution && (
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-2.5 py-2">
              <Megaphone className="h-3.5 w-3.5 shrink-0 mt-0.5 text-primary" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Vino de un anuncio
                </p>
                <p className="text-xs font-medium mt-0.5 break-words">
                  {attribution.title}
                </p>
                {attribution.url && (
                  <a
                    href={attribution.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-primary hover:underline break-all"
                  >
                    Ver anuncio
                  </a>
                )}
                {attribution.adId && (
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                    id {attribution.adId}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="px-4 py-4 border-b border-border space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="h-3 w-3" />
              Agente IA
            </Label>
            <span
              className={cn(
                "inline-flex items-center gap-1 h-5 px-1.5 rounded-sm text-[10px] font-semibold uppercase tracking-wide",
                aiEnabled && !needsHuman
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {aiEnabled && !needsHuman ? "ON" : "OFF"}
            </span>
          </div>

          {needsHuman && (
            <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-2.5 py-2 text-[11px] flex items-start gap-1.5">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-amber-900 dark:text-amber-200">
                  Necesita humano
                </p>
                {needsHumanReason && (
                  <p className="text-amber-800 dark:text-amber-300/80 mt-0.5">
                    {needsHumanReason}
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {needsHuman ? (
              <Button
                type="button"
                size="sm"
                disabled={aiBusy}
                onClick={() =>
                  updateAi({ enabled: true, clearNeedsHuman: true })
                }
                className="cursor-pointer h-8 text-xs flex-1"
              >
                Reactivar agente
              </Button>
            ) : aiEnabled ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={aiBusy}
                onClick={() => updateAi({ enabled: false })}
                className="cursor-pointer h-8 text-xs flex-1"
              >
                Pausar agente
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                disabled={aiBusy}
                onClick={() => updateAi({ enabled: true })}
                className="cursor-pointer h-8 text-xs flex-1"
              >
                Activar agente
              </Button>
            )}
          </div>
        </div>

        <div className="px-4 py-5 border-b border-border space-y-2.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Asesor a cargo
          </Label>
          <OwnerSelect contactId={contact.id} value={contact.ownerId ?? null} compact />
        </div>

        {camposContacto().length > 0 && (
          <div className="px-4 py-5 border-b border-border space-y-2.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Datos
            </Label>
            <CamposPersonalizadosLista valores={contact.customFields} compacto mostrarVacios />
          </div>
        )}

        {contact.aiSummary && (
          <div className="px-4 py-5 border-b border-border space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Bot className="h-3 w-3" />
              Resumen del agente
            </Label>
            <p className="text-xs leading-relaxed whitespace-pre-line">{contact.aiSummary}</p>
          </div>
        )}

        <div className="px-4 py-5 border-b border-border space-y-2.5">
          <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Etiquetas
          </Label>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 text-[11px] font-medium"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label={`Quitar ${tag}`}
                    className="hover:text-destructive cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input
              value={tagDraft}
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addTag();
                }
              }}
              placeholder="Nueva etiqueta..."
              className="h-8 text-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addTag}
              disabled={!tagDraft.trim()}
              className="cursor-pointer h-8 text-xs"
            >
              Agregar
            </Button>
          </div>
        </div>

        <div className="px-4 py-5 space-y-2.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Notas
            </Label>
            <span className="text-[10px] text-muted-foreground/70 h-3 flex items-center gap-1">
              {notesState === "saving" && "Guardando..."}
              {notesState === "saved" && (
                <>
                  <Check className="h-3 w-3 text-emerald-600" />
                  Guardado
                </>
              )}
              {notesState === "error" && (
                <span className="text-destructive">Error</span>
              )}
            </span>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Agregar notas sobre este contacto..."
            rows={6}
            className="text-xs resize-none"
          />
        </div>
      </div>
    </aside>
  );
}

interface Attribution {
  title: string;
  url?: string;
  adId?: string;
}

/**
 * Saca la atribucion de origen de la metadata del hilo.
 *
 * Zernio expone dos familias segun de donde vino el lead: `ctwa_*` para Click-To-WhatsApp
 * Ads y `meta_ad_*` para anuncios de Instagram/Messenger. Es informacion que llega gratis
 * en el webhook y responde la pregunta cara de cualquier inmobiliaria: que aviso trajo
 * a este cliente.
 */
function extractAttribution(metadata: unknown): Attribution | null {
  if (!metadata || typeof metadata !== "object") return null;
  const m = metadata as Record<string, unknown>;
  const str = (k: string) => (typeof m[k] === "string" ? (m[k] as string) : undefined);

  const title = str("meta_ad_title") ?? str("ctwa_headline");
  const adId = str("meta_ad_id") ?? str("ctwa_source_id");
  const url = str("ctwa_source_url");

  if (!title && !adId) return null;
  return { title: title ?? "Anuncio sin titulo", url, adId };
}
