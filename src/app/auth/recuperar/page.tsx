import Link from "next/link";
import { FormRecuperar } from "@/components/auth/FormRecuperar";
import { correoDeAccesoActivo } from "@/lib/auth-correo";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Recuperar el acceso",
};

export default function RecuperarPage() {
  const activo = correoDeAccesoActivo();

  return (
    <>
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight font-heading">
          Recuperar el acceso
        </h1>
        <p className="text-sm text-muted-foreground">
          {activo
            ? "Te mandamos un enlace para elegir una contrasena nueva"
            : "Esta instancia no manda correos todavia"}
        </p>
      </div>

      {activo ? (
        <FormRecuperar />
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            El acceso lo reparte un administrador desde Ajustes, Equipo: pedile que te
            genere una contrasena nueva y te la pase.
          </p>
          <Button render={<Link href="/login" />} variant="outline" className="w-full h-10">
            Volver al inicio de sesion
          </Button>
        </div>
      )}
    </>
  );
}
