# ORO · Catálogos digitales para joyerías

ORO es una plataforma SaaS para vender páginas de catálogo a múltiples joyerías. Cada cliente paga una tarifa inicial de creación y una mensualidad de mantenimiento, recibe un subdominio propio y administra su catálogo desde un panel privado.

## Alcance
- Página comercial de ORO y catálogo público independiente por joyería.
- Subdominios: `slug.dominio-de-oro.com`.
- Panel de propietario: productos, categorías y personalización.
- Superadministrador: joyerías, propietarios, subdominios, estado del servicio y pagos.
- Aislamiento multi-tenant con Supabase RLS.
- Sin citas, reservas, pedidos, carrito, empleados, inventario ni CRM. El contacto por WhatsApp puede permanecer como canal de consulta.

## Supabase
1. Ejecuta `supabase/schema.sql` solo si aún necesitas la tabla heredada `store` y el bucket de imágenes; conserva el correo administrador que corresponda.
2. Ejecuta `supabase/migrations/001_multi_jewelry_core.sql`. Cambia el token de activación antes de ejecutarlo y guarda la clave.
3. Ejecuta `supabase/migrations/002_jewelry_billing.sql` después de la migración 001.
4. Crea el usuario administrador en Supabase Auth, entra a `/#/plataforma` y reclama el rol con el token de un solo uso.
5. Desactiva el registro público de usuarios. El administrador crea/asigna las cuentas de propietarios.

Nunca pongas la clave `service_role` en el navegador. Solo se utiliza la clave pública anon.

## Vercel
Configura el proyecto conectado a la rama `feature/oro-multi-jewelry-barberpro-core`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `ORO_ROOT_DOMAIN` — dominio raíz real, sin protocolo. Ejemplo de formato: `oro.com`.

El proyecto usa `build.sh` y publica la carpeta `public`. El build genera `public/js/config.js`.

### Subdominios
1. Añade el dominio raíz en Vercel.
2. Añade también el dominio wildcard `*.tu-dominio.com) al mismo proyecto.
3. Configura en tu proveedor DNS el registro wildcard que Vercel indique (normalmente CNAME para `*` apuntando al destino indicado por Vercel).
4. Configura `ORO_ROOT_DOMAIN` con el dominio real y vuelve a desplegar.
5. Al crear una joyería, ORO registra `slug.tu-dominio.com`. La resolución del catálogo se hace por el hostname.

No marques el dominio wildcard como listo hasta que Vercel y DNS lo hayan validado. No se ha realizado un despliegue desde este repositorio.

## Operación
- Superadministrador: `/#/plataforma`.
- Propietario: `/#/gestion`.
- Cada catálogo se abre en su subdominio; el acceso por slug `/#/joyeria/slug` se conserva como ruta auxiliar.
- Los pagos se registran manualmente desde el panel; esta versión no integra pasarela automática.
- Suspender un servicio no borra el catálogo ni sus datos.

## Desarrollo
Los cambios se realizan en `feature/oro-multi-jewelry-barberpro-core`. Revisa la rama y ejecuta las migraciones en el orden indicado antes de desplegar. No integres a `main` ni publiques en producción sin validar Supabase, DNS, Vercel y los permisos.
