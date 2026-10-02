import { redirect } from "next/navigation";
import { listConversations } from "@/lib/conversations";
import { getCurrentMember, visibleOwnerId } from "@/lib/team";
import { ConversationsListLive } from "@/components/conversations/ConversationsListLive";
import { MessageSquare } from "lucide-react";

// El inbox lee la base en cada request: nunca se prerenderiza en build.
export const dynamic = "force-dynamic";

export default async function ConversationsPage() {
  const member = await getCurrentMember();
  if (!member) redirect("/sin-acceso");

  const conversations = await listConversations({
    ownerId: visibleOwnerId(member),
  });

  return (
    <div className="flex h-[calc(100dvh-3.5rem-env(safe-area-inset-top)-4rem)] md:h-[calc(100dvh-3.5rem-5rem)] overflow-hidden border border-border rounded-xl bg-card shadow-md">
      <ConversationsListLive initialConversations={conversations} />

      <section className="flex-1 hidden md:flex flex-col items-center justify-center bg-muted/50">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-card shadow-sm mb-4">
          <MessageSquare className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-base font-medium tracking-tight">
          Selecciona una conversacion
        </h2>
        <p className="text-xs text-muted-foreground mt-1.5 max-w-xs text-center">
          Los mensajes de WhatsApp, Instagram y Messenger aparecen a la
          izquierda. Tocar cualquiera para ver el historial y responder.
        </p>
        {conversations.length === 0 && (
          <div className="mt-6 max-w-md text-center">
            <p className="text-xs text-muted-foreground/80">
              Para que aparezca la primera conversacion, escribile a alguno de
              los canales conectados. El webhook tiene que estar configurado y
              apuntando a tu URL publica (ngrok o Vercel). Podes revisar el
              estado de cada canal en Ajustes.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
