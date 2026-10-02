"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronsUpDown, LogOut, Settings, User as UserIcon } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { signOut } from "@/app/login/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface SessionUser {
  email: string | null;
  fullName: string | null;
}

function initials(name: string | null, email: string | null) {
  const source = name?.trim() || email?.split("@")[0] || "?";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function UserMenu() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser({
          email: data.user.email ?? null,
          fullName:
            (data.user.user_metadata?.full_name as string | undefined) ?? null,
        });
      }
    });
  }, []);

  if (!user) {
    return (
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
        <div className="h-8 w-8 rounded-full bg-white/10 animate-pulse" />
        <div className="flex-1 space-y-1.5">
          <div className="h-2.5 w-20 rounded bg-white/10 animate-pulse" />
          <div className="h-2 w-28 rounded bg-white/5 animate-pulse" />
        </div>
      </div>
    );
  }

  const displayName = user.fullName || user.email?.split("@")[0] || "Usuario";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button className="w-full flex items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-white/5 transition-colors cursor-pointer" />
        }
      >
        <div className="relative shrink-0">
          <Avatar className="h-8 w-8 rounded-full">
            <AvatarFallback className="rounded-full bg-primary/15 text-primary text-[11px] font-semibold">
              {initials(user.fullName, user.email)}
            </AvatarFallback>
          </Avatar>
          <span
            aria-hidden
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-sidebar"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-medium truncate text-sidebar-foreground">
            {displayName}
          </p>
          <p className="text-[11px] text-sidebar-foreground/60 truncate">
            {user.email}
          </p>
        </div>
        <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/50 shrink-0" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-medium truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/settings" />}>
          <UserIcon className="h-4 w-4" />
          Mi perfil
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/settings" />}>
          <Settings className="h-4 w-4" />
          Configuracion
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => startTransition(() => signOut())}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
