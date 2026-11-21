# ✂️ Barbería Radikal — Caja diaria, clientes y liquidaciones

App web para cargar desde el celular las ventas, gastos y adelantos de la barbería, y calcular a fin de mes la liquidación de cada barbero, la parte de la sociedad y la conciliación de caja chica y banco.

## Cómo funciona

- **Una sola base de datos compartida** en Supabase (plan gratuito). Nada se guarda en el celular: todos ven lo mismo.
- **Tiempo real:** lo que carga uno aparece al instante en los demás celulares, sin recargar.
- **Hora de Córdoba:** el día y el mes se calculan siempre en hora de Córdoba (una venta del 31 a las 23:00 cuenta en ese mes).
- **Nada se borra:** cada registro guarda quién lo cargó y cuándo. Las correcciones guardan el valor anterior en el historial de cambios, y "borrar" es *anular con motivo*.
- **Cierre de mes:** un mes cerrado queda en solo lectura para todos.

### Quién puede hacer qué

| | Barberos (Diego, Lionel, Barbero 4) | Administración (Ema) |
|---|---|---|
| Ventas, gastos y adelantos | Ven los de todos. Cargan los del día. Corrigen los **del día** con motivo | Ve y corrige todo mientras el mes esté abierto |
| Adelantos | Cargan solo los propios | Carga a cualquiera |
| Pasar una venta a otro barbero | No | Sí |
| Anular | No | Sí, con motivo |
| Clientes | Ven todos, con su historial | Igual |
| Liquidación de barberos | La ven | La ve y registra los pagos |
| Parte de la sociedad y gastos fijos | Solo Diego (socio) | Sí |
| Conciliación, cierre de mes, historial de cambios, configuración | No | Sí |

Estas reglas están en la base de datos (RLS), no solo en la pantalla: aunque alguien intente saltearlas, la base las rechaza.

### Cuentas del mes

- **Liquidación de cada barbero:** 50% de sus cortes + propinas − adelantos − pagos ya hechos. Lionel se liquida por semana (domingo a sábado, se paga el sábado) y los demás por mes.
- **Sociedad (Ema y Diego):** la parte de la casa (el otro 50% de todas las ventas) − gastos de la sociedad − gastos fijos = ganancia, que se divide en dos. Los gastos marcados "Solo Ema" o "Solo Diego" se descuentan de la parte de esa persona.
- **Diego a fin de mes:** su subtotal como barbero + su subtotal como socio − lo ya pagado.
- **Caja chica:** efectivo cobrado − gastos, adelantos, sueldos y gastos fijos pagados en efectivo.
- **Banco:** transferencias recibidas − lo pagado por banco.
- Al conciliar, ingresás lo que contaste (o el saldo real del banco) y la app muestra la diferencia con lo esperado.

---

## Puesta en marcha (una sola vez, antes del 1 de diciembre)

Seguí los pasos en orden. Todo el SQL se pega en **Supabase > SQL Editor > New query** y se ejecuta con **Run**.

### Paso 0 · Bajar una copia de la versión actual (opcional)

Solo si querés conservar los datos viejos fuera de Supabase: en la app actual, entrá como administración y andá a **Configuración > Acceso y backups > Descargar backup JSON**. La app nueva arranca de cero, así que este paso no es necesario.

### Paso 1 · Respaldar las tablas viejas dentro de Supabase

Ejecutá [supabase/migrations/000_respaldo_previo.sql](supabase/migrations/000_respaldo_previo.sql). Copia las tablas de la versión anterior a un esquema aparte (`archivo_v1`) sin borrar nada.

### Paso 2 · Crear la base nueva

Ejecutá [supabase/migrations/001_esquema.sql](supabase/migrations/001_esquema.sql). Crea las tablas, permisos, historial, cierre de mes, cálculos y tiempo real, y da de alta a los barberos Ema, Diego, Lionel y Barbero 4 (este último desactivado). **Desde este momento la versión vieja de la app deja de funcionar**, así que hacé los pasos 2 a 5 el mismo día.

### Paso 3 · Pasar el catálogo

Ejecutá [supabase/migrations/002_importar_catalogo.sql](supabase/migrations/002_importar_catalogo.sql). Copia los servicios y productos con sus precios. **No copia clientes, ventas, gastos ni adelantos viejos:** la app arranca de cero.

### Paso 4 · Crear los usuarios

