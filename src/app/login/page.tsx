import { AuthForm } from "@/components/auth/AuthForm";
import { proveedoresExternos, NOMBRE_PROVEEDOR } from "@/lib/auth-proveedores";

export const metadata = {
  title: "Iniciar sesion",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const externos = await proveedoresExternos();
  const proveedores = externos.map((id) => ({ id, nombre: NOMBRE_PROVEEDOR[id] }));

  return (
    <>
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight font-heading">
          Bienvenido de vuelta
        </h1>
        <p className="text-sm text-muted-foreground">
          Inicia sesion para gestionar tu pipeline
        </p>
      </div>
      <AuthForm mode="login" proveedores={proveedores} errorInicial={error ?? null} />
    </>
  );
}
