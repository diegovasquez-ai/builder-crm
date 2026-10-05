# Base de datos y Auth en tu propio VPS

Builder CRM funciona con Supabase cloud, que es el camino corto. Esta guia es para el
otro caso: **todo en tu VPS, sin cuenta de Supabase**. Sirve para un servidor de demos,
para un cliente que no quiere datos fuera de su infraestructura, o para no sumar una
suscripcion por instancia.

## Lo que hace falta de verdad

Builder CRM usa Supabase **solo para autenticacion**. Todas las consultas de datos van
por Drizzle contra Postgres. No usa PostgREST, ni Realtime, ni Storage de Supabase: los
documentos van directo a un bucket S3.

Por eso **no necesitas el stack completo de Supabase**, que son 13 contenedores y unos
1,9 GB de memoria. Con dos alcanza:

| Contenedor | Para que | Memoria tipica |
|---|---|---|
| Postgres con pgvector | la base del CRM y el esquema `auth` | 150 a 400 MB |
| `supabase/gotrue` | el login y los usuarios | 15 a 40 MB |

El modulo de propiedades usa busqueda vectorial, asi que la imagen tiene que traer la
extension. `pgvector/pgvector:pg16` es un Postgres normal con esa extension, y se porta
bien bajo cualquier orquestador.

## Consecuencia de seguridad que hay que entender

Con Supabase cloud, las tablas de `public` quedan expuestas por PostgREST a quien tenga
la clave anonima, que viaja en el navegador. Por eso el nucleo trae RLS en todas las
tablas: es el escudo de esa API publica.

Autoalojado sin PostgREST **no hay API publica de datos**, asi que ese escudo deja de
ser necesario. Las migraciones de RLS corren igual y no hay que tocar nada, pero pasan a
ser defensa en profundidad. La autorizacion de verdad sigue estando donde siempre: en el
servidor, con `requireMember()` y el filtro por propietario. Ver [SEGURIDAD.md](../SEGURIDAD.md).

## Orden de los pasos

El orden importa y no es intuitivo:

1. **Postgres arriba.**
2. **`node scripts/preparar-auth-autoalojado.mjs`** crea lo que Supabase cloud trae de
   fabrica: los roles `anon`, `authenticated` y `service_role`, el esquema `auth` con
   dueno `supabase_auth_admin`, y las funciones `auth.uid()`, `auth.role()`,
   `auth.email()` y `auth.jwt()`.
3. **GoTrue arranca** y crea `auth.users` con sus propias migraciones.
4. **`npm run db:migrar`** aplica las migraciones del CRM. La ultima pone un disparador
   sobre `auth.users`, que para entonces ya existe.

Saltarse el paso 2 deja a GoTrue sin el rol con el que entra. Invertir 3 y 4 hace que la
migracion del primer administrador falle porque la tabla todavia no esta.

## Claves

```bash
node scripts/generar-claves-supabase.mjs
```

Imprime el secreto JWT y, firmadas con el, la clave anonima y la de servicio. Las tres
tienen que ser coherentes: el secreto va en GoTrue, las dos claves en el CRM. Si cambias
el secreto hay que regenerar las claves y todas las sesiones abiertas se cortan.

## Variables de GoTrue

Las que importan, probadas con `supabase/gotrue:v2.186.0`:

```
GOTRUE_API_HOST=0.0.0.0
GOTRUE_API_PORT=9999
API_EXTERNAL_URL=https://auth.tudominio.com
GOTRUE_DB_DRIVER=postgres
GOTRUE_DB_DATABASE_URL=postgres://supabase_auth_admin:CONTRASENA@HOST_DE_LA_BASE:5432/postgres?search_path=auth&sslmode=disable
GOTRUE_SITE_URL=https://crm.tudominio.com
GOTRUE_URI_ALLOW_LIST=https://crm.tudominio.com/**
GOTRUE_JWT_SECRET=EL_SECRETO
GOTRUE_JWT_EXP=3600
GOTRUE_JWT_AUD=authenticated
GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated
GOTRUE_JWT_ADMIN_ROLES=service_role
GOTRUE_DISABLE_SIGNUP=false
GOTRUE_EXTERNAL_EMAIL_ENABLED=true
GOTRUE_MAILER_AUTOCONFIRM=true
```