1. En Supabase andá a **Authentication > Users > Add user > Create new user**.
2. Creá estos 4 usuarios. Poné una contraseña para cada uno y tildá **Auto Confirm User**:

   | Usuario para entrar a la app | Correo en Supabase |
   |---|---|
   | `ema` | `barber.radikal+ema@gmail.com` |
   | `diego` | `barber.radikal+diego@gmail.com` |
   | `lionel` | `barber.radikal+lionel@gmail.com` |
   | `barbero4` | `barber.radikal+barbero4@gmail.com` |

   Los correos con `+` llegan a la casilla de barber.radikal@gmail.com. Cada barbero entra a la app solo con su usuario (por ejemplo `diego`) y su contraseña.
3. Ejecutá [supabase/migrations/003_usuarios.sql](supabase/migrations/003_usuarios.sql). Al final muestra los 4 usuarios con su rol; si alguno dice "FALTA CREAR EL USUARIO", revisá que el correo esté escrito exactamente igual.
4. En **Authentication > Sign In / Providers**, desactivá **Allow new users to sign up**, para que nadie pueda crearse una cuenta por su cuenta.
5. Pasale a cada barbero su usuario y contraseña por un canal privado.

### Paso 5 · Publicar la app nueva

La app está publicada en GitHub Pages y en Vercel. **Las dos tienen que actualizarse el mismo día y usar el mismo proyecto de Supabase.**

1. Revisá que estén cargadas las mismas dos variables en los dos lugares:
   - GitHub: **Settings > Secrets and variables > Actions** → `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
   - Vercel: **Project > Settings > Environment Variables** → las mismas dos.

   Los valores están en Supabase > **Project Settings > API** (Project URL y la clave `anon` / publishable). **Nunca** pongas la clave `service_role` en estos lugares.
2. Subí los cambios a la rama `main`. GitHub Pages se publica solo. En Vercel, si no se publica solo, hacé **Deployments > Redeploy**.
3. Abrí los dos links. Tienen que pedir **Usuario** (no Email). Si un celular sigue mostrando la versión vieja, cerrá la pestaña y abrila de nuevo.
4. Recomendación: que todos usen **un solo link**. El de GitHub Pages es gratis para siempre; el plan gratis de Vercel no permite uso comercial.

### Paso 6 · Backup diario en el Google Drive de la barbería

El script vive dentro de la cuenta de la barbería, así que las copias quedan en **su** Drive.

1. Activá la **verificación en 2 pasos** en barber.radikal@gmail.com (myaccount.google.com > Seguridad).
2. Abrí una ventana de incógnito y entrá **solo** con barber.radikal@gmail.com.
3. Entrá a **script.google.com > Nuevo proyecto**, llamalo "Backup Barbería", borrá lo que aparece y pegá el contenido de [scripts/google-drive-backup.gs](scripts/google-drive-backup.gs).
4. **Engranaje (Configuración del proyecto)**: zona horaria **(GMT-03:00) Buenos Aires**. Más abajo, en **Propiedades del script**, agregá:
   - `SUPABASE_URL` → la Project URL.
   - `SUPABASE_SERVICE_ROLE_KEY` → la clave `service_role` (Supabase > Project Settings > API). Esta clave abre toda la base: va **solo acá**.
5. Elegí la función **installDailyBackup** y tocá **Ejecutar**. Cuando Google pida permisos: **Revisar permisos** → elegí la cuenta de la barbería → "Google no verificó esta app" → **Configuración avanzada > Ir a Backup Barbería** → **Permitir**. Es normal: el script es tuyo.
6. Comprobá que en el Drive de la barbería aparezca la carpeta **Barberia - Backups Supabase** con un archivo `backup_barberia_....json.gz`.
7. En el **reloj (Activadores)**, abrí la tarea diaria y en **Notificaciones de error** elegí **Inmediatamente**.
8. Opcional: compartí la carpeta con tu correo personal como **Lector** para verla desde tu cuenta.

Las copias se hacen todas las noches a las 3 AM, se guardan comprimidas y **no se borran nunca**. Si el Drive llega al 80%, llega un mail de aviso.

### Paso 7 · Copia completa en GitHub (segunda copia)

Esta copia incluye todo (usuarios, reglas y datos) y es la que se usa para restaurar si algo grave falla.

1. En GitHub creá un repositorio **privado** nuevo, por ejemplo `radikal-backups`. **Tiene que ser privado** (tiene datos de clientes) y aparte del de la app, que es público.
2. En Supabase tocá **Connect** (arriba) y copiá la cadena **Session pooler** (empieza con `postgresql://postgres.` y termina en `:5432/postgres`). Reemplazá `[YOUR-PASSWORD]` por la contraseña de la base. Si no la recordás, cambiala en **Project Settings > Database > Reset database password**.
3. En el repositorio nuevo: **Settings > Secrets and variables > Actions > New repository secret** → nombre `SUPABASE_DB_URL`, valor la cadena del punto anterior.
4. Subí al repositorio nuevo los archivos [backups/github/backup-diario.yml](backups/github/backup-diario.yml) y [backups/github/restaurar.yml](backups/github/restaurar.yml) dentro de la carpeta `.github/workflows/`. Desde la web: **Add file > Create new file** y escribí como nombre `.github/workflows/backup-diario.yml` (repetí con `restaurar.yml`).
5. Probalo: **Actions > Backup diario de la base > Run workflow**. En un par de minutos tiene que aparecer la carpeta `backup/` con un commit "Backup AAAA-MM-DD".

