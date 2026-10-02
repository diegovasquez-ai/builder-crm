---
name: nueva-plantilla-nicho
description: |
  Convierte una adaptacion exitosa de un cliente en una plantilla reutilizable para otros
  clientes del mismo nicho: config/plantillas/<nicho>.ts generica, modulos sin datos del
  cliente, spec de la plantilla y seed coherente. Activar cuando el usuario dice: convierte
  esto en plantilla, quiero reutilizar lo de <cliente> para otros, nueva plantilla de nicho,
  plantilla para <clinicas|tiendas|...>.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Nueva plantilla de nicho

> Nicho / cliente de origen: $ARGUMENTS

Referencia: `config/plantillas/inmobiliaria.ts` + `modules/propiedades` +
`modules/visitas` + `specs/inmobiliaria/spec.md`.

## 1. Extraer la configuracion

1. Copia `config/cliente.ts` del cliente de origen a `config/plantillas/<nicho>.ts`
   exportando `plantilla<Nicho>: ConfigClienteEntrada` (no `definirConfig`).
2. **Despersonaliza**: marca generica ("Clinica Demo", colores neutros), sin
   telefonos, direcciones ni nombres reales; pipeline, campos y prompt del agente se
   conservan porque son del nicho, no del cliente.
3. El prompt del agente en espanol neutro (tu) salvo que el nicho sea regional; deja
   los placeholders `{{agente}}`, `{{negocio}}`, `{{canal}}`, `{{fecha}}`.
4. `modulos.activos` con los modulos del nicho (recordatorio en el comentario de que
   la lista real va en `config/modulos.json`).

## 2. Generalizar los modulos

Por cada modulo que la adaptacion creo:
- Nombre y textos genericos del nicho, no del cliente.
- Seed con datos inventados coherentes con el nicho (ciudades y nombres ficticios).
- README con variables de entorno y como se activa.
- Si el modulo dependia de un proveedor concreto del cliente (una API), deja el
  conector detras de variables de entorno y documenta la alternativa sin el.

## 3. Documentar

- `specs/<nicho>/spec.md` (ejemplo: `specs/inmobiliaria/spec.md`): problema del
  nicho, pipeline, campos, prompt, modulos, criterios de aceptacion.
- Una linea en `config/README.md` (tabla de plantillas) y en `README.md` del repo.
- `CHANGELOG.md`: "Nuevo: plantilla <nicho>".

## 4. Verificar

1. Con la plantilla activa en `config/cliente.ts` y sus modulos en
   `config/modulos.json`: `npm run typecheck && npm run lint && npm run build`.
2. Valida la config fuera de Next (zod): un script `tsx` que importe
   `esquemaConfig` y la plantilla y haga `safeParse` (ver `specs/nucleo/07-*`).
3. En una instancia de prueba: `npm run seed` y `/simulador` con un guion del nicho;
   el agente debe calificar con los campos y mover la etapa.
4. Deja `config/cliente.ts` y `config/modulos.json` como estaban (la plantilla no se
   activa sola).

Commit: `Agregar plantilla <nicho>`. Si el repo es un fork, abre un PR al repo original
para que la plantilla llegue a toda la comunidad.
