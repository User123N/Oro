# ORO · Plataforma de joyerías

ORO permite publicar varias joyerías independientes en una sola plataforma. Cada negocio tiene su propia página pública, catálogo y configuración, mientras el superadministrador administra el directorio central.

## Alcance funcional

- Marketplace público con directorio de joyerías.
- Página pública independiente por joyería, identificada por su slug o dominio verificado.
- Panel del propietario para administrar **productos, categorías y configuración de la tienda**.
- Panel superadministrador para crear, activar, suspender y eliminar joyerías, asignar propietarios y vincular dominios.
- Separación de datos por joyería mediante Supabase Row Level Security (RLS).

**Fuera de alcance:** citas, reservas, gestión de pedidos, inventario como módulo independiente, clientes y empleados. Se conserva el contacto comercial de la tienda por WhatsApp que ya existía en el escaparate.

## 1. Supabase

1. En `supabase/schema.sql`, reemplaza `TU_CORREO@EJEMPLO.COM` por el correo del administrador donde aparece (4 veces). Ejecuta el archivo para conservar la tabla heredada y el bucket de imágenes que utiliza la tienda actual.
2. Abre `supabase/migrations/001_multi_jewelry_core.sql` en SQL Editor.
3. Antes de ejecutarlo, cambia el texto `CAMBIA-ESTA-CLAVE-DE-ACTIVACION` por una clave larga y privada. Guarda esa clave: se usa una sola vez para activar el primer superadministrador.
4. Ejecuta la migración completa.
5. En Authentication, crea el usuario del superadministrador. Después entra a `/#/plataforma`, inicia sesión y activa la cuenta con la clave de un solo uso.
6. Desactiva el registro público de usuarios en Supabase Auth. Los propietarios deben tener una cuenta creada y verificada con el mismo correo que el superadministrador les asignó.

No uses la clave `service_role` en el navegador. La aplicación utiliza únicamente la clave pública `anon`; RLS controla los permisos.

## 2. Variables de entorno

En Netlify configura:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Después vuelve a desplegar el sitio.

## 3. Crear y administrar joyerías

1. Entra a `https://TU-DOMINIO/#/plataforma` como superadministrador.
2. Crea la joyería y asigna el correo exacto del propietario.
3. El propietario debe iniciar sesión con ese correo desde `/#/gestion`.
4. En su panel podrá actualizar productos, categorías y configuración.
5. La tienda pública se puede abrir desde `/#/joyeria/slug-de-la-joyeria`. Un dominio propio requiere apuntar al hosting y quedar verificado desde el panel central.

## 4. Tienda anterior

La tienda SGarcía y sus datos heredados se conservan. Para importarlos, crea primero la joyería SGarcía usando un nombre o slug que incluya `SGarcía` o `sgarcia`; solo esa joyería recibe la copia inicial de configuración, productos y colecciones. Las demás joyerías comienzan aisladas y sin productos precargados. Los datos locales del navegador no se copian automáticamente entre joyerías.

## 5. Desarrollo y despliegue

El trabajo multi-joyería se desarrolla en la rama `feature/oro-multi-jewelry-barberpro-core`. No se ha integrado a `main` automáticamente. Revisa y prueba la rama antes de fusionarla y desplegarla.
