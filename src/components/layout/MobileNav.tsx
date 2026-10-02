"use client";

import { SidebarBrand, SidebarNav, SidebarFooter } from "./Sidebar";

export function MobileNav() {
  return (
    // El panel ocupa la pantalla entera (inset-y-0), asi que la marca quedaba tapada
    // por el reloj y la bateria en la PWA, y el usuario del pie por la barra de gestos.
    <div className="flex flex-col h-full bg-sidebar text-sidebar-foreground pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <SidebarBrand />
      <SidebarNav className="flex-1" />
      <SidebarFooter />
    </div>
  );
}
