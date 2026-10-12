# Spec: zona horaria de la instancia

**Carril**: completo — *toca el esquema de configuracion, que es nucleo.*
**Estado**: implementada
**Fecha**: 2026-10-12
**Escrita antes del codigo**: si

## Problema

El CRM no sabe en que zona horaria vive el negocio. En todo el repo no hay una sola
referencia a zona horaria, y el contenedor no define `TZ`, asi que el servidor corre en
UTC.

Eso ya esta fallando, sin ninguna funcion de agenda de por medio: el prompt del agente
incluye `{{fecha}}` ("la fecha de hoy es ..."), y esa fecha se calcula con la zona del
proceso. En Chile, desde las 21:00 hasta la medianoche, el agente cree que ya es el dia
siguiente. Un cliente que escribe a las 22:00 un miercoles y pregunta "atienden manana?"
recibe la respuesta corrida un dia. El canal donde pasa es WhatsApp, de noche, que es
justo cuando mas se usa.

Lo mismo pasa en pantalla: `formatDate` y `formatRelativeDate` ("Hoy", "Ayer") resuelven
el dia calendario con la zona del proceso al renderizar en el servidor y con la del
dispositivo en el navegador, asi que la misma fila puede decir dos cosas distintas.

Nada de esto se ve como un error: no hay excepcion, no hay log, no hay check en rojo. Se
ve como un agente que se equivoco de dia.

## Decisiones del dueno

- **D1** Se agrega solo la zona horaria. El agendamiento de citas (ventana de atencion,
  horarios disponibles, reserva, calendario externo) **no** se construye hasta que un
  cliente lo pida, y cuando pase se construye como modulo con `crear-modulo`.
- **D2** La zona horaria entra ahora, y no cuando aparezca el primer cliente con citas,
  porque vive en el nucleo: un miembro que la necesite tendria que editar `src/`, que es
  lo que el principio I prohibe, y el parche se le rompe en cada actualizacion.
- **D3** El valor por defecto no cambia el comportamiento de las instancias que ya estan
  desplegadas.

## Escenarios

1. **Configurar** — el miembro pone `zonaHoraria: "America/Santiago"` en
   `config/cliente.ts` y la instancia usa esa zona para todo lo que sea dia u hora.
2. **Equivocarse** — el miembro escribe `"America/Santigo"` (con un error de tipeo) y la
   configuracion se rechaza al validar, con el nombre del campo y el valor en el
   mensaje. No arranca con una zona silenciosamente ignorada.
3. **No configurar** — una instancia que no declara zona horaria sigue comportandose
   como hoy (UTC), sin romperse al actualizar el nucleo.
4. **Conversar de noche** — un cliente escribe a las 22:00 hora local y el agente le
   nombra el dia correcto.
5. **Mirar la ficha** — una actividad de ayer a las 23:00 dice "Ayer" tanto si la pagina
   se renderizo en el servidor como si se renderizo en el navegador.

## Requisitos

- FR-001 El esquema de configuracion DEBE aceptar `zonaHoraria`, un identificador IANA
  (`America/Santiago`, `America/Mexico_City`, `Europe/Madrid`).
- FR-002 El esquema DEBE rechazar un valor que el entorno no reconozca como zona
  horaria, con un mensaje que incluya el valor recibido.
- FR-003 El valor por defecto DEBE ser `UTC`, para no mover las fechas de una instancia
  ya desplegada que actualice el nucleo sin tocar su configuracion (D3).
- FR-004 `config/cliente.ts` DEBE traer la zona declarada explicitamente, para que el
  miembro la vea al adaptar y no quede en el default por omision.
- FR-005 El prompt del agente DEBE calcular `{{fecha}}` en la zona configurada.
- FR-006 `formatDate` y `formatRelativeDate` DEBEN resolver el dia calendario en la zona
  configurada, de modo que el resultado no dependa de donde se renderizo.
- FR-007 La validacion DEBE poder correr en un componente cliente: el esquema no importa
  nada server-only y esto no lo cambia.

## Configuracion y modulos

`config/cliente.ts` suma una clave:

```ts
zonaHoraria: "America/Santiago",
```

`config/plantillas/inmobiliaria.ts` la declara tambien. Ningun modulo nuevo.

## Modelo de datos

Ninguno. Las columnas ya son `timestamptz`, que guarda el instante; lo que faltaba era
con que zona interpretarlo al mostrarlo o al nombrarlo.

## Agente de IA

El placeholder `{{fecha}}` pasa a resolverse en la zona de la instancia. El texto del
prompt por defecto no cambia, asi que las instancias con prompt propio tampoco se ven
afectadas: siguen recibiendo `{{fecha}}`, ahora correcta.

No se agregan tools ni se le da la hora al agente (solo el dia), porque eso es parte del
agendamiento y esta fuera de alcance.

## Criterios de aceptacion

- CA-001 `npm test` pasa con cinco casos nuevos: acepta una zona IANA, usa `UTC` por
  default, rechaza una zona mal escrita nombrandola en el mensaje, el prompt nombra el
  dia de la zona del negocio, y "Hoy"/"Ayer" cambian a la medianoche local.
- CA-002 `npm run typecheck && npm run lint && npm run build` en verde, con `build` sin
  `DATABASE_URL` como lo corre el CI.
- CA-003 La suite pasa igual con el proceso en UTC (`TZ=UTC npm test`) y en la zona
  local. Es la unica forma de saber que el resultado no depende del reloj del contenedor:
  en la maquina de un miembro chileno el bug no se reproduce.
- CA-004 Una configuracion sin `zonaHoraria` sigue validando, y una instancia que no la
  declara ve las mismas fechas que antes de actualizar.

Los casos se escribieron de modo que no dependan de la zona declarada en
`config/cliente.ts`: la expectativa se calcula comparando el dia local, asi que siguen
siendo correctos en la instancia de un miembro que la cambie.

## Constitution Check

- **I. Nucleo intocable**: excepcion justificada. Es un cambio del nucleo hecho en el
  repo original, no un parche en una instancia: es exactamente el camino que el
  principio I manda seguir cuando una adaptacion necesita algo generico (D2).
- **II. Spec antes que codigo**: cumple.
- **III. Autoverificacion**: cumple. CA-001 y CA-002 corren sin base ni red; el caso de
  la noche (CA-003, CA-004) se prueba con un instante fijo, no con el reloj.
- **IV. Cero secretos**: no aplica. Una zona horaria no es una credencial, y por eso va
  en configuracion y no en entorno.

## Fuera de alcance

- **Agendamiento de citas**: ventana de atencion, horarios disponibles, reserva con
  candado, apartado con vencimiento, `.ics`, Google Calendar. Se construye como modulo
  cuando un cliente lo pida (D1).
- **Darle la hora al agente**, no solo el dia. Hace falta para responder "atienden
  ahora?", pero cambia como responde el agente y eso merece su propia decision.
- **Zona horaria por miembro del equipo.** La instancia es de un negocio que opera en un
  lugar; un asesor de viaje sigue viendo la hora del negocio, que es la que importa para
  coordinar.
- **`TZ` en el contenedor.** Dejar el proceso en UTC y resolver la zona al mostrar es lo
  correcto: una imagen compartida por muchas instancias no puede tener la zona horneada.
