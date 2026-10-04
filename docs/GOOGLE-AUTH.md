# Entrar con Google

Opcional y apagado de fabrica. Si lo configuras, aparece el boton **Continuar con
Google** en el login; si no, no aparece y nadie se entera. El CRM no tiene ninguna
variable propia para esto: le pregunta al servidor de autenticacion que proveedores
tiene encendidos, asi que se configura en un solo lugar.

## Lo primero, porque cambia como piensas el resto

**Entrar con Google NO da acceso al CRM.** Igual que con email y contrasena, quien no
este dado de alta en Ajustes -> Equipo con ese mismo correo termina en `/sin-acceso`. El
proveedor dice *quien sos*; `team_members` dice *si entras y con que rol*. Sin esto,
encender Google seria abrirle la puerta a cualquiera con una cuenta de Gmail.

Orden de trabajo: primero das de alta a la persona en Ajustes -> Equipo con el correo
exacto de su cuenta de Google, **dejando la contrasena temporal vacia**, y despues ella
entra con el boton.

## Un cliente de OAuth por instancia

Cada instancia necesita el suyo. No se comparte entre clientes: la pantalla de
consentimiento de Google muestra el nombre del proyecto, y la URL de retorno es la de
esa instancia concreta.

1. Entra a [Google Cloud Console](https://console.cloud.google.com/) y crea un proyecto,
   o elige uno.
2. **APIs y servicios -> Pantalla de consentimiento de OAuth**. Tipo **Externo**. Nombre
   de la aplicacion y correo de contacto: los del cliente, no los tuyos. Mientras este
   en modo de prueba solo entran los correos que agregues como usuarios de prueba; para
   abrirlo al equipo del cliente, publicala.
3. **Credenciales -> Crear credenciales -> ID de cliente de OAuth**, tipo **Aplicacion
   web**.
4. En **URIs de redireccionamiento autorizados** va UNA sola, la de tu servidor de
   autenticacion:

   ```
   https://auth.tudominio.com/auth/v1/callback
   ```

   Con Supabase cloud es `https://TU_REF.supabase.co/auth/v1/callback`. Tiene que
   coincidir caracter por caracter, incluido `https`.
5. Guarda el **ID de cliente** y el **secreto**.

## Encenderlo

### Autoalojado (GoTrue en tu VPS)

Tres variables en el contenedor de autenticacion, y reiniciarlo:

```
GOTRUE_EXTERNAL_GOOGLE_ENABLED=true
GOTRUE_EXTERNAL_GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOTRUE_EXTERNAL_GOOGLE_SECRET=...
GOTRUE_EXTERNAL_GOOGLE_REDIRECT_URI=https://auth.tudominio.com/auth/v1/callback
```

Ademas, `GOTRUE_URI_ALLOW_LIST` tiene que incluir la URL del CRM, porque ahi vuelve el
usuario despues de entrar:

```
GOTRUE_URI_ALLOW_LIST=https://crm.tudominio.com/**
```

### Supabase cloud

Panel del proyecto -> **Authentication -> Providers -> Google**: pega el ID de cliente y
el secreto, y encendelo. En **URL Configuration** agrega `https://crm.tudominio.com/**`
a las *Redirect URLs*.

## Comprobarlo

```bash
curl https://auth.tudominio.com/auth/v1/settings -H "apikey: TU_ANON_KEY"
```

Tiene que traer `"external": { ..., "google": true }`. Eso es exactamente lo que mira el
CRM para dibujar el boton, asi que si sale `true` y recargas el login, el boton esta.

`npm run verificar` tambien lo informa, en la linea **Formas de entrar**.

## Como funciona por dentro

1. El boton llama a `signInWithOAuth` en el navegador y manda al usuario a Google.
2. Google lo devuelve a tu servidor de autenticacion, que lo manda a
   `https://crm.tudominio.com/auth/callback` con un codigo.
3. Esa ruta (`src/app/auth/callback/route.ts`) canjea el codigo por la sesion y deja las
   cookies.
4. El usuario cae en el inicio. Si no esta en `team_members`, va a `/sin-acceso`.

## Lo que se rompe y por que

- **`redirect_uri_mismatch` de Google.** La URI de retorno del paso 4 no coincide con la
  de la consola. Ojo con el `https`, con la barra final y con el dominio: va el del
  **servidor de autenticacion**, no el del CRM.
- **Vuelve al login sin error visible.** Suele ser `GOTRUE_URI_ALLOW_LIST` sin la URL del
  CRM: el proveedor se niega a redirigir a un destino que no esta en la lista.
- **Entra y cae en `/sin-acceso`.** Es lo correcto: falta darlo de alta en Ajustes ->
  Equipo con ese correo. No es un error de configuracion.
- **El boton no aparece.** El CRM cachea la respuesta de `/auth/v1/settings` cinco
  minutos. Espera o vuelve a desplegar.
- **La persona ya tenia cuenta con contrasena.** Google se vincula a la cuenta existente
  si el correo es el mismo y esta confirmado. Las cuentas que crea Ajustes -> Equipo
  nacen confirmadas, asi que se vinculan solas.
