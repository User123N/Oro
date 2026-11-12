#!/bin/sh
# Vercel y Netlify: genera la configuración pública de Supabase durante el build.
set -eu
if [ -z "${SUPABASE_URL:-}" ] || [ -z "${SUPABASE_ANON_KEY:-}" ]; then
  echo "ERROR: faltan SUPABASE_URL y/o SUPABASE_ANON_KEY. Configúralas en las variables de entorno del hosting y vuelve a desplegar." >&2
  exit 1
fi
printf 'window.SB={url:"%s",key:"%s"};\n' "$SUPABASE_URL" "$SUPABASE_ANON_KEY" > public/js/config.js
echo "Configuración de Supabase generada correctamente."
