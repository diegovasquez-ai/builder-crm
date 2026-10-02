import { AuthForm } from "@/components/auth/AuthForm";

export const metadata = {
  title: "Iniciar sesion",
};

export default function LoginPage() {
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
      <AuthForm mode="login" />
    </>
  );
}
