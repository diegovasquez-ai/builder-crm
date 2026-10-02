"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import Image from "next/image";
import { marca } from "@/lib/config";
import { etiquetaVersion } from "@/lib/version";

const AUTH_PATHS = ["/login", "/signup"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute =
    AUTH_PATHS.includes(pathname) || pathname.startsWith("/auth");

  const m = marca();

  if (isAuthRoute) {
    return (
      <div className="min-h-screen flex">
        <aside className="hidden md:flex md:w-1/2 lg:w-2/5 bg-[#0A1628] text-[#E8EDF5] p-12 flex-col justify-between relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 bg-gradient-to-br from-[#0A1628] via-[#0A1628] to-[#1E3A5F] opacity-90"
          />
          <div
            aria-hidden
            className="absolute top-12 right-12 h-64 w-64 rounded-full bg-primary/15 blur-3xl"
          />
          <div
            aria-hidden
            className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-primary/5 blur-3xl"
          />
          <div className="relative flex items-center gap-2.5">
            <Image
              src={m.logo}
              alt={m.nombre}
              width={36}
              height={36}
              unoptimized
              className="h-9 w-9 rounded-full object-cover shadow-lg shadow-primary/20 shrink-0"
            />
            <span className="text-lg font-semibold tracking-tight font-heading">
              {m.nombre}
            </span>
          </div>
          <div className="relative space-y-6 max-w-md">
            <p className="text-3xl lg:text-[34px] font-heading font-semibold tracking-tight leading-[1.15] text-balance">
              Tu pipeline de ventas, ordenado y conectado a WhatsApp.
            </p>
            <p className="text-sm text-white/60 leading-relaxed">
              {m.descripcion}
            </p>
          </div>
          <div className="relative flex items-center gap-3 text-xs text-white/40">
            <span className="h-1 w-1 rounded-full bg-emerald-400" />
            {etiquetaVersion()}
          </div>
        </aside>

        <div className="flex-1 flex items-center justify-center p-6 md:p-10 bg-background">
          <div className="w-full max-w-sm space-y-7">
            <div className="md:hidden flex items-center justify-center gap-2.5">
              <Image
                src={m.logo}
                alt={m.nombre}
                width={36}
                height={36}
                unoptimized
                className="h-9 w-9 rounded-full object-cover shadow-sm shrink-0"
              />
              <span className="text-lg font-semibold tracking-tight font-heading">
                {m.nombre}
              </span>
            </div>

            <div className="space-y-6">{children}</div>

            <p className="text-center text-xs text-muted-foreground">
              Al continuar aceptas los terminos y la politica de privacidad.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto max-w-[1480px] px-4 py-6 md:px-8 md:py-8 lg:px-10 lg:py-10 min-w-0">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
