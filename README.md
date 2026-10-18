# ÁUREA · Tienda de joyería (Supabase + GitHub + Netlify)

```
public/            sitio web (index.html, css/, js/)
supabase/schema.sql  base de datos, imágenes y seguridad
netlify.toml · build.sh  despliegue
```

## 1) Supabase (base de datos, fotos y login del admin)
1. En supabase.com crea un proyecto nuevo.
2. **SQL Editor** → abre `supabase/schema.sql`, cambia `TU_CORREO@EJEMPLO.COM` por tu correo (4 veces) y pulsa **Run**.
3. **Authentication → Users → Add user**: tu correo y una contraseña (activa "Auto Confirm User").
4. En los ajustes de **Authentication** (Sign In / Providers) desactiva **Allow new users to sign up**.
5. **Project Settings → API**: copia *Project URL* y la clave *anon public*.

## 2) GitHub
```
cd aurea-tienda
git init && git add . && git commit -m "Tienda ÁUREA"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/aurea-tienda.git
git push -u origin main
```
(Crea antes el repositorio vacío en github.com.)

## 3) Netlify
1. **Add new site → Import an existing project → GitHub** y elige el repositorio. Netlify lee `netlify.toml` solo.
2. **Site configuration → Environment variables**: agrega `SUPABASE_URL` y `SUPABASE_ANON_KEY` con lo copiado en el paso 1.5.
3. **Deploy**. Si agregas las variables después, haz *Trigger deploy*.

## 4) Administrar
Entra a `https://TU-SITIO.netlify.app/#/admin` con tu correo y contraseña. Todo cambio se guarda en Supabase y lo ven todos los visitantes. Las fotos subidas van al bucket `images`.

## Seguridad
- La clave *anon* es pública por diseño; la protección real son las políticas del `schema.sql`: todos leen, solo tu correo escribe.
- Nunca pongas la clave `service_role` en este proyecto.

## Probar sin Supabase
Abre `public/index.html`: funciona en modo demo (contraseña `aurea2026`, datos solo en tu navegador).
