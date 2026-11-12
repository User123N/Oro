# Activar la plataforma multi-joyería ORO

Esta actualización añade un marketplace, un panel maestro y separación de datos por joyería. No borra la tabla anterior `public.store`.

## 1. Estado de la base de datos

La migración `002_multi_jewelry_platform`, el ajuste `003_optimize_platform_owner_rls` y `004_secure_first_admin_bootstrap` ya se aplicaron al proyecto ORO-SGARCIA. Se crearon cinco tablas nuevas y todas tienen RLS activado. No se borraron tablas ni datos. La revisión de seguridad de Supabase no reportó hallazgos.

## 2. Crear y activar el primer administrador

1. Abre la vista previa y entra a `/#/plataforma`.
2. Usa **Crear cuenta** para registrar tu usuario con tu propio correo y una contraseña segura. Si Supabase solicita confirmar el correo, hazlo desde tu bandeja y luego inicia sesión.
3. En la pantalla **Activar administrador principal**, pega la clave de activación de un solo uso que te entregué en esta conversación.
4. La clave vence en 24 horas y solo se puede utilizar una vez. El sistema registra automáticamente como administrador el correo de la sesión autenticada. No compartas esa clave con nadie.

No compartas contraseñas ni claves privadas. La clave anon/public se puede usar en el navegador; nunca publiques la service_role.

## 3. Variables de Netlify

En **Site configuration → Environment variables**, verifica que estén definidas:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Después ejecuta un nuevo deploy para que `build.sh` genere `public/js/config.js`.

## 4. Crear la primera joyería

1. Abre el dominio principal de ORO y entra a `/#/plataforma`.
2. Inicia sesión con el correo añadido a `platform_admins`.
3. Crea la joyería y registra el correo de su propietario.
4. El propietario debe tener un usuario en **Supabase Authentication** con ese mismo correo.
5. Añade su dominio en el formulario. El dominio debe apuntar primero al hosting.
6. Cuando DNS y HTTPS estén listos, pulsa **Verificar dominio**. Solo entonces el dominio resolverá a esa tienda.

## 5. Dominios propios

Cada dominio debe agregarse también en el panel del proveedor de hosting (Netlify → Domain management) y configurarse con los registros DNS que indique Netlify. La verificación dentro de ORO no sustituye la configuración del DNS ni registra dominios.

## 6. Separación y permisos

- Los productos, colecciones y ajustes se guardan por `tenant_id`.
- Los visitantes solo pueden leer los datos de tiendas activas.
- El propietario solo puede modificar la joyería cuyo `owner_email` coincide con su correo autenticado.
- El administrador de plataforma se registra en `platform_admins` y puede crear, suspender o eliminar joyerías.
- El correo de propietario no se expone al directorio público.

## Importante sobre la tienda SGarcía existente

La tabla antigua `public.store` se conserva para evitar borrar datos. Al crear la primera joyería desde el panel, ORO intenta importar ajustes, productos y colecciones de `public.store`; si esa tabla no existe, intenta recuperar la copia local del navegador donde se está creando la tienda. En el proyecto revisado no había tablas públicas, así que no se encontró un catálogo antiguo en Supabase. Revisa el catálogo tras crear SGarcía y conserva el navegador con los datos originales hasta comprobar la importación.
