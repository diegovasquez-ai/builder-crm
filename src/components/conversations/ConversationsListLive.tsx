"use client";

import { useEffect, useRef, useState } from "react";
import { ConversationsList } from "./ConversationsList";
import type { ConversationListItem } from "@/lib/conversations";

interface Props {
  initialConversations: ConversationListItem[];
  selectedId?: string;
}

const POLL_INTERVAL_MS = 4000;
const POLL_INTERVAL_HIDDEN_MS = 20000;

function rehydrate(raw: ConversationListItem): ConversationListItem {
  return {
    ...raw,
    lastAt: raw.lastAt ? new Date(raw.lastAt) : null,
  };
}

export function ConversationsListLive({
  initialConversations,
  selectedId,
}: Props) {
  const [conversations, setConversations] = useState(initialConversations);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const refetch = async () => {
      try {
        const res = await fetch("/api/conversations", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as ConversationListItem[];
        if (!mountedRef.current) return;
        setConversations(data.map(rehydrate));
      } catch {
        // retry on next tick
      }
    };

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
  }, []);

  return (
    <ConversationsList conversations={conversations} selectedId={selectedId} />
  );
}
