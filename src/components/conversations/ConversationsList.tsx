"use client";

import Link from "next/link";
import { AlertCircle, Bot, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { ConversationListItem } from "@/lib/conversations";
import { cn } from "@/lib/utils";
import { avatarBg, getInitials } from "@/lib/avatar";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import type { Channel } from "@/lib/channels/types";
import { CHANNEL_COLORS, ChannelIcon } from "@/components/icons/channels";
import { ChannelFilter } from "./ChannelFilter";

interface Props {
  conversations: ConversationListItem[];
  selectedId?: string;
}

export function ConversationsList({ conversations, selectedId }: Props) {
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState<Channel | "all">("all");

  const counts = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const c of conversations) acc[c.channel] = (acc[c.channel] ?? 0) + 1;
    return acc;
  }, [conversations]);

  const filtered = useMemo(() => {
    const byChannel =
      channel === "all"
        ? conversations
        : conversations.filter((c) => c.channel === channel);

    const q = search.trim().toLowerCase();
    if (!q) return byChannel;
    const digits = q.replace(/\D/g, "");
    return byChannel.filter((c) => {
      if (c.name?.toLowerCase().includes(q)) return true;
      if (c.lastBody?.toLowerCase().includes(q)) return true;
      if (c.handle?.toLowerCase().includes(q)) return true;
      if (digits && c.phone && c.phone.replace(/\D/g, "").includes(digits))
        return true;
      return false;
    });
  }, [conversations, search, channel]);

  return (
    <aside
      className={cn(
        "w-full md:w-[340px] shrink-0 border-r border-border h-full flex-col bg-card",
        // En telefono no hay lugar para lista + chat: con un hilo abierto se ve solo el
        // chat (y el boton de volver en su cabecera). Sin eso, el chat colapsaba a 0 px.
        selectedId ? "hidden md:flex" : "flex"
      )}
    >
      <div className="h-14 px-4 flex items-center border-b border-border bg-muted/40">
        <h2 className="text-sm font-semibold tracking-tight font-heading">
          Conversaciones
        </h2>
        <span className="ml-auto text-[11px] font-mono text-muted-foreground tabular-nums">
          {filtered.length}
          {search && filtered.length !== conversations.length && (
            <span className="text-muted-foreground/60">/{conversations.length}</span>
          )}
        </span>
      </div>

      <div className="px-3 py-2 border-b border-border/60 bg-card">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, usuario o telefono"
            className="w-full h-8 pl-8 pr-7 text-[12px] rounded-md border border-border/70 bg-muted/40 placeholder:text-muted-foreground focus:outline-none focus:bg-card focus:border-border focus:ring-2 focus:ring-primary/20 transition-colors"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Limpiar busqueda"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-muted/60 cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      <ChannelFilter value={channel} onChange={setChannel} counts={counts} />

      <div className="flex-1 overflow-auto">
        {conversations.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Aun no hay conversaciones.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Cuando alguien te escriba por WhatsApp, Instagram o Messenger,
              va a aparecer aca.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm text-muted-foreground">
              Sin resultados para &quot;{search}&quot;
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Probá buscando por nombre, usuario o número.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border/40">
            {filtered.map((c) => {
              const isActive = selectedId === c.conversationId;
              return (
                <li key={c.conversationId}>
                  <Link
                    href={`/conversations/${c.conversationId}`}
                    className={cn(
                      "relative flex items-start gap-3 px-3 py-3 cursor-pointer transition-all",
                      isActive
                        ? "bg-primary/10"
                        : "hover:bg-muted/60 hover:shadow-xs",
                    )}
                  >
                    {isActive && (
                      <span
                        aria-hidden
                        className="absolute left-0 top-2 bottom-2 w-0.75 rounded-r-full bg-primary"
                      />
                    )}
                    <div className="relative shrink-0">
                      <div
                        className={cn(
                          "h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-semibold",
                          avatarBg(c.name),
                        )}
                      >
                        {getInitials(c.name)}
                      </div>
                      <span
                        title={c.channel}
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-card bg-card",
                          CHANNEL_COLORS[c.channel],
                        )}
                      >
                        <ChannelIcon channel={c.channel} className="h-2.5 w-2.5" />
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[13px] font-medium truncate flex-1 flex items-center gap-1.5">
                          {c.name}
                          {c.provider === "simulador" && (
                            <span
                              title="Conversacion simulada: nada sale a un canal real"
                              className="shrink-0 inline-flex items-center h-4 px-1 rounded-sm bg-violet-100 text-violet-800 text-[9px] font-semibold uppercase tracking-wide dark:bg-violet-950/40 dark:text-violet-300"
                            >
                              sim
                            </span>
                          )}
                          {c.needsHuman && (
                            <span
                              title={
                                c.needsHumanReason
                                  ? `Necesita humano: ${c.needsHumanReason}`
                                  : "Necesita humano"
                              }
                              className="shrink-0 inline-flex items-center gap-0.5 h-4 px-1 rounded-sm bg-amber-100 text-amber-800 text-[9px] font-semibold uppercase tracking-wide dark:bg-amber-950/40 dark:text-amber-300"
                            >
                              <AlertCircle className="h-2.5 w-2.5" />
                              humano
                            </span>
                          )}
                          {!c.needsHuman && !c.aiEnabled && (
                            <span
                              title="IA desactivada para este contacto"
                              className="shrink-0 inline-flex items-center gap-0.5 h-4 px-1 rounded-sm bg-muted text-muted-foreground text-[9px] font-semibold uppercase tracking-wide"
                            >
                              <Bot className="h-2.5 w-2.5" />
                              off
                            </span>
                          )}
                        </span>
                        {c.lastAt && (
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0 tabular-nums">
                            {formatDistanceToNow(c.lastAt, {
                              addSuffix: false,
                              locale: es,
                            })
                              .replace("alrededor de ", "")
                              .replace("menos de ", "<")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-muted-foreground truncate flex-1">
                          {c.lastDirection === "out" && (
                            <span className="text-muted-foreground/70">
                              tu:{" "}
                            </span>
                          )}
                          {c.lastBody ?? "(sin cuerpo)"}
                        </p>
                        {c.unreadCount > 0 && (
                          <span className="shrink-0 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold tabular-nums">
                            {c.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
