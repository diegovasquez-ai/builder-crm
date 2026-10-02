"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChatPanel } from "./ChatPanel";
import type { ConversationMessage } from "@/lib/conversations";

import type { Channel } from "@/lib/channels/types";

interface Contact {
  id: string;
  name: string;
  phone: string | null;
}

interface ConversationHeaderInfo {
  conversationId: string;
  channel: Channel;
  handle: string | null;
  lastInboundAt?: Date | string | null;
}

interface Props {
  contact: Contact;
  conversation: ConversationHeaderInfo;
  initialMessages: ConversationMessage[];
  isAdmin?: boolean;
  detailsOpen?: boolean;
  onToggleDetails?: () => void;
}

const POLL_INTERVAL_MS = 2500;
const POLL_INTERVAL_HIDDEN_MS = 15000;

function rehydrate(raw: ConversationMessage): ConversationMessage {
  return {
    ...raw,
    sentAt: raw.sentAt ? new Date(raw.sentAt) : null,
    deliveredAt: raw.deliveredAt ? new Date(raw.deliveredAt) : null,
    readAt: raw.readAt ? new Date(raw.readAt) : null,
    createdAt: raw.createdAt ? new Date(raw.createdAt) : new Date(),
  };
}

export function ChatPanelLive({
  contact,
  conversation,
  initialMessages,
  isAdmin,
  detailsOpen,
  onToggleDetails,
}: Props) {
  const [messages, setMessages] = useState(initialMessages);
  const mountedRef = useRef(true);

  const refetch = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/conversations/${conversation.conversationId}/messages`,
        { cache: "no-store" },
      );
      if (!res.ok) return;
      const json = (await res.json()) as { messages: ConversationMessage[] };
      if (!mountedRef.current) return;
      setMessages(json.messages.map(rehydrate));
    } catch {
      // network blip, next tick will retry
    }
  }, [conversation.conversationId]);

  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = () => {
      const delay = document.hidden
        ? POLL_INTERVAL_HIDDEN_MS
        : POLL_INTERVAL_MS;
      timer = setTimeout(async () => {
        await refetch();
        if (mountedRef.current) schedule();
      }, delay);
    };

    schedule();

    const onSent = () => {
      refetch();
    };
    window.addEventListener("conversations:refresh", onSent);

    const onVisibility = () => {
      if (!document.hidden) refetch();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      mountedRef.current = false;
      if (timer) clearTimeout(timer);
      window.removeEventListener("conversations:refresh", onSent);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refetch]);

  return (
    <ChatPanel
      contact={contact}
      conversation={conversation}
      messages={messages}
      isAdmin={isAdmin}
      detailsOpen={detailsOpen}
      onToggleDetails={onToggleDetails}
    />
  );
}
