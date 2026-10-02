import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Fila {
  id: string;
  titulo: string | null;
  tipo: string | null;
  operacion: string | null;
  precio: string | null;
  moneda: string | null;
  ambientes: number | null;
  dormitorios: number | null;
  m2: string | null;
  barrio: string | null;
  direccion: string | null;
  link: string | null;
}

function precio(f: Fila): string {
  if (!f.precio) return "—";
  const n = Number(f.precio);
  return `${f.moneda ?? ""} ${Number.isFinite(n) ? n.toLocaleString("es") : f.precio}`.trim();
}

/** Listado del catalogo (server component: recibe las filas ya consultadas). */
export function ListaPropiedades({ filas }: { filas: Fila[] }) {
  return (
    <div>
      <PageHeader
        title="Propiedades"
        subtitle={`${filas.length} en el catalogo. El agente las busca por criterios o por direccion.`}
      />
      {filas.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="El catalogo esta vacio"
          description="Carga propiedades con npm run sync:tokko (Tokko) o con el seed de demostracion."
        />
      ) : (
        <Card className="surface-card overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Propiedad</TableHead>
                  <TableHead className="hidden md:table-cell">Tipo</TableHead>
                  <TableHead className="hidden sm:table-cell">Operacion</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead className="hidden lg:table-cell">Amb. / Dorm.</TableHead>
                  <TableHead className="hidden lg:table-cell">m2</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((f) => (
                  <TableRow key={f.id}>
                    <TableCell>
                      <p className="font-medium leading-tight">{f.titulo ?? f.direccion ?? "Sin titulo"}</p>
                      <p className="text-xs text-muted-foreground">
                        {[f.direccion, f.barrio].filter(Boolean).join(" · ")}
                        {f.link && (
                          <>
                            {" · "}
                            <a href={f.link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                              ver publicacion
                            </a>
                          </>
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm">{f.tipo ?? "—"}</TableCell>
                    <TableCell className="hidden sm:table-cell text-sm">{f.operacion ?? "—"}</TableCell>
                    <TableCell className="text-sm tabular-nums">{precio(f)}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm tabular-nums">
                      {f.ambientes ?? "—"} / {f.dormitorios ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm tabular-nums">{f.m2 ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
