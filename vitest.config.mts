import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Tests del nucleo. Corren sin base de datos, sin red y sin servidor: son los
 * invariantes que, si se rompen, **no avisan**. Un contacto que se ve de mas, un
 * webhook falso que entra, un mensaje que WhatsApp descarta en silencio.
 *
 * Lo que necesita base o navegador no vive aca: eso lo cubre
 * `scripts/verificar-instancia.mjs` contra la instancia desplegada.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(process.cwd(), "src"),
      "@config": path.resolve(process.cwd(), "config"),
      "@modules": path.resolve(process.cwd(), "modules"),
      "server-only": path.resolve(process.cwd(), "tests/server-only-vacio.ts"),
    },
  },
});
