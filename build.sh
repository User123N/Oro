#!/bin/sh
# Vercel static build: inject only public Supabase credentials and the public root domain.
set -eu
: "${SUPABASE_URL:?ERROR: configura SUPABASE_URL en Vercel}"
: "${SUPABASE_ANON_KEY:?ERROR: configura SUPABASE_ANON_KEY en Vercel}"
ROOT_DOMAIN="${ORO_ROOT_DOMAIN:-}"
if [ -n "$ROOT_DOMAIN" ]; then
  case "$ROOT_DOMAIN" in
    *[!a-zA-Z0-9.-]*|.*|*.) echo "ERROR: ORO_ROOT_DOMAIN debe ser un dominio sin protocolo ni rutas." >&2; exit 1 ;;
  esac
fi
printf 'window.SB={url:"%s",key:"%s"};window.ORO_ROOT_DOMAIN="%s";\n' "$SUPABASE_URL" "$SUPABASE_ANON_KEY" "$ROOT_DOMAIN" > public/js/config.js
echo "Configuración pública generada."
if [ -z "$ROOT_DOMAIN" ]; then
  echo "AVISO: ORO_ROOT_DOMAIN no está configurado; no se podrán generar subdominios automáticamente."
fi
