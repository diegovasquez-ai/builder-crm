"use client";

import { useSyncExternalStore } from "react";
import { ChatPanelLive } from "./ChatPanelLive";
import { ContactDetailPanel, type ContactThread } from "./ContactDetailPanel";
import type { ConversationDetail, ConversationMessage } from "@/lib/conversations";

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

interface Props {
  conversation: ConversationDetail;
  contact: Contact | null;
  threads?: ContactThread[];
  initialMessages: ConversationMessage[];
  /** Solo un admin puede eliminar el hilo. */
  isAdmin?: boolean;
}

const STORAGE_KEY = "conversations:detailsOpen";

function subscribeStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

export function ConversationView({
  conversation,
  contact,
  threads = [],
  initialMessages,
  isAdmin = false,
}: Props) {
  // Preferencia por navegador. useSyncExternalStore evita setear estado dentro de un
  // efecto y no rompe la hidratacion: en el servidor vale `true`.
  const detailsOpen = useSyncExternalStore(
    subscribeStorage,
    () => window.localStorage.getItem(STORAGE_KEY) !== "0",
    () => true
  );

  const toggle = () => {
    window.localStorage.setItem(STORAGE_KEY, detailsOpen ? "0" : "1");
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <>
      <ChatPanelLive
        contact={{
          id: contact?.id ?? "",
          name: contact?.name ?? conversation.participantName ?? "Sin nombre",
          phone: contact?.phone ?? null,
        }}
        conversation={{
          conversationId: conversation.conversationId,
          channel: conversation.channel,
          handle: conversation.handle,
          lastInboundAt: conversation.lastInboundAt,
        }}
        initialMessages={initialMessages}
        isAdmin={isAdmin}
        detailsOpen={detailsOpen}
        onToggleDetails={toggle}
      />
      {contact && (
        <ContactDetailPanel
          contact={contact}
          open={detailsOpen}
          threads={threads}
          activeConversationId={conversation.conversationId}
          metadata={conversation.metadata}
          agente={{
            aiEnabled: conversation.aiEnabled,
            needsHuman: conversation.needsHuman,
            needsHumanReason: conversation.needsHumanReason ?? null,
          }}
        />
      )}
    </>
  );
}
