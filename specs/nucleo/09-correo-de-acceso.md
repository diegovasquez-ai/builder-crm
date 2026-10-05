# Spec: Correos de acceso (invitaciones y recuperar la contrasena)

**Carril**: completo (rutas publicas nuevas, variable nueva, camino de autenticacion)
**Estado**: implementada en 1.3.0
**Fecha**: 2026-10-04
**Escrita antes del codigo**: **no**. Nacio de tres preguntas del dueno sobre el alta de
miembros ("cuando se les invita les llega un correo?") y se construyo en el momento. Esta
spec documenta lo que quedo.

## Problema

El alta de un miembro creaba la cuenta al instante y el administrador tenia que pasarle
la contrasena temporal por donde pudiera: un chat, un audio, un papel. Dos consecuencias:
la contrasena viaja por un canal que nadie controla y queda escrita ahi para siempre, y la
persona entra con una clave que no eligio y que probablemente no cambie. Ademas no habia
ninguna forma de recuperar una contrasena: la unica salida era pedirle a un administrador
que la cambiara a mano.

## Decisiones del dueno

- D1 (2026-10-04) Se usa **Resend** como proveedor recomendado en la documentacion, por
  SMTP. Cualquier otro SMTP sirve igual.
- D2 (2026-10-04) Opcional y apagado de fabrica: sin configurar, el alta sigue siendo con
  contrasena temporal, como hasta 1.2.2.

## Escenarios

1. **Invitar** — El administrador agrega a alguien en Ajustes -> Equipo y elige "Como
   entra: invitacion por correo". La persona recibe un enlace, elige su contrasena y
   entra. El administrador nunca ve ni maneja esa contrasena.
2. **Reenviar** — La persona perdio el correo o la contrasena. El administrador aprieta el
   sobre en su fila y le llega un enlace nuevo. Nada cambia hasta que lo usa.
3. **Olvide mi contrasena** — Desde el login, la persona pide el enlace con su correo y
   llega a la misma pagina para elegir una nueva.
4. **Sin SMTP** — No aparece ninguna de las tres cosas: el alta pide contrasena temporal y
   `/auth/recuperar` explica que el acceso lo reparte un administrador.
5. **Enlace vencido o usado** — La pagina lo dice con claridad y ofrece pedir otro, en vez
   de dejar un formulario que no va a funcionar.

## Requisitos

- FR-001 El correo lo manda el servidor de autenticacion con su propio SMTP. El CRM no
  tiene credenciales de correo ni plantillas compiladas dentro.
- FR-002 `AUTH_ENVIA_CORREOS=true` declara la capacidad. Es un interruptor **manual** a
  proposito: GoTrue sin SMTP no falla, usa un cliente de correo que se traga el mensaje y
  responde 200, asi que no hay nada que detectar y sin el interruptor la UI diria
  "invitacion enviada" sobre un correo que nunca salio.
- FR-003 La capacidad viaja al navegador en el bloque de configuracion publica
  (`authEnviaCorreos`), que es la misma fuente que mira la API: la UI y el servidor no
  pueden contradecirse.
- FR-004 `POST /api/team` con `invitar: true` usa `inviteUserByEmail` con `redirectTo`
  a `/auth/definir-clave`. GoTrue crea el usuario y manda el correo en una transaccion: si
  el envio falla no queda ningun usuario a medias y el error se muestra tal cual.
- FR-005 Si el correo ya tenia usuario, no se invita de nuevo (GoTrue responde
  `email_exists`): se lo suma al equipo y se le manda un enlace de acceso. Si ese envio
  falla, el alta igual vale y la UI avisa.
- FR-006 `POST /api/team/[id]/acceso` (solo admin) reenvia el acceso. Rechaza miembros
  desactivados y miembros sin usuario de Auth, con el motivo.
- FR-007 `/auth/recuperar` pide el correo por una accion de servidor y responde **lo
  mismo exista o no la cuenta**; los limites de frecuencia los pone el proveedor.
- FR-008 Los correos de acceso se piden con un cliente anonimo de un solo uso y **flujo
  implicito**: PKCE guarda un verificador en el navegador que pidio el correo y ataria el
  enlace a ese navegador, cuando aca lo pide el servidor o un administrador desde otra
  computadora.
- FR-009 `/auth/definir-clave` corre en el navegador (la sesion llega en el fragmento de
  la URL, que no llega al servidor), guarda la sesion, **limpia la barra de direcciones**
  para que el enlace no quede en el historial ni en una captura, exige 8 caracteres y
  confirmacion, y al guardar recarga entera para que el servidor vea las cookies nuevas.
  Tambien acepta `?code=` (PKCE) para el caso de Supabase cloud.
- FR-010 `GET /correo/[plantilla].html` sirve las dos plantillas con la marca de la
  instancia, en espanol. Es publica porque la descarga el servidor de autenticacion, que
  no tiene sesion; son plantillas vacias, sin datos de nadie. Si la URL no responde,
  GoTrue usa su plantilla por defecto y el correo sale igual.
- FR-011 `/api/health` informa `correo: true|false` y el verificador lo dice en la linea
  "Formas de entrar".
- FR-012 Esto no abre el registro publico: sigue entrando solo quien esta en
  `team_members`, y una invitacion es un alta que hizo un administrador.

## Configuracion y modulos

`AUTH_ENVIA_CORREOS` y `APP_BASE_URL` en el CRM (sin la segunda se niega a invitar, en vez
de mandar un enlace a la nada). SMTP, asuntos, rutas de verificacion y plantillas en el
servidor de autenticacion. Paso a paso en `docs/CORREO.md`.

## Modelo de datos

Ninguno. Los tokens y su vencimiento viven en el esquema `auth`.

## Agente de IA

No lo toca.

## Criterios de aceptacion

- CA-001 Con SMTP configurado, invitar a una direccion de prueba manda un correo con el
  asunto y la plantilla de la instancia (verificado contra los registros del proveedor).
- CA-002 El enlace del correo lleva a `/auth/definir-clave` del dominio publico con la
  sesion lista, y despues de guardar la persona entra con su rol.
- CA-003 Un enlace usado dos veces muestra "el enlace ya se uso", no un error crudo.
- CA-004 Con `AUTH_ENVIA_CORREOS` apagado no aparece ni el selector, ni el sobre, ni el
  "la olvidaste?", y `/api/health` responde `correo: false`.
- CA-005 La plantilla responde 200 en `/correo/invitacion.html` con el nombre y los
  colores de la marca, y 404 con cualquier otro nombre.

## Constitution Check

- I. Nucleo intocable: es nucleo; la marca de los correos sale de `config/cliente.ts`, sin
  tocar `src/`.
- II. Spec antes que codigo: **no se cumplio**; esta spec es posterior y lo declara.
- III. Autoverificacion: `/api/health` y el verificador informan la capacidad.
- IV. Cero secretos: la clave del SMTP vive en el servidor de autenticacion; el repo solo
  documenta nombres y placeholders.

## Fuera de alcance

- Correo transaccional del CRM (resumenes, aviso de lead nuevo): para eso estan los avisos
  push.
- Mandar los correos desde el CRM con la API de Resend: obligaria a tener una ruta publica
  que dispara envios y a limitarla a mano, cuando el proveedor ya hace las dos cosas.
- Elegir el proveedor desde la UI.
