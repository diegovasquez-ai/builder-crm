"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, Check, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { usePush } from "@/lib/use-push";

interface Item {
  id: string;
  title: string;
  body: string | null;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

const POLL_MS = 30_000;

/**
 * La campanita: notificaciones internas del miembro actual. Se refresca cada 30 s y al
 * volver a la pestana; una notificacion nueva mientras el CRM esta abierto ademas sale
 * como toast. Si este dispositivo no tiene push activado, lo ofrece aca mismo.
 */
export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const newestSeen = useRef<string | null>(null);
  const push = usePush();

  const load = useCallback(async () => {
    const res = await fetch("/api/notifications?limit=20").catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { items: Item[]; unread: number };

    // Toast solo para lo que llego DESPUES de la primera carga.
    const newest = data.items[0];
    if (newest && newestSeen.current && newest.id !== newestSeen.current && !newest.readAt) {
      toast(newest.title, {
        description: newest.body ?? undefined,
        action: newest.url
          ? { label: "Ver", onClick: () => router.push(newest.url!) }
          : undefined,
      });
    }
    newestSeen.current = newest?.id ?? newestSeen.current ?? "none";

    setItems(data.items);
    setUnread(data.unread);
  }, [router]);

  useEffect(() => {
    let alive = true;
    const tick = () => {
      if (alive && document.visibilityState === "visible") void load();
    };
    tick();
    const timer = setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  const markRead = async (ids?: string[]) => {
    await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ids ? { ids } : {}),
    });
    await load();
  };

  const openItem = async (item: Item) => {
    setOpen(false);
    if (!item.readAt) void markRead([item.id]);
    if (item.url) router.push(item.url);
  };

  const enablePush = async () => {
    const error = await push.subscribe();
    if (error) toast.error(error);
    else toast.success("Notificaciones activadas en este dispositivo");
  };

  const showPushPrompt = push.state === "ready" || push.state === "ios-install";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative cursor-pointer h-8 w-8"
            aria-label={unread > 0 ? `${unread} notificaciones sin leer` : "Notificaciones"}
          />
        }
      >
        {unread > 0 ? <BellRing className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-[10px] font-semibold text-white flex items-center justify-center leading-none">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[min(92vw,380px)] p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <p className="text-sm font-semibold">Notificaciones</p>
          {unread > 0 && (
            <button
              type="button"
              onClick={() => markRead()}
              className="text-xs text-primary hover:underline cursor-pointer inline-flex items-center gap-1"
            >
              <Check className="h-3 w-3" />
              Marcar todas leidas
            </button>
          )}
        </div>

        {showPushPrompt && (
          <div className="px-3 py-2.5 border-b bg-primary/5 flex items-start gap-2.5">
            <Smartphone className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium">
                {push.state === "ios-install"
                  ? "Instala el CRM en tu iPhone para recibir avisos"
                  : "Recibe estos avisos en este dispositivo"}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {push.state === "ios-install"
                  ? "Safari → Compartir → Agregar a pantalla de inicio, y activalo desde ahi."
                  : "Aunque el CRM este cerrado."}
              </p>
            </div>
            {push.state === "ready" && (
              <Button
                size="sm"
                onClick={enablePush}
                disabled={push.busy}
                className="cursor-pointer h-7 text-xs shrink-0"
              >
                Activar
              </Button>
            )}
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto divide-y">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground px-3 py-6 text-center">
              Nada por ahora. Cuando una automatizacion te avise, aparece aca.
            </p>
          )}
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => openItem(n)}
              className={cn(
                "w-full text-left px-3 py-2.5 hover:bg-muted/50 cursor-pointer flex gap-2.5",
                !n.readAt && "bg-primary/[0.04]"
              )}
            >
              <span
                className={cn(
                  "mt-1.5 h-2 w-2 rounded-full shrink-0",
                  n.readAt ? "bg-transparent" : "bg-primary"
                )}
              />
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm truncate", !n.readAt && "font-medium")}>
                  {n.title}
                </span>
                {n.body && (
                  <span className="block text-xs text-muted-foreground line-clamp-2">
                    {n.body}
                  </span>
                )}
                <span className="block text-[11px] text-muted-foreground/80 mt-0.5">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: es })}
                </span>
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
