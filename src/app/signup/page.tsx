import Link from "next/link";
import { AuthForm } from "@/components/auth/AuthForm";
import { registroAbierto } from "@/app/login/actions";
import { hayMiembros } from "@/lib/team";
import { proveedoresExternos, NOMBRE_PROVEEDOR } from "@/lib/auth-proveedores";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Crear cuenta",
};

export default async function SignupPage() {
  const abierto = await registroAbierto();
  const primera = !(await hayMiembros());
  const externos = await proveedoresExternos();
  const proveedores = externos.map((id) => ({ id, nombre: NOMBRE_PROVEEDOR[id] }));

  if (!abierto) {
    return (
      <div className="space-y-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight font-heading">
          El registro esta cerrado
        </h1>
        <p className="text-sm text-muted-foreground">
          Las cuentas las crea un administrador desde Configuracion → Equipo.
        </p>
        <Link href="/login" className="text-sm text-primary hover:underline">
          Volver a iniciar sesion
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight font-heading">
          {primera ? "Crea la cuenta de administrador" : "Crea tu cuenta"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {primera
            ? "Es la primera cuenta de esta instancia: queda como administrador y despues el registro se cierra solo."
            : "Empieza a gestionar tus leads en minutos"}
        </p>
      </div>
      <AuthForm mode="signup" proveedores={proveedores} />
    </>
  );
}
