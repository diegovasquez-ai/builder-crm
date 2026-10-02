# Spec: Casa Sur — inmobiliaria (ejemplo de spec de cliente)

> Ejemplo completo de la spec que `adaptar-a-cliente` escribe para un cliente del nicho
> inmobiliario. Los datos son inventados. Sirve como referencia de nivel de detalle.

**Carril**: ligero (usa la plantilla inmobiliaria y sus dos modulos; sin tablas nuevas)
**Estado**: aprobada
**Fecha**: 2026-10-02
**Escrita antes del codigo**: si

## Problema

Casa Sur es una inmobiliaria con tres asesores que atiende leads de portales,
Instagram y WhatsApp desde telefonos personales. Pierden consultas fuera de horario,
nadie sabe en que etapa esta cada lead y las visitas se coordinan por chat suelto.
Necesitan una bandeja unica con un agente que califique (operacion, tipo, zona,
presupuesto, dormitorios), muestre opciones del catalogo y agende visitas, con un
pipeline visible para el equipo.

## Decisiones del dueno

- D1 Nicho: inmobiliaria (venta y arriendo) -> plantilla `inmobiliaria`.
- D2 Dominio `crm.casasur.ejemplo`, Coolify del miembro, proyecto Supabase nuevo.
- D3 OpenRouter con `anthropic/claude-sonnet-4.5` (la agencia paga el modelo).
- D4 Canales: WhatsApp e Instagram via Zernio; Messenger no (no tienen pagina).
- D5 Tono del agente: espanol neutro, cercano, sin "¿" inicial (preferencia del
  cliente).

## Escenarios

1. **Recibir** — Un lead escribe por WhatsApp "hola, vi el depto de Providencia":
   entra a la bandeja, el agente responde en segundos con los datos del catalogo y
   pregunta operacion y presupuesto.
2. **Calificar** — Con operacion, tipo, zona y presupuesto conocidos, el agente guarda
   los campos en la ficha y mueve la operacion a "Calificado".
3. **Ofrecer** — Si el lead describe lo que busca, el agente ofrece 2-3 propiedades
   del catalogo (nunca inventadas).
4. **Agendar** — Si el lead quiere visitar, el agente crea la visita en coordinacion y
   mueve a "Visita agendada"; un asesor confirma fecha desde `/m/visitas`.
5. **Derivar** — Preguntas de financiamiento o documentacion pasan a una persona; el
   hilo queda pausado con el motivo y el asesor lo reactiva al terminar.
6. **Ver** — Los asesores ven solo sus leads; la dueña (admin) ve todo y los reportes.

## Requisitos

- FR-001 Marca: nombre "Casa Sur", corto "CasaSur", color primario `#1E6F5C`, logo
  del cliente en `public/marca/`.
- FR-002 Pipeline: Nuevo lead -> Calificado -> Visita agendada -> Visita realizada ->
  Negociacion -> Cerrado ganado / Cerrado perdido (claves de la plantilla).
- FR-003 Campos: tipo_operacion (Compra/Arriendo), tipo_propiedad, zona,
  presupuesto (numero), dormitorios (numero); los cinco calificables por el agente.
- FR-004 Modulos activos: `propiedades`, `visitas`.
- FR-005 Agente: prompt de la plantilla con tono D5; derivar ante financiamiento,
  documentacion o pedido de hablar con una persona.
- FR-006 Moneda USD; idioma es; etiqueta de rol "Asesor".
- FR-007 Catalogo: cargar desde Tokko (`TOKKO_API_KEY` del cliente) con
  `npm run sync:tokko`; mientras no haya key, seed de demo.

## Configuracion y modulos

`config/cliente.ts`:

```ts
import { definirConfig } from "@/lib/config/schema";
import modulos from "./modulos.json";
import { plantillaInmobiliaria } from "./plantillas/inmobiliaria";

export default definirConfig({
  ...plantillaInmobiliaria,
  marca: {
    ...plantillaInmobiliaria.marca,
    nombre: "Casa Sur",
    nombreCorto: "CasaSur",
    descripcion: "Propiedades en venta y arriendo. Te respondemos al instante.",
  },
  agente: {
    ...plantillaInmobiliaria.agente,
    nombre: "Sofia de Casa Sur",
  },
  modulos: { ...plantillaInmobiliaria.modulos, activos: modulos.activos },
});
```

`config/modulos.json`: `{ "activos": ["propiedades", "visitas"] }`.

## Modelo de datos

Ninguno nuevo (tablas `propiedades` y `visitas` de los modulos).

## Agente de IA

Prompt de la plantilla + ajuste de tono (D5): se agrega al final del prompt
"Escribis las preguntas sin el signo de apertura ¿". Campos a calificar: los cinco.
Tools: las genericas + `buscar_propiedades`, `buscar_info_propiedades`,
`agendar_visita`.

## Criterios de aceptacion

- CA-001 `probar-instancia` en verde contra `https://crm.casasur.ejemplo` con
  `--marca "Casa Sur" --etapas nuevo,calificado,visita_agendada --modulos propiedades,visitas`.
- CA-002 En `/simulador`, el guion "busco un depto de 2 dormitorios en Providencia,
  tengo 150 mil para comprar" termina con campos cargados y la operacion en
  "Calificado"; "quiero visitarlo" crea la visita y mueve a "Visita agendada".
- CA-003 Un asesor no ve los leads de otro asesor en `/contacts` ni en `/reportes`.
- CA-004 `git status` tras la adaptacion solo muestra `config/`, `public/marca/`,
  `public/icons/` y `specs/casasur/`.

## Constitution Check

- I. Nucleo intocable: cumple (solo config, modulos existentes y assets).
- II. Spec antes que codigo: esta spec.
- III. Autoverificacion: CA-001 y CA-002.
- IV. Cero secretos: Tokko, OpenRouter y Zernio por variables de la instancia.

## Fuera de alcance

- Messenger (D4). Integracion con el portal propio del cliente (no tiene). Firma
  digital de contratos.