Corre todas las noches a las 3 AM. Cada día queda como una versión en el historial de git, así que se puede volver a cualquier fecha. Si una noche falla, GitHub te avisa por mail.

### Paso 8 · Probar que todo funciona

- [ ] Entrar como `lionel` en un celular y como `ema` en otro. Cargar una venta en uno y verla aparecer en el otro **sin recargar**.
- [ ] Como `lionel`: corregir esa venta (pide motivo). Comprobar que no aparece el botón de anular y que no se puede cambiar el barbero.
- [ ] Como `ema`: abrir **Configuración > Cambios recientes** y ver la corrección con el valor anterior.
- [ ] Como `lionel`: en **Resumen** ver las liquidaciones, pero no la sección "Sociedad" ni la conciliación.
- [ ] Como `diego`: ver la sección "Sociedad".
- [ ] Anular como `ema` la venta de prueba (queda tachada y deja de sumar).

---

## Uso diario y de fin de mes

- **Gastos fijos del mes** (alquiler, luz, internet…): en **Resumen > Sociedad**. El botón **Copiar del mes anterior** los repite con los mismos montos; después ajustá los que cambien.
- **Pagar a Lionel el sábado:** en **Resumen**, en la tarjeta de Lionel, la semana muestra el saldo → **Registrar pago** (efectivo o banco). Queda "✅ Pagado".
- **Pagar a Diego a fin de mes:** en su tarjeta, **Registrar pago** sobre el saldo total (barbero + socio).
- **Conciliar:** en **Resumen > Conciliación**, elegí caja o banco, ingresá lo contado y tocá **Conciliar**. La diferencia queda registrada.
- **Cerrar el mes:** desde el día 1 del mes siguiente, en **Resumen** elegí el mes y tocá **Cerrar mes**. Antes conviene bajar una copia en **Configuración > Copia de seguridad**.

### Sumar un barbero nuevo (usar el Barbero 4)

1. En Supabase > Authentication > Users, buscá `barber.radikal+barbero4@gmail.com`. Si querés que entre con otro usuario, creá uno nuevo con el correo `barber.radikal+NOMBRE@gmail.com`.
2. En SQL Editor (cambiá `Franco` y `franco` por el nombre y el usuario):

```sql
UPDATE public.barbers SET name = 'Franco', active = true WHERE name = 'Barbero 4';
UPDATE public.profiles SET display_name = 'Franco', active = true WHERE username = 'barbero4';
-- Si creaste un usuario con otro correo, en vez de la línea anterior:
-- INSERT INTO public.profiles (user_id, username, display_name, role, barber_id)
-- SELECT u.id, 'franco', 'Franco', 'barber', b.id FROM auth.users u, public.barbers b
-- WHERE u.email = 'barber.radikal+franco@gmail.com' AND b.name = 'Franco';
```

3. En la app, **Configuración > Barberos**, elegí si cobra los sábados o a fin de mes.

Para que alguien deje de entrar: `UPDATE public.profiles SET active = false WHERE username = 'franco';` (su historial se conserva).

### Cambiar una contraseña

En SQL Editor (cambiá el usuario y la contraseña nueva):

```sql
UPDATE auth.users
SET encrypted_password = extensions.crypt('ContraseñaNueva123', extensions.gen_salt('bf'))
WHERE email = 'barber.radikal+lionel@gmail.com';
```

