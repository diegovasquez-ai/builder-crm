"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import {
  LayoutDashboard,
  Users,
  Kanban,
  Activity,
  Settings,
  MessageSquare,
  BarChart3,
  FileText,
  Workflow,
  FlaskConical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { marca, moduloActivo } from "@/lib/config";
import { navModulos } from "@/lib/modules/cliente";
import { etiquetaVersion } from "@/lib/version";
import { useEsAdmin } from "@/lib/use-es-admin";
import { leerConfigPublica } from "@/lib/config-publica";
import { UserMenu } from "./UserMenu";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

interface NavSection {
  title?: string;
  items: NavItem[];
}

/**
 * El menu se arma desde la configuracion: las funciones del nucleo apagadas en
 * `modulos.nucleo` no aparecen, y los modulos activos agregan sus entradas en la
 * seccion que declaran en su manifiesto.
 */
function construirSecciones(esAdmin: boolean): NavSection[] {
  const deModulos = navModulos();
  const seccion = (nombre: "Operaciones" | "Productividad" | "Inteligencia"): NavItem[] =>
    deModulos
      .filter((n) => (n.seccion ?? "Operaciones") === nombre)
      .map((n) => ({ href: n.href, label: n.etiqueta, icon: n.icono }));
  const si = (activo: boolean, item: NavItem): NavItem[] => (activo ? [item] : []);

  return [
    { items: [{ href: "/", label: "Dashboard", icon: LayoutDashboard }] },
    {
      title: "Operaciones",
      items: [
        { href: "/pipeline", label: "Pipeline", icon: Kanban },
        { href: "/contacts", label: "Contactos", icon: Users },
        { href: "/conversations", label: "Conversaciones", icon: MessageSquare },
        ...si(moduloActivo("plantillas"), { href: "/plantillas", label: "Plantillas", icon: FileText }),
        ...seccion("Operaciones"),
      ],
    },
    {
      title: "Productividad",
      items: [
        ...si(moduloActivo("actividades"), { href: "/activities", label: "Actividades", icon: Activity }),
        ...seccion("Productividad"),
      ],
    },
    {
      title: "Inteligencia",
      items: [
        ...si(moduloActivo("reportes"), { href: "/reportes", label: "Reportes", icon: BarChart3 }),
        ...si(moduloActivo("automatizaciones"), { href: "/automatizaciones", label: "Automatizaciones", icon: Workflow }),
        ...si(esAdmin && moduloActivo("simulador"), { href: "/simulador", label: "Simulador", icon: FlaskConical }),
        ...seccion("Inteligencia"),
      ],
    },
  ].filter((s) => s.items.length > 0);
}

const footerItems: NavItem[] = [
  { href: "/settings", label: "Configuracion", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="hidden md:flex md:w-64 md:flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border min-h-screen sticky top-0 max-h-screen">
      <SidebarBrand />
      <SidebarNav className="flex-1" />
      <SidebarFooter />
    </aside>
  );
}

export function SidebarBrand() {
  const m = marca();
  return (
    <div className="flex h-16 items-center gap-2.5 px-5 border-b border-sidebar-border">
      <Image
        src={m.logo}
        alt={m.nombre}
        width={32}
        height={32}
        unoptimized
        className="h-8 w-8 rounded-full object-cover shrink-0"
      />
      <span className="text-[15px] font-semibold tracking-tight font-heading truncate">
        {m.nombre}
      </span>
    </div>
  );
}

export function SidebarNav({ className }: { className?: string }) {
  const pathname = usePathname();
  const esAdmin = useEsAdmin() === true;
  const sections = construirSecciones(esAdmin);

  return (
    <nav className={cn("px-3 py-4 space-y-5 overflow-y-auto", className)}>
      {sections.map((section, idx) => (
        <div key={idx} className="space-y-1">
          {section.title && (
            <p className="px-2.5 mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-sidebar-foreground/55">
              {section.title}
            </p>
          )}
          {section.items.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      ))}
    </nav>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const isActive =
    pathname === item.href ||
    (item.href !== "/" && pathname.startsWith(item.href));

  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors cursor-pointer",
        isActive
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-white/5 hover:text-sidebar-foreground",
      )}
    >
      {isActive && (
        <span
          aria-hidden
          className="absolute left-0 top-1.5 bottom-1.5 w-0.75 rounded-r-full bg-primary"
        />
      )}
      <item.icon
        className={cn(
          "h-4 w-4 shrink-0",
          isActive ? "text-primary" : "text-sidebar-foreground/55",
        )}
      />
      <span className="truncate">{item.label}</span>
    </Link>
  );
}

export function SidebarFooter() {
  const pathname = usePathname();
  return (
    <div className="border-t border-sidebar-border px-3 py-3 space-y-1">
      {footerItems.map((item) => (
        <NavLink key={item.href} item={item} pathname={pathname} />
      ))}
      <div className="pt-2">
        <UserMenu />
      </div>
      {leerConfigPublica().modoLocal && (
        <p
          className="mx-2.5 mt-2 rounded-md bg-amber-500/15 px-2 py-1.5 text-[10px] leading-tight text-amber-200"
          title="Esto corre en tu maquina con una base embebida y sin sesion: no es una instancia para un cliente"
        >
          <span className="font-semibold">Modo local</span> · sin login, datos de prueba
        </p>
      )}
      <p className="px-2.5 pt-1 text-[10px] text-sidebar-foreground/40" title="Version desplegada">
        {etiquetaVersion()}
      </p>
    </div>
  );
}
