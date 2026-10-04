# Correos de acceso (invitaciones y "olvide mi contrasena")

Opcional y apagado de fabrica. Sin esto el CRM funciona igual: el administrador crea la
cuenta en **Ajustes -> Equipo** y le pasa la contrasena temporal por donde quiera.

Con esto encendido aparecen tres cosas:

| Donde | Que aparece |
|---|---|
| Ajustes -> Equipo -> Agregar | **Como entra: invitacion por correo**. La persona elige su propia contrasena. |
| Ajustes -> Equipo, en cada fila | Un boton de sobre: **reenviar el acceso**, para quien perdio la contrasena. |
| Login | **La olvidaste?**, que lleva a pedir un enlace. |

Los tres llevan a la misma pagina (`/auth/definir-clave`), donde la persona elige su
contrasena y entra. El enlace sirve **una sola vez y vence a las 24 horas**.

## Lo primero, porque explica todo lo demas

**El CRM no manda correos: los manda el servidor de autenticacion.** El CRM no tiene
credenciales de SMTP ni plantillas propias; le pide a GoTrue (o a Supabase cloud) que
mande la invitacion, y GoTrue genera el enlace, controla los limites de envio y envia.

Por eso la configuracion esta en dos lugares distintos y los dos son obligatorios:

1. **El SMTP, en el servidor de autenticacion.** Es lo que hace que el correo salga.
2. **`AUTH_ENVIA_CORREOS=true`, en el CRM.** Es lo que hace que la UI lo ofrezca.

Y por eso hace falta el interruptor, que es la pregunta obvia al leer esto: cuando GoTrue
no tiene SMTP configurado **no falla**. Usa un cliente de correo que se traga el mensaje y
responde 200. Sin el interruptor, el CRM diria "invitacion enviada" sobre un correo que
nunca salio. Es lo contrario a entrar con Google, que se detecta solo preguntandole al
proveedor (ver [GOOGLE-AUTH.md](GOOGLE-AUTH.md)): el SMTP no aparece en esa respuesta, no
hay nada que preguntar.

Regla practica: **enciende el interruptor despues de que un correo de prueba llegue de
verdad**, no antes.

## Paso a paso con Resend

Cualquier SMTP sirve (Postmark, SES, Brevo, el del cliente). Resend es el camino corto:
plan gratuito de 3.000 correos por mes, SMTP sin vueltas y registros DNS claros.

### 1. El dominio

