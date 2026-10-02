"use client";

import { useState, useRef, KeyboardEvent, FormEvent } from "react";
import { Send, Loader2, FileText, Clock } from "lucide-react";
import { toast } from "sonner";
import { TemplatePicker } from "./TemplatePicker";
import {
  capabilitiesFor,
  isOutsideFreeFormWindow,
  type Channel,
} from "@/lib/channels/types";

interface Props {
  conversationId: string;
  channel: Channel;
  contactId: string;
  contactPhone: string;
  /** Fecha del ultimo mensaje entrante del cliente (para la ventana de 24h). */
  lastInboundAt?: Date | string | null;
}

function notifyRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("conversations:refresh"));
  }
}

export function ChatInput({
  conversationId,
  channel,
  contactId,
  contactPhone,
  lastInboundAt,
}: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const caps = capabilitiesFor(channel);
  const outsideWindow = isOutsideFreeFormWindow(channel, lastInboundAt);

  async function doSend() {
    const body = text.trim();
    if (!body || sending) return;

    setSending(true);
    toast.message("Enviando...", { id: "sending-msg" });
    try {
      // Endpoint generico por conversacion: el servidor resuelve el canal, el proveedor
      // y (en IG/Messenger) si hace falta la etiqueta HUMAN_AGENT.
      const res = await fetch("/api/messages/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, text: body }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        toast.error(json.error || `HTTP ${res.status}`, {
          id: "sending-msg",
          description: json.hint,
          duration: 10000,
        });
        notifyRefresh();
        return;
      }

      toast.success("Enviado", { id: "sending-msg", duration: 2000 });
      setText("");
      notifyRefresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error", {
        id: "sending-msg",
        duration: 10000,
      });
    } finally {
      setSending(false);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    doSend();
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      doSend();
    }
  }

  return (
    <div className="shrink-0 border-t border-border bg-card px-3 md:px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {outsideWindow && (
        <div className="max-w-2xl mx-auto mb-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">
            {lastInboundAt
              ? "Pasaron mas de 24h desde el ultimo mensaje del cliente."
              : "Sin mensajes del cliente todavia."}{" "}
            {caps.templates
              ? "Fuera de esa ventana WhatsApp solo permite enviar plantillas aprobadas."
              : "El mensaje se envia con la etiqueta HUMAN_AGENT, que Meta permite hasta 7 dias."}
          </span>
          {caps.templates && (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="shrink-0 font-medium underline underline-offset-2 hover:text-amber-900 cursor-pointer dark:hover:text-amber-200"
            >
              Usar plantilla
            </button>
          )}
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="max-w-2xl mx-auto flex items-end gap-2.5"
      >
        {/* Las plantillas son un concepto exclusivo de WhatsApp. */}
        {caps.templates && (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            disabled={sending}
            className="shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-50 cursor-pointer transition-colors"
            aria-label="Enviar plantilla"
            title="Enviar plantilla"
          >
            <FileText className="h-4.5 w-4.5" />
          </button>
        )}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Escribe un mensaje..."
          rows={1}
          className="flex-1 resize-none min-h-[40px] max-h-32 bg-muted/30 border border-transparent rounded-2xl px-4 py-2.5 text-base md:text-[13px] outline-none hover:bg-muted/50 focus:bg-card focus:border-primary/40 focus:ring-2 focus:ring-primary/15 transition-all"
          style={{ fieldSizing: "content" } as React.CSSProperties}
          disabled={sending}
        />
        <button
          type="submit"
          disabled={sending}
          className="shrink-0 h-10 w-10 inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors shadow-sm shadow-primary/20"
          aria-label="Enviar mensaje"
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
      </form>

      {caps.templates && (
        <TemplatePicker
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          contactId={contactId}
          contactPhone={contactPhone}
          onSent={notifyRefresh}
        />
      )}
    </div>
  );
}
