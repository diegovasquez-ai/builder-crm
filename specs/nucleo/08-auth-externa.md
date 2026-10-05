# Spec: Entrar con un proveedor externo (Google y companeros)

**Carril**: completo (ruta publica nueva y camino de autenticacion)
**Estado**: implementada en 1.2.0 y 1.2.1
**Fecha**: 2026-10-04
**Escrita antes del codigo**: **no**. Salio de una pregunta del dueno mientras se
probaba la instancia desplegada y se construyo en el momento; esta spec se escribio
despues, para que `specs/nucleo/` siga describiendo el sistema completo. Lo que sigue es
lo que quedo construido, no un plan.

## Problema

El equipo de un cliente ya tiene cuenta de Google (Workspace o Gmail). Obligarlos a
recordar una contrasena mas para el CRM agrega una contrasena debil, un canal por donde
pasarsela y un soporte ("perdi la clave") que el administrador atiende a mano. Pero
encender un proveedor externo tiene un riesgo evidente: si entrar con Google diera acceso,
cualquiera con una cuenta de Gmail entraria al CRM del cliente.

## Decisiones del dueno

- D1 (2026-10-04) Se agrega al repo de la comunidad, opcional y **apagado de fabrica**.
- D2 (2026-10-04) El CRM no tiene variables propias para esto: se configura en el
  servidor de autenticacion y el CRM se adapta solo.

## Escenarios

1. **Sin configurar** — El login se ve exactamente como hoy: email y contrasena. Nadie se
   entera de que existe la posibilidad.
2. **Configurado** — Aparece "Continuar con Google" arriba del formulario, con un
   separador. Quien ya esta en el equipo con ese correo entra y cae en el inicio.
3. **Ajeno** — Alguien con una cuenta de Google que no esta en `team_members` entra al
   proveedor, vuelve al CRM y termina en `/sin-acceso`. No ve ningun dato.
4. **Alta ordenada** — El administrador da de alta a la persona en Ajustes -> Equipo con
   el correo exacto de su cuenta de Google y **sin contrasena temporal**; despues ella
   entra con el boton.

## Requisitos

- FR-001 `proveedoresExternos()` consulta `GET {SUPABASE_URL}/auth/v1/settings` con la
  clave anonima y devuelve los proveedores encendidos. Cachea 5 minutos, timeout de 5 s y
  **falla cerrado**: si no responde, lista vacia y queda solo email y contrasena.
- FR-002 `/login` y `/signup` reciben esa lista y renderizan un boton por proveedor
  (`BotonProveedor`, que llama a `signInWithOAuth` desde el navegador).
- FR-003 `GET /auth/callback` canjea el codigo por la sesion y redirige. La direccion de
  vuelta sale de `APP_BASE_URL` / `NEXT_PUBLIC_APP_URL` y solo si falta se miran las
  cabeceras del proxy: detras de un proxy el `origin` de la peticion es la direccion
  interna del contenedor (`https://0.0.0.0:3000`) y redirigir ahi manda a la nada.
- FR-004 El parametro `next` se acepta solo si es una ruta relativa (`/...` y no `//`):
  un `next` manipulado no puede mandar a otro sitio.
- FR-005 Entrar con un proveedor **no** otorga acceso: la membresia se sigue resolviendo
  contra `team_members` en cada ruta y layout, y sin fila se cae en `/sin-acceso`.
- FR-006 El alta desde Ajustes -> Equipo acepta contrasena vacia, para la persona que va
  a entrar solo por el proveedor.
- FR-007 Si el correo ya tenia usuario con contrasena, el proveedor se vincula a esa
  cuenta (las cuentas que crea Ajustes nacen confirmadas, que es lo que lo permite).

## Configuracion y modulos

Ninguna variable del CRM. Autoalojado: `GOTRUE_EXTERNAL_GOOGLE_ENABLED`, `CLIENT_ID`,
`SECRET`, `REDIRECT_URI` y la URL del CRM en `GOTRUE_URI_ALLOW_LIST`. Supabase cloud: el
interruptor del panel y las *Redirect URLs*. Paso a paso en `docs/GOOGLE-AUTH.md`.

## Modelo de datos

Ninguno. La identidad la guarda el proveedor en su propio esquema (`auth.identities`).

## Agente de IA

No lo toca.

## Criterios de aceptacion

- CA-001 Sin configurar, `/login` no muestra ningun boton de proveedor.
- CA-002 Con Google encendido, `/auth/v1/settings` trae `"google": true` y el boton
  aparece sin tocar el CRM.
- CA-003 Un usuario de Google que no esta en `team_members` termina en `/sin-acceso`.
- CA-004 La vuelta del proveedor aterriza en el dominio publico, no en `0.0.0.0:3000`.
- CA-005 `npm run verificar` informa los proveedores en la linea "Formas de entrar".

## Constitution Check

- I. Nucleo intocable: es nucleo; la instancia no necesita editar nada para activarlo.
- II. Spec antes que codigo: **no se cumplio**; esta spec es posterior y lo declara.
- III. Autoverificacion: el verificador informa las formas de entrar.
- IV. Cero secretos: las credenciales del proveedor viven en el servidor de
  autenticacion; el repo solo documenta sus nombres.

## Fuera de alcance

- Vincular y desvincular proveedores desde la UI del CRM.
- Dominio permitido (entrar solo con correos de una empresa): hoy lo resuelve
  `team_members`, que es una lista explicita y mas estricta.
- SAML y SSO corporativo.
