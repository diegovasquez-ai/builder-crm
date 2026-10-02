#!/bin/sh
# Arranque del contenedor: migraciones primero, servidor despues.
#
# Por que aqui y no en un "pre-deployment command" de Coolify: ese comando corre en el
# contenedor VIEJO, con el codigo viejo; las migraciones tienen que correr con el codigo
# que va a servir. Si la base no responde, migrar.mjs reintenta 15 veces (30 s) antes
# de fallar, y el start-period del HEALTHCHECK cubre esa espera.
#
# SKIP_MIGRATIONS=true salta el paso (por ejemplo en una replica que no debe migrar).
set -e

if [ "$SKIP_MIGRATIONS" != "true" ]; then
  echo "[entrypoint] aplicando migraciones..."
  node scripts/migrar.mjs
else
  echo "[entrypoint] SKIP_MIGRATIONS=true: no se migran la base"
fi

echo "[entrypoint] arrancando: $*"
exec "$@"