**`GOTRUE_MAILER_AUTOCONFIRM=true` no es opcional si no tienes SMTP.** En falso, las
cuentas nacen sin confirmar y nadie puede entrar, sin ningun error visible en el CRM.

Esa variable solo afecta al registro publico, que en esta plantilla se cierra en cuanto
existe la primera cuenta, asi que se queda en `true` tambien despues de configurar SMTP.
Las invitaciones y la recuperacion de contrasena no dependen de ella: se encienden con
las variables de SMTP y el interruptor del CRM, y van en [CORREO.md](CORREO.md).

## La URL del prefijo

La libreria de Supabase llama a `https://TU_URL/auth/v1/token`, pero GoTrue sirve su API
en la raiz. Hay que recortar `/auth/v1` antes de llegar al contenedor.

En Coolify se resuelve sin contenedores extra: en el dominio de la aplicacion de GoTrue
pones **la ruta incluida**, `https://auth.tudominio.com/auth/v1`, y el proxy recorta el
prefijo solo. Se comprueba asi:

```bash
curl https://auth.tudominio.com/auth/v1/health
# {"version":"v2.186.0","name":"GoTrue",...}
```

En el CRM, `NEXT_PUBLIC_SUPABASE_URL` es la raiz, **sin** `/auth/v1`:
`https://auth.tudominio.com`.

Con otro proxy, lo mismo con un recorte de prefijo. Un Caddy de 20 MB tambien sirve.

## Lo que se rompe y por que

- **GoTrue reinicia con `must be owner of function uid`.** Su primera migracion vuelve a
  declarar `auth.uid()` y `auth.role()`. Si esas funciones existen con otro dueno,
  Postgres lo rechaza. El script del paso 2 las crea ya con dueno `supabase_auth_admin`
  y, si las encuentra con otro dueno, se lo cambia. Volver a correrlo arregla el caso.
- **`relation "auth.users" does not exist` al migrar.** GoTrue todavia no arranco. Paso 3
  antes del 4.
- **El navegador no puede iniciar sesion y en la consola se ve `undefined` como URL.**
  Era esto hasta 1.2.1: las `NEXT_PUBLIC_*` se horneaban en el build y la API de Coolify
  4.3 no permite marcar una variable como de build. Desde 1.2.2 el servidor le entrega
  esa configuracion al navegador al ejecutar, asi que alcanza con tenerlas en runtime y
  volver a desplegar. Si lo seguis viendo, comproba que el bloque este en la pagina:
  `curl -s https://crm.tudominio.com/login | grep builder-crm-config`.
- **La cookie de sesion.** La libreria la nombra con la primera etiqueta del host de
  Supabase. Con `auth-demo.midominio.com` la cookie es `sb-auth-demo-auth-token`. Si
  cambias ese host, las sesiones abiertas dejan de valer.

## Acceso a la base para los pasos iniciales

Los scripts de preparacion y `admin:crear` corren desde tu maquina y necesitan llegar a
Postgres. En Coolify la base nace solo en la red interna, asi que durante la instalacion
se habilita el acceso publico, se corren los scripts y **se vuelve a cerrar**. La
alternativa es correrlos dentro del servidor.

## Respaldos

Con Supabase cloud venian incluidos. Aqui son tuyos: la base gestionada de Coolify tiene
respaldos programados hacia S3, y conviene activarlos el primer dia si en esa instancia
va a haber datos de un cliente.

## Resumen de variables del CRM

```
DATABASE_URL=postgres://postgres:CONTRASENA@HOST_DE_LA_BASE:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://auth.tudominio.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # del generador
SUPABASE_SERVICE_ROLE_KEY=...            # del generador
```

El resto no cambia respecto de Supabase cloud: ver [.env.example](../.env.example).
