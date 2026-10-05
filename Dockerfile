# syntax=docker/dockerfile:1
# ============================================================================
# Builder CRM - imagen de produccion (Coolify / docker compose)
# ============================================================================
# Tres etapas: deps (npm ci) -> builder (next build, standalone) -> runner (minima,
# usuario sin privilegios, migraciones al arrancar, healthcheck sobre /api/health).
#
# Ninguna variable hace falta para construir: desde 1.2.2 la configuracion publica se
# sirve en ejecucion (src/lib/config-publica.ts). Las NEXT_PUBLIC_* siguen aceptandose
# como build args para plataformas que las hornean (Vercel); el resto del entorno
# (DATABASE_URL, OPENROUTER_API_KEY, ZERNIO_*, ...) es de runtime y NO va aqui.
#
# Los dos `--mount=type=cache` no son adorno. Cada version nueva cambia package.json (el
# numero de version), eso invalida la capa del `npm ci` y sin cache se vuelven a bajar y
# descomprimir 817 paquetes en cada despliegue: 4,5 minutos medidos en el VPS de la demo.
# Con el cache de npm se saltea la red y la descompresion. El de Next ayuda poco con
# Turbopack (deja un cache chico en disco) y mucho si algun dia se vuelve a webpack: se
# deja porque no cuesta nada. Son caches del constructor: no entran en la imagen final y,
# si el servidor los limpia, el build sigue funcionando, solo tarda como antes.
# ============================================================================

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ARG SOURCE_COMMIT
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY
ENV SOURCE_COMMIT=$SOURCE_COMMIT \
    NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_VAPID_PUBLIC_KEY=$NEXT_PUBLIC_VAPID_PUBLIC_KEY \
    NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production
RUN --mount=type=cache,target=/app/.next/cache npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S app && adduser -S app -G app

# Servidor standalone (server.js + node_modules trazados) + estaticos + publicos.
COPY --from=builder --chown=app:app /app/.next/standalone ./
COPY --from=builder --chown=app:app /app/.next/static ./.next/static
COPY --from=builder --chown=app:app /app/public ./public
# Migraciones del nucleo y de los modulos, y el runner. `postgres` ya esta en el
# node_modules trazado porque la app lo usa.
COPY --from=builder --chown=app:app /app/supabase/migrations ./supabase/migrations
COPY --from=builder --chown=app:app /app/scripts/migrar.mjs ./scripts/migrar.mjs
COPY --from=builder --chown=app:app /app/config ./config
COPY --from=builder --chown=app:app /app/modules ./modules
COPY --chown=app:app docker/entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=5 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]