---

## Si algo falla: cómo restaurar

**Caso 1 · Se cargó o corrigió algo mal.** No hace falta restaurar nada. En **Configuración > Cambios recientes** está el valor anterior. Si el mes está abierto, corregilo desde la caja diaria. Si fue un error grave en un mes cerrado, ver "Reabrir un mes" más abajo.

**Caso 2 · Se perdió o se dañó la base (por ejemplo, se borró el proyecto).** Se restaura la copia completa de GitHub en un proyecto nuevo:

1. Creá un proyecto nuevo en Supabase (gratis; el plan gratuito permite 2 proyectos activos).
2. Copiá la cadena **Session pooler** del proyecto **nuevo** (igual que en el Paso 7).
3. En el repositorio de backups: **Settings > Secrets > Actions** → nuevo secreto `RESTORE_DB_URL` con esa cadena.
4. **Actions > Restaurar backup > Run workflow**. En "fecha" poné el día a recuperar (por ejemplo `2026-12-15`) o dejalo vacío para el último, y en "confirmar" escribí `RESTAURAR`. El flujo nunca restaura sobre la base en uso.
5. En el proyecto nuevo, desactivá **Allow new users to sign up** (Paso 4.4).
6. Cambiá `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en GitHub y Vercel por los del proyecto nuevo y volvé a publicar (Paso 5).
7. Actualizá `SUPABASE_DB_URL` (en el repositorio de backups) y las propiedades del script de Drive con los datos del proyecto nuevo.

Los usuarios y contraseñas se recuperan con la copia: todos entran como antes.

**Caso 3 · Ver una copia del Drive.** Los archivos `.json.gz` se abren con 7-Zip (gratis) o WinRAR y adentro hay un `.json` con todas las tablas. Sirve para consultar un dato puntual.

### Reabrir un mes cerrado (solo emergencias)

La app no permite reabrir un mes. Si hiciera falta por un error grave, en SQL Editor:

```sql
DELETE FROM public.month_closings WHERE month = '2026-12-01';
```

La reapertura queda registrada en el historial. Después de corregir, cerralo de nuevo desde la app.

### Borrar el archivo de la versión vieja (opcional)

Las tablas viejas quedaron en `archivo_v1` (Paso 1) y en `public.barberflow_*`. La app nueva no las usa. Cuando confirmes que no las necesitás:

```sql
DROP SCHEMA archivo_v1 CASCADE;
DROP TABLE public.barberflow_app_data, public.barberflow_customers,
  public.barberflow_user_roles, public.barberflow_app_data_history;
```

---

## Costos

Todo es gratis. Lo que hay que tener en cuenta:

- **Supabase (plan Free):** 500 MB de base (una barbería usa muy poco) y tiempo real incluido. ⚠️ Si nadie usa la app durante **7 días seguidos**, Supabase **pausa** el proyecto: los datos no se pierden, pero hay que reactivarlo desde el panel (**Restore project**). El plan gratis **no incluye backups descargables**; por eso están los pasos 6 y 7.
- **GitHub Actions (repositorio privado):** 2.000 minutos gratis por mes; el backup usa unos 2 por día.
- **Google Drive:** 15 GB gratis, compartidos con el Gmail de la barbería. Las copias comprimidas ocupan muy poco.
- **GitHub Pages:** gratis. **Vercel (plan Hobby):** gratis, pero sus condiciones no permiten uso comercial.
- Ningún paso pide tarjeta de crédito. Si en algún momento Supabase o Vercel ofrecen "upgrade", no hace falta aceptar.

---

## Para desarrollo

```bash
npm install      # instalar dependencias
npm run dev      # abrir en http://localhost:3000
npm test         # pruebas de cálculos y de la base de datos (con PGlite)
npm run lint
```

Crear un archivo `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (ver `.env.example`).

Estructura:

- `supabase/migrations/` — SQL de la base, en orden.
- `supabase/tests/esquema.test.mjs` — pruebas de permisos, historial, cierre de mes y cálculos.
- `supabase/legacy/` — esquema de la versión anterior (solo como referencia).
- `src/services/store.js` — conexión con Supabase y tiempo real.
- `scripts/google-drive-backup.gs` — backup diario en Drive.
- `backups/github/` — flujos de backup y restauración para el repositorio privado.
