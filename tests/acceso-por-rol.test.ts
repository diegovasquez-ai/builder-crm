import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { ownerFilter, visibleOwnerId } from "@/lib/team";
import type { TeamMember } from "@/lib/team";

/**
 * El filtro por propietario es lo unico que separa "el asesor ve sus contactos" de "el
 * asesor ve toda la cartera del cliente". Si un dia `ownerFilter` devolviera `undefined`
 * para un asesor, nada fallaria: las pantallas cargarian igual, con datos de mas. Por eso
 * el admin tiene que ser el UNICO caso sin filtro.
 */

function miembro(role: "admin" | "asesor"): TeamMember {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    email: "persona@ejemplo.com",
    name: "Persona",
    role,
    active: true,
  } as TeamMember;
}

describe("visibilidad por rol", () => {
  it("el administrador no lleva filtro", () => {
    expect(ownerFilter(miembro("admin"))).toBeUndefined();
    expect(visibleOwnerId(miembro("admin"))).toBeUndefined();
  });

  it("el asesor siempre lleva filtro", () => {
    const m = miembro("asesor");
    expect(ownerFilter(m)).toBeDefined();
    expect(visibleOwnerId(m)).toBe(m.id);
  });

  it("el filtro del asesor compara owner_id contra su propio id", () => {
    const m = miembro("asesor");
    const condicion = ownerFilter(m)!;
    // Se traduce la condicion a SQL sin tocar la base: asi se ve por que columna filtra
    // y con que valor. Lo que no puede pasar es que filtre por otra columna o por un id
    // que no sea el de quien pregunta.
    const { sql, params } = new PgDialect().sqlToQuery(condicion);
    expect(sql).toContain("owner_id");
    expect(params).toContain(m.id);
  });

  it("un rol desconocido no se trata como administrador", () => {
    // Si manana aparece un rol nuevo en la base, el default seguro es ver menos, no mas.
    const raro = { ...miembro("asesor"), role: "lo-que-sea" } as unknown as TeamMember;
    expect(ownerFilter(raro)).toBeDefined();
    expect(visibleOwnerId(raro)).toBe(raro.id);
  });
});
