-- PASO 3 · Pasar el catálogo de la versión anterior
--
-- Copia a la tabla nueva los servicios y productos con sus precios (si la
-- versión vieja no tenía catálogo, carga uno básico).
-- NO copia clientes, ventas, gastos ni adelantos: la app arranca de cero en
-- diciembre. Los datos viejos quedan guardados en el esquema "archivo_v1".
--
-- Se puede ejecutar más de una vez sin duplicar nada.

WITH legacy_services AS (
  SELECT
    trim(item->>'name') AS name,
    CASE WHEN item->>'type' = 'producto' THEN 'producto' ELSE 'servicio' END AS type,
    GREATEST(COALESCE(NULLIF(item->>'price', '')::NUMERIC, 0), 0) AS price,
    ordinality::INTEGER AS sort_order
  FROM jsonb_array_elements(COALESCE(
    (SELECT data FROM public.barberflow_app_data WHERE key = 'services' AND jsonb_typeof(data) = 'array'),
    '[]'::JSONB
  )) WITH ORDINALITY AS service(item, ordinality)
  WHERE NULLIF(trim(item->>'name'), '') IS NOT NULL
),
default_services (name, type, price, sort_order) AS (
  VALUES
    ('Corte de Pelo', 'servicio', 6000, 1),
    ('Arreglo de Barba', 'servicio', 4000, 2),
    ('Combo Corte + Barba', 'servicio', 8500, 3),
    ('Color / Tintura', 'servicio', 12000, 4),
    ('Corte Niños', 'servicio', 5000, 5),
    ('Cera para Peinar (Producto)', 'producto', 4500, 6),
    ('Aceite de Barba (Producto)', 'producto', 3800, 7),
    ('Pomada Mate (Producto)', 'producto', 5000, 8)
),
chosen_services AS (
  SELECT name, type, price, sort_order FROM legacy_services
  UNION ALL
  SELECT name, type, price, sort_order FROM default_services
  WHERE NOT EXISTS (SELECT 1 FROM legacy_services)
)
INSERT INTO public.services (name, type, price, sort_order)
SELECT DISTINCT ON (lower(name)) name, type, price, sort_order
FROM chosen_services AS s
WHERE NOT EXISTS (SELECT 1 FROM public.services AS existing WHERE lower(existing.name) = lower(s.name))
ORDER BY lower(name), sort_order;

-- Comprobación
SELECT 'servicios y productos' AS tabla, count(*) AS cantidad FROM public.services;
