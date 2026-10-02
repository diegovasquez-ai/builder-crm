"use client";

import { useState } from "react";
import { Search, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { MobileNav } from "./MobileNav";
import { NotificationBell } from "./NotificationBell";

export function Header() {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <header className="sticky top-0 z-30 flex h-14 box-content pt-[env(safe-area-inset-top)] items-center gap-3 border-b border-border bg-card/95 backdrop-blur-md shadow-sm px-4 md:px-8">
      <Sheet>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" className="md:hidden cursor-pointer h-8 w-8" />
          }
        >
          <Menu className="h-4 w-4" />
        </SheetTrigger>
        <SheetContent side="left" className="w-60 p-0">
          <MobileNav />
        </SheetContent>
      </Sheet>

      <div className="flex-1 flex items-center gap-3">
        <div className="relative w-full max-w-[440px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Buscar contactos, conversaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-12 h-9 bg-muted/30 border-transparent hover:bg-muted/50 focus:bg-card focus:border-border focus:ring-2 focus:ring-primary/20 text-[13px] transition-colors"
          />
          <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </div>
      </div>

      <NotificationBell />
    </header>
  );
}
