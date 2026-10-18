#!/bin/sh
# Netlify: crea public/js/config.js con las variables de entorno SUPABASE_URL y SUPABASE_ANON_KEY
if [ -n "$SUPABASE_URL" ] && [ -n "$SUPABASE_ANON_KEY" ]; then
  printf 'window.SB={url:"%s",key:"%s"};\n' "$SUPABASE_URL" "$SUPABASE_ANON_KEY" > public/js/config.js
  echo "config.js generado"
else
  echo "Sin variables de Supabase: la tienda funcionará en modo demo"
fi
