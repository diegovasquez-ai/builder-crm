"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { ConversationMessage } from "@/lib/conversations";
import { ChatInput } from "./ChatInput";
import { cn } from "@/lib/utils";
import { avatarBg, getInitials } from "@/lib/avatar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  AlertCircle,
  Clock,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
import { CHANNEL_LABELS, type Channel } from "@/lib/channels/types";
import { CHANNEL_COLORS, ChannelIcon } from "@/components/icons/channels";
import { ConversationActions } from "./ConversationActions";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
}

interface ConversationHeaderInfo {
  conversationId: string;
  channel: Channel;
  /** Telefono en WhatsApp, @usuario en Instagram, nombre en Messenger. */
  handle: string | null;
  lastInboundAt?: Date | string | null;
}

interface Props {
  contact: Contact;
  conversation: ConversationHeaderInfo;
  messages: ConversationMessage[];
  /** El menu de eliminar solo se le muestra al admin. */
  isAdmin?: boolean;
  detailsOpen?: boolean;
  onToggleDetails?: () => void;
}

function StatusIcon({ msg }: { msg: ConversationMessage }) {
  if (msg.direction !== "out") return null;
  if (msg.status === "failed")
    return <AlertCircle className="h-3 w-3 text-destructive" />;
  if (msg.status === "pending")
    return <Clock className="h-3 w-3 text-muted-foreground" />;
  if (msg.status === "read")
    return <CheckCheck className="h-3 w-3 text-sky-600" />;
  if (msg.status === "delivered")
    return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  return <Check className="h-3 w-3 text-muted-foreground" />;
}

export function ChatPanel({
  contact,
  conversation,
  messages,
  isAdmin,
  detailsOpen,
  onToggleDetails,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevContactIdRef = useRef<string | null>(null);
  const prevCountRef = useRef(messages.length);

  // Ultimo mensaje entrante del cliente: define la ventana de 24h para texto libre.
  // El servidor ya lo materializa en la conversacion; se recalcula desde los mensajes
  // como respaldo para que el banner reaccione al polling sin recargar la pagina.
  const lastInboundAt = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].direction === "in") {
        return messages[i].sentAt ?? messages[i].createdAt ?? null;
      }
    }
    return conversation.lastInboundAt
      ? new Date(conversation.lastInboundAt)
      : null;
  }, [messages, conversation.lastInboundAt]);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const isNewConversation =
      prevContactIdRef.current !== conversation.conversationId;
    if (isNewConversation) {
      el.scrollTop = el.scrollHeight;
      prevContactIdRef.current = conversation.conversationId;
      prevCountRef.current = messages.length;
    }
  }, [conversation.conversationId, messages.length]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (messages.length > prevCountRef.current) {
      const distanceFromBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight;
      const last = messages[messages.length - 1];
      const isOwnMessage = last?.direction === "out";
      if (isOwnMessage || distanceFromBottom < 200) {
        el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
      }
    }
    prevCountRef.current = messages.length;
  }, [messages]);

  return (
    <section className="flex-1 flex flex-col h-full min-w-0 bg-background">
      {/* Header */}
      <header className="h-14 px-3 md:px-5 flex items-center gap-2 md:gap-3 border-b border-border bg-muted/40 shrink-0">
        <Link
          href="/conversations"
          aria-label="Volver a la lista"
          className="md:hidden -ml-1 h-9 w-9 shrink-0 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted/60"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="relative shrink-0">
          <div
            className={cn(
              "h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-semibold",
              avatarBg(contact.name),
            )}
          >
            {getInitials(contact.name)}
          </div>
          <span
            title={CHANNEL_LABELS[conversation.channel]}
            className={cn(
              "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-card bg-card",
              CHANNEL_COLORS[conversation.channel],
            )}
          >
            <ChannelIcon channel={conversation.channel} className="h-2.5 w-2.5" />
          </span>
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-[14px] font-semibold tracking-tight truncate">
            {contact.name}
          </span>
          <span className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5">
            <span
              aria-hidden
              className="h-1.5 w-1.5 rounded-full bg-emerald-500"
            />
            {conversation.handle ?? CHANNEL_LABELS[conversation.channel]}
          </span>
        </div>
        <div className="ml-auto flex items-center gap-0.5 shrink-0">
        {onToggleDetails && (
          <button
            type="button"
            onClick={onToggleDetails}
            aria-label={
              detailsOpen ? "Ocultar detalles" : "Mostrar detalles"
            }
            className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          >
            {detailsOpen ? (
              <PanelRightClose className="h-4 w-4" />
            ) : (
              <PanelRightOpen className="h-4 w-4" />
            )}
          </button>
        )}
        {isAdmin && (
          <ConversationActions
            conversationId={conversation.conversationId}
            name={contact.name}
            messageCount={messages.length}
          />
        )}
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto px-4 md:px-8 py-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center">
            <p className="text-sm text-muted-foreground">
              Sin mensajes todavia.
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Escribi abajo y presiona Enter para enviar el primero.
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-1.5 max-w-2xl mx-auto">
            {messages.map((m, idx) => {
              const isOut = m.direction === "out";
              const prev = messages[idx - 1];
              const showTimestamp =
                !prev ||
                prev.direction !== m.direction ||
                (m.sentAt && prev.sentAt &&
                  m.sentAt.getTime() - prev.sentAt.getTime() > 5 * 60 * 1000);

              return (
                <li
                  key={m.id}
                  className={cn(
                    "flex flex-col gap-1",
                    isOut ? "items-end" : "items-start",
                    showTimestamp && idx > 0 ? "mt-3" : ""
                  )}
                >
                  {showTimestamp && m.sentAt && (
                    <span className="text-[10px] font-mono text-muted-foreground/70 self-center my-2">
                      {format(m.sentAt, "d 'de' MMM, HH:mm", { locale: es })}
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] md:max-w-[70%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed break-words border",
                      isOut
                        ? "bg-primary text-primary-foreground border-transparent shadow-sm rounded-br-md"
                        : "bg-card text-foreground border-border shadow-xs rounded-bl-md",
                    )}
                  >
                    {m.body || (
                      <span className="italic text-current/60">
                        ({m.type})
                      </span>
                    )}
                    {m.templateName && (
                      <div className="mt-1 text-[10px] font-mono opacity-70">
                        plantilla: {m.templateName}
                      </div>
                    )}
                  </div>
                  <div
                    className={cn(
                      "flex items-center gap-1 text-[10px] font-mono text-muted-foreground px-1",
                      isOut ? "flex-row-reverse" : ""
                    )}
                  >
                    <StatusIcon msg={m} />
                    {m.sentAt && (
                      <span>{format(m.sentAt, "HH:mm")}</span>
                    )}
                    {m.errorMessage && (
                      <span className="text-destructive">· {parseError(m.errorMessage)}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {/* Input */}
      <ChatInput
        conversationId={conversation.conversationId}
        channel={conversation.channel}
        contactId={contact.id}
        contactPhone={contact.phone ?? ""}
        lastInboundAt={lastInboundAt}
      />
    </section>
  );
}

function parseError(raw: string): string {
  try {
    const e = JSON.parse(raw);
    return e.message || e.error?.message || "error";
  } catch {
    return raw.slice(0, 80);
  }
}
