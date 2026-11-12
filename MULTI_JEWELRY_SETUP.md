# Activar la plataforma multi-joyería ORO

Esta actualización añade un marketplace, un panel maestro y separación de datos por joyería. No borra la tabla anterior `public.store`.

## 1. Aplicar la migración en Supabase

1. Abre el proyecto Supabase conectado a ORO.
2. Entra a **SQL Editor**.
3. Abre el archivo `supabase/migrations/002_multi_jewelry_platform.sql` de este repositorio y ejecuta el contenido completo.
4. En la parte final, sustituye `TU_CORREO_ADMIN` por el correo que usas como administrador principal y ejecuta esta instrucción por separado:

```sql
insert into public.platform_admins(email)
values ('tu-correo-real@dominio.com')
on conflict (email) do nothing;
```

No compartas contraseñas ni claves privadas. La clave anon/public se puede usar en el navegador; nunca publiques la service_role.

## 2. Variables de Netlify

En **Site configuration → Environment variables**, verifica que estén definidas:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Después ejecuta un nuevo deploy para que `build.sh` genere `public/js/config.js`.

## 3. Crear la primera joyería

1. Abre el dominio principal de ORO y entra a `/#/plataforma`.
2. Inicia sesión con el correo añadido a `platform_admins`.
3. Crea la joyería y registra el correo de su propietario.
4. El propietario debe tener un usuario en **Supabase Authentication** con ese mismo correo.
5. Añade su dominio en el formulario. El dominio debe apuntar primero al hosting.
6. Cuando DNS y HTTPS estén listos, pulsa **Verificar dominio**. Solo entonces el dominio resolverá a esa tienda.

## 4. Dominios propios

Cada dominio debe agregarse también en el panel del proveedor de hosting (Netlify → Domain management) y configurarse con los registros DNS que indique Netlify. La verificación dentro de ORO no sustituye la configuración del DNS ni registra dominios.

## 5. Separación y permisos

- Los productos, colecciones y ajustes se guardan por `tenant_id`.
- Los visitantes solo pueden leer los datos de tiendas activas.
- El propietario solo puede modificar la joyería cuyo `owner_email` coincide con su correo autenticado.
- El administrador de plataforma se registra en `platform_admins` y puede crear, suspender o eliminar joyerías.
- El correo de propietario no se expone al directorio público.

## Importante sobre la tienda SGarcía existente

La tabla antigua `public.store` se conserva para evitar borrar datos. Al crear la primera joyería desde el panel, ORO intenta importar automáticamente los ajustes, productos y colecciones de la tabla antigua `public.store`. Comprueba que la primera joyería sea SGarcía y que los productos aparezcan correctamente antes de eliminar o modificar la tabla antigua.
