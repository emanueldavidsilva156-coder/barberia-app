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

## Publicación y base compartida de clientes

La aplicación funciona sin servidor usando `localStorage`, pero esos datos solo existen en un navegador. Para compartir la base entre celulares hay que configurar Supabase antes de publicar.

### 1. Crear la base en Supabase

1. Crear un proyecto en [Supabase](https://supabase.com).
2. Abrir **SQL Editor**, pegar el contenido de `supabase/schema.sql` y ejecutarlo.
3. Copiar la URL del proyecto y la clave pública `anon`.
4. Crear un archivo `.env.local` a partir de `.env.example` y completar:
```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-clave-anon
```

### 2. Subir a GitHub

Crear un repositorio vacío en GitHub y ejecutar en esta carpeta:
```bash
git init
git add .
git commit -m "BarberFlow Pro con base compartida"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/barberia-app.git
git push -u origin main
```

No subir `.env.local`: contiene la configuración del proyecto y debe agregarse también como variable de entorno en el proveedor de hosting.

### 3. Publicar en Vercel

1. Importar el repositorio desde [Vercel](https://vercel.com).
2. Agregar `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en **Settings > Environment Variables**.
3. Publicar con el comando de build `npm run build`.

### 4. Conservar los clientes actuales

Los clientes que estaban guardados en `localhost` no aparecen automáticamente en un dominio nuevo. Usar la opción de exportación JSON de la aplicación actual, abrir la aplicación publicada, entrar en Configuración e importar ese JSON. La importación sincroniza los clientes con Supabase y, desde entonces, todos los celulares cargarán la misma base.

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
