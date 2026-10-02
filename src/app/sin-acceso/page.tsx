import Link from "next/link";
import { ShieldOff } from "lucide-react";
import { signOut } from "@/app/login/actions";

/**
 * Usuario autenticado pero fuera del equipo: se desactivo, o entro por un signup que
 * ya no deberia estar abierto. No se le muestra nada del CRM.
 */
export default function SinAccesoPage() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center gap-4 px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border bg-card shadow-sm">
        <ShieldOff className="h-5 w-5 text-muted-foreground" />
      </div>
      <h1 className="text-lg font-medium">Tu usuario no forma parte del equipo</h1>
      <p className="text-sm text-muted-foreground max-w-sm">
        Pide a un administrador que te agregue desde Ajustes → Equipo. Si ya te
        agregaron, cierra sesion y vuelve a entrar.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="text-sm text-primary hover:underline cursor-pointer"
        >
          Cerrar sesion
        </button>
      </form>
      <Link href="/login" className="text-xs text-muted-foreground hover:underline">
        Ir al inicio de sesion
      </Link>
    </div>
  );
}
