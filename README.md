# ✂️ BarberFlow Pro - Sistema de Gestión, Caja Diaria y Finanzas

Aplicación web profesional diseñada a medida para la barbería de **Ema y Diego**. Permite a los barberos cargar ventas y gastos desde sus celulares, administrar la base de datos de clientes con mensajes de **WhatsApp directo** y obtener reportes financieros de precisión contable para la liquidación del **40% de comisiones** y conciliación bancaria.

---

## 🚀 Funcionalidades Principales

### 📱 1. Planilla de Caja Diaria (Mobile-First)
- **Registro Rápido de Clientes**: Nombre, celular, servicio realizado, barbero a cargo y medio de pago (💵 Contado / Efectivo vs 💳 Transferencia Bancaria).
- **Carga de Egresos y Adelantos**: Registro inmediato de gastos (bidón de agua, insumos, limpieza) y adelantos de sueldo a Ema, Diego o barberos invitados.
- **Totales Automáticos**: Tarjetas con el total facturado del día, efectivo en caja chica, transferencias recibidas y egresos.

### 💬 2. Base de Datos de Clientes & WhatsApp Directo
- **Historial Completo**: Generación automática de ficha de clientes con total gastado, cantidad de visitas y última fecha de atención.
- **Botón de WhatsApp Directo**: Envío de mensajes directo al celular del cliente con 1 solo clic.
- **Plantillas Pre-diseñadas**: Recordatorio de turno, promociones del mes, agradecimiento post-corte o mensaje a medida.

### 📊 3. Resumen Mensual y Decisiones Financieras de Precisión
- **Liquidación del 40% de Comisiones**: Calcula automáticamente el 40% que le corresponde a cada barbero (Ema, Diego o equipo) según lo facturado a su nombre, descontando los adelantos tomados en el mes y mostrando el **saldo neto exacto en efectivo a pagar**.
- **💰 Conciliación Bancaria**: Muestra cuánto dinero EXACTO debe haber depositado en la cuenta bancaria por transferencias netas de gastos pagados con banco.
- **💵 Conciliación de Caja Chica**: Muestra el dinero en efectivo físico real que debe haber en el cajón de la barbería.
- **Gráficos e Indicadores**: Distribución de ventas por forma de pago, ticket promedio por cliente y facturación comparativa por barbero.

---

## Accesos, permisos y copias de seguridad

La aplicación usa Supabase Auth y Supabase Database. Cada persona debe tener su propia cuenta; no compartas tu cuenta de administradora. Las cuentas con rol `employee` solo pueden cargar ventas/gastos nuevos, ver la caja del día y la lista de clientes. No pueden acceder al resumen mensual ni a configuración, editar/eliminar registros, ni consultar ventas y gastos de otros días. El rol `admin` se asigna desde el panel de Supabase y no se puede obtener ingresando un PIN en la aplicación.

### Configuración inicial de permisos

1. **Descargá primero un backup JSON** desde Configuración en la versión que estás usando. Guardalo en un lugar privado; contiene información de clientes.
2. En Supabase, abrí **Authentication > Users** y creá una cuenta con tu email. Creá también una cuenta distinta para cada empleado. Definí las contraseñas desde el panel y comunicáselas por un canal privado.
3. En **SQL Editor**, ejecutá `supabase/schema.sql`. El script conserva las tablas/datos actuales, quita las políticas abiertas anteriores y deja el acceso a los datos sujeto a funciones seguras por rol.
4. En SQL Editor, reemplazá los tres emails de ejemplo por los emails exactos de las cuentas recién creadas y ejecutá:

```sql
INSERT INTO public.barberflow_user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE lower(email) = lower('TU_EMAIL')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO public.barberflow_user_roles (user_id, role)
SELECT id, 'employee' FROM auth.users
WHERE lower(email) IN (lower('EMAIL_EMPLEADO_1'), lower('EMAIL_EMPLEADO_2'))
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role;
```

5. Comprobá los roles con:

```sql
SELECT u.email, r.role
FROM auth.users AS u
JOIN public.barberflow_user_roles AS r ON r.user_id = u.id
ORDER BY r.role, u.email;
```

Solo tu cuenta debe figurar como `admin`. En **Authentication > Settings** desactivá el registro público de usuarios, si estuviera habilitado. Para sumar o quitar empleados, hacelo desde Supabase y actualizá su rol desde SQL Editor.

### Publicación en Vercel

En **Vercel > Project > Settings > Environment Variables**, configurá:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon
```

La clave `anon`/publishable puede estar en el frontend: la seguridad depende de las políticas de base y las funciones de este esquema. **Nunca** pongas una `service_role`/secret key en Vercel como `VITE_*`, en el código o en el navegador. Después de agregar o cambiar variables, hacé un nuevo despliegue.

### Reducir el riesgo de perder datos

- En Supabase, revisá **Database > Backups** y activá la frecuencia de backups que ofrezca tu plan; las opciones y la retención dependen del plan contratado.
- Descargá además el backup JSON de Configuración con regularidad y antes de cambiar permisos o publicar versiones nuevas.
- Los cambios de ventas y gastos hechos por empleados se agregan en la base con una función que no permite editar ni borrar operaciones anteriores. Los intentos directos de leer o cambiar tablas quedan bloqueados por los permisos de la base.
- Los cambios administrativos que eliminan registros archivan el estado anterior en `barberflow_app_data_history`. La cuenta `admin` y el propietario del proyecto siguen teniendo capacidad administrativa; ningún servicio puede garantizar riesgo cero. Verificá periódicamente que exista un backup descargable y que se pueda restaurar.

No ejecutes el nuevo esquema hasta haber descargado tu copia JSON. Si el proyecto ya tiene datos en Supabase, el esquema no los borra; aplicá la migración y luego comprobá que tu usuario `admin` siga viendo los datos antes de crear/usar las cuentas de empleados.

---

## 🛠️ Ejecución Local (En esta computadora)

Para probar o realizar cambios localmente:

```bash
# 1. Instalar dependencias
npm install

# 2. Iniciar servidor de desarrollo
npm run dev
```

Abre en tu navegador en `http://localhost:3000`.

---

Desarrollado con ❤️ para la Barbería de **Ema y Diego**.