En [resend.com](https://resend.com) -> **Domains -> Add Domain**. Usa un **subdominio**,
no el dominio pelado:

```
send.tudominio.com
```

Asi la reputacion de envio del CRM no se mezcla con el correo de la empresa, y si algun
dia se manda algo que termina en spam, no arrastra al dominio principal.

Resend te da tres o cuatro registros DNS (un MX, un TXT de SPF, un TXT de DKIM y,
opcional, un DMARC). Se pegan tal cual en el DNS del dominio. En Cloudflare, **sin
proxy** (nube gris). Verifica en minutos; a veces tarda una hora.

> Mientras el dominio no este verificado, Resend solo deja mandar desde
> `onboarding@resend.dev` y **solo a la direccion del dueno de la cuenta**. Sirve para
> probar que el SMTP responde, no para invitar a nadie.

### 2. La clave

**API Keys -> Create API Key**, permiso **Sending access** y, si te lo ofrece,
restringida al dominio que acabas de crear. Guardala: no se vuelve a mostrar.

### 3. Los datos del SMTP

| Dato | Valor |
|---|---|
| Host | `smtp.resend.com` |
| Puerto | `465` (TLS directo; tambien anda 587 con STARTTLS) |
| Usuario | `resend` |
| Contrasena | la API key (`re_...`) |
| Remitente | una direccion **del dominio verificado**, por ejemplo `crm@send.tudominio.com` |

El remitente no necesita existir como casilla: nadie va a responder ahi. Si queres que
puedan responder, usa una que exista.

## Encenderlo

### Autoalojado (GoTrue en tu VPS)

En las variables del contenedor de autenticacion, y reiniciarlo:

```
GOTRUE_SMTP_HOST=smtp.resend.com
GOTRUE_SMTP_PORT=465
GOTRUE_SMTP_USER=resend
GOTRUE_SMTP_PASS=re_...
GOTRUE_SMTP_ADMIN_EMAIL=crm@send.tudominio.com
GOTRUE_SMTP_SENDER_NAME=Nombre del CRM
GOTRUE_SMTP_MAX_FREQUENCY=10s

GOTRUE_MAILER_URLPATHS_INVITE=/auth/v1/verify
GOTRUE_MAILER_URLPATHS_RECOVERY=/auth/v1/verify
GOTRUE_MAILER_URLPATHS_CONFIRMATION=/auth/v1/verify
GOTRUE_MAILER_URLPATHS_EMAIL_CHANGE=/auth/v1/verify

GOTRUE_MAILER_SUBJECTS_INVITE=Te sumaron al CRM
GOTRUE_MAILER_SUBJECTS_RECOVERY=Volver a entrar al CRM

GOTRUE_MAILER_TEMPLATES_INVITE=https://crm.tudominio.com/correo/invitacion.html
GOTRUE_MAILER_TEMPLATES_RECOVERY=https://crm.tudominio.com/correo/recuperacion.html
```

Dos detalles que no se adivinan:

- **`GOTRUE_URI_ALLOW_LIST` tiene que incluir la URL del CRM** (`https://crm.tudominio.com/**`).
  Es el destino al que vuelve la persona despues del enlace; si no esta en la lista, el
  proveedor se niega y nadie entiende por que.
- **Los `URLPATHS` empiezan con `/auth/v1`** si expusiste GoTrue como indica
  [SUPABASE-EN-VPS.md](SUPABASE-EN-VPS.md), donde el dominio incluye esa ruta y el proxy
  la recorta. Si tu GoTrue esta publicado en la raiz, van como `/verify`. El enlace del
  correo se arma con `API_EXTERNAL_URL` + esta ruta: si queda mal, el correo llega y el
  enlace da 404.

### Supabase cloud

**Project Settings -> Authentication -> SMTP Settings**: los mismos cinco datos de la
tabla de arriba. Y en **Authentication -> URL Configuration**, agrega
`https://crm.tudominio.com/**` a las *Redirect URLs*.

Esto no es opcional en cloud aunque los correos "ya funcionen": sin SMTP propio, Supabase
manda **2 correos por hora** con su remitente y una advertencia de que es solo para
desarrollo. Con un equipo de cinco personas te quedas a mitad de camino.

Las plantillas en cloud se pegan a mano en **Authentication -> Emails**: abri
`https://crm.tudominio.com/correo/invitacion.html`, copia el HTML y pegalo ahi. Misma
plantilla, otro camino.

### El CRM

```
AUTH_ENVIA_CORREOS=true
APP_BASE_URL=https://crm.tudominio.com
```

`APP_BASE_URL` ya deberia estar: es la que arma el enlace al que vuelve la persona. Sin
ella el CRM se niega a invitar, en lugar de mandar un correo con un enlace a la nada.

## Las plantillas

El CRM sirve las dos plantillas con la marca de la instancia (nombre, logo y color de
`config/cliente.ts`), en espanol y en HTML de correo:

```
https://crm.tudominio.com/correo/invitacion.html
https://crm.tudominio.com/correo/recuperacion.html
```

GoTrue las descarga y reemplaza el enlace al enviar. Son publicas a proposito: las pide
un servidor que no tiene sesion en el CRM, y no contienen datos de nadie. Si la URL no
responde, GoTrue usa su plantilla por defecto, que es correcta pero esta en ingles.

Para cambiar los textos: `src/lib/plantillas-correo.ts`. Para cambiar los colores no hace
falta tocar nada, salen de la marca.

## Comprobarlo

```bash
# 1. La plantilla esta publica (tiene que dar 200 y traer el nombre del cliente)
curl -s https://crm.tudominio.com/correo/invitacion.html | head -20

# 2. La instancia declara la capacidad
curl -s https://crm.tudominio.com/api/health
# -> {"ok":true,...,"correo":true}
```

3. Invitate a vos mismo a una direccion que no sea la del admin y mira que llegue. En
   Resend, **Logs** muestra cada envio con su estado.
4. `npm run verificar` lo informa en la linea **Formas de entrar**.

## Lo que se rompe y por que

- **La UI dice "invitado" y el correo no llega.** `AUTH_ENVIA_CORREOS=true` pero el
  servidor de autenticacion no tiene SMTP: se lo traga en silencio. Es el motivo de que
  el interruptor sea manual. Mira los logs del contenedor de auth.
- **Resend responde que el dominio no esta verificado.** Faltan los registros DNS, o el
  remitente no es del dominio verificado.
- **El enlace del correo lleva a `0.0.0.0:3000` o a `localhost`.** Falta `APP_BASE_URL`
  en el CRM.
- **"requested path is invalid".** `GOTRUE_URI_ALLOW_LIST` sin la URL del CRM.
- **El enlace dice "ya se uso" sin haberlo usado.** Algunos correos corporativos
  (Outlook con SafeLinks, antivirus con analisis de enlaces) abren los enlaces antes que
  la persona, y el enlace vale una sola vez. Reenvia el acceso y pedile que lo abra desde
  el telefono, o dale una contrasena temporal.
- **"email_exists" al invitar.** Ese correo ya tiene usuario (se registro antes o entro
  con Google). El CRM no lo invita de nuevo: lo suma al equipo y le manda un enlace para
  definir la contrasena.
- **El segundo correo no sale.** `GOTRUE_SMTP_MAX_FREQUENCY` limita los envios a la misma
  persona, y `GOTRUE_RATE_LIMIT_EMAIL_SENT` el total por hora. Son defensas, no errores.
- **Cae en spam.** Verifica SPF y DKIM, manda desde el dominio del cliente y agrega un
  registro DMARC.

## Que NO hace esto

- No es correo transaccional del CRM: no manda resumenes, avisos de lead nuevo ni
  notificaciones. Para eso estan los avisos push (Ajustes -> Notificaciones).
- No abre el registro publico. Seguir siendo cierto: **solo entra quien esta en
  `team_members`**, y ahi lo pone un administrador. Una invitacion es un alta que hizo un
  admin, nada mas.
