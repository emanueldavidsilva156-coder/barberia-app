-- PASO 1 · Copia de seguridad de la versión anterior (antes de tocar nada)
--
-- Copia las tablas de la app vieja a un esquema aparte llamado "archivo_v1".
-- No borra ni modifica nada. Se puede ejecutar más de una vez: si la copia ya
-- existe, no la pisa.
--
-- La app nueva no lee estas tablas. Quedan guardadas por si alguna vez hace
-- falta consultar algo de la versión anterior.

CREATE SCHEMA IF NOT EXISTS archivo_v1;
REVOKE ALL ON SCHEMA archivo_v1 FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  legacy_table TEXT;
BEGIN
  FOREACH legacy_table IN ARRAY ARRAY[
    'barberflow_app_data',
    'barberflow_customers',
    'barberflow_user_roles',
    'barberflow_app_data_history'
  ]
  LOOP
    IF to_regclass('public.' || legacy_table) IS NOT NULL
       AND to_regclass('archivo_v1.' || legacy_table) IS NULL THEN
      EXECUTE format('CREATE TABLE archivo_v1.%I AS TABLE public.%I', legacy_table, legacy_table);
      RAISE NOTICE 'Copiada la tabla %', legacy_table;
    END IF;
  END LOOP;
END;
$$;

-- Comprobación: debe mostrar las tablas copiadas.
SELECT table_name AS tabla_copiada
FROM information_schema.tables
WHERE table_schema = 'archivo_v1'
ORDER BY table_name;
