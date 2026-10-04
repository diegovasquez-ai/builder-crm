import { FormDefinirClave } from "@/components/auth/FormDefinirClave";

export const metadata = {
  title: "Elegir contrasena",
};

export default function DefinirClavePage() {
  return (
    <>
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight font-heading">
          Elegi tu contrasena
        </h1>
        <p className="text-sm text-muted-foreground">
          Con esto ya entras al CRM
        </p>
      </div>
      <FormDefinirClave />
    </>
  );
}
