CREATE TABLE IF NOT EXISTS public.barberflow_app_data (
  key TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.barberflow_customers (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.barberflow_user_roles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'employee')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_barberflow_single_admin
  ON public.barberflow_user_roles (role)
  WHERE role = 'admin';

CREATE TABLE IF NOT EXISTS public.barberflow_app_data_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  data_key TEXT NOT NULL,
  data JSONB NOT NULL,
  changed_by UUID,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.barberflow_app_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barberflow_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barberflow_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barberflow_app_data_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clientes visibles para la app" ON public.barberflow_customers;
DROP POLICY IF EXISTS "Clientes guardables desde la app" ON public.barberflow_customers;
DROP POLICY IF EXISTS "Clientes actualizables desde la app" ON public.barberflow_customers;
DROP POLICY IF EXISTS "Datos de la app visibles para el equipo" ON public.barberflow_app_data;
DROP POLICY IF EXISTS "Datos de la app guardables por el equipo" ON public.barberflow_app_data;
DROP POLICY IF EXISTS "Datos de la app actualizables por el equipo" ON public.barberflow_app_data;

REVOKE ALL ON TABLE public.barberflow_app_data FROM anon, authenticated;
REVOKE ALL ON TABLE public.barberflow_customers FROM anon, authenticated;
REVOKE ALL ON TABLE public.barberflow_user_roles FROM anon, authenticated;
REVOKE ALL ON TABLE public.barberflow_app_data_history FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role
  FROM public.barberflow_user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_app_data()
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.barberflow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT COALESCE(jsonb_object_agg(key, data), '{}'::jsonb)
  INTO result
  FROM public.barberflow_app_data;

  IF NOT (result ? 'customers') THEN
    SELECT jsonb_set(
      result,
      '{customers}',
      COALESCE((SELECT jsonb_agg(data) FROM public.barberflow_customers), '[]'::jsonb)
    )
    INTO result;
  END IF;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_get_app_data()
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
  today_text TEXT := to_char(timezone('UTC', now())::date, 'YYYY-MM-DD');
  transactions JSONB;
  expenses JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.barberflow_user_roles
    WHERE user_id = auth.uid() AND role = 'employee'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
  INTO transactions
  FROM jsonb_array_elements(COALESCE(
    (SELECT data FROM public.barberflow_app_data WHERE key = 'transactions'),
    '[]'::jsonb
  )) AS transaction_entry(item)
  WHERE transaction_entry.item->>'date' = today_text;

  SELECT COALESCE(jsonb_agg(item), '[]'::jsonb)
  INTO expenses
  FROM jsonb_array_elements(COALESCE(
    (SELECT data FROM public.barberflow_app_data WHERE key = 'expenses'),
    '[]'::jsonb
  )) AS expense_entry(item)
  WHERE expense_entry.item->>'date' = today_text;

  SELECT jsonb_build_object(
    'transactions', transactions,
    'expenses', expenses,
    'customers', COALESCE(
      (SELECT data FROM public.barberflow_app_data WHERE key = 'customers'),
      (SELECT jsonb_agg(data) FROM public.barberflow_customers),
      '[]'::jsonb
    ),
    'barbers', COALESCE(
      (SELECT jsonb_agg(item - 'commissionRate')
       FROM jsonb_array_elements(COALESCE(
         (SELECT data FROM public.barberflow_app_data WHERE key = 'barbers'),
         '[]'::jsonb
       )) AS barber(item)),
      '[]'::jsonb
    ),
    'services', COALESCE(
      (SELECT data FROM public.barberflow_app_data WHERE key = 'services'),
      '[]'::jsonb
    )
  )
  INTO result;

  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_app_data(p_key TEXT, p_value JSONB)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  old_value JSONB;
  should_archive BOOLEAN := false;
  allowed_keys TEXT[] := ARRAY[
    'transactions', 'expenses', 'customers', 'barbers', 'services',
    'fixed_expenses', 'bank_expenses_override',
    'commission_migration_50_v1'
  ];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.barberflow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_key IS NULL OR NOT (p_key = ANY(allowed_keys)) OR p_value IS NULL THEN
    RAISE EXCEPTION 'Clave o valor no permitido';
  END IF;
  IF (p_key IN ('transactions', 'expenses', 'customers', 'barbers', 'services')
      AND jsonb_typeof(p_value) <> 'array')
     OR (p_key IN ('fixed_expenses', 'bank_expenses_override')
      AND jsonb_typeof(p_value) <> 'object')
     OR (p_key = 'commission_migration_50_v1'
      AND jsonb_typeof(p_value) <> 'string') THEN
    RAISE EXCEPTION 'El formato de los datos no es válido';
  END IF;

  SELECT data INTO old_value
  FROM public.barberflow_app_data
  WHERE key = p_key
  FOR UPDATE;

  IF FOUND AND old_value IS DISTINCT FROM p_value THEN
    IF p_key IN ('transactions', 'expenses')
       AND jsonb_typeof(old_value) = 'array'
       AND jsonb_typeof(p_value) = 'array' THEN
      should_archive := EXISTS (
        SELECT 1
        FROM jsonb_array_elements(old_value) AS old_entry(item)
        WHERE NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(p_value) AS new_entry(item)
          WHERE new_entry.item = old_entry.item
        )
      );
    ELSIF p_key = 'customers'
       AND jsonb_typeof(old_value) = 'array'
       AND jsonb_typeof(p_value) = 'array' THEN
      should_archive := EXISTS (
        SELECT 1
        FROM jsonb_array_elements(old_value) AS old_entry(item)
        WHERE NOT EXISTS (
          SELECT 1
          FROM jsonb_array_elements(p_value) AS new_entry(item)
          WHERE new_entry.item->>'id' = old_entry.item->>'id'
            AND (new_entry.item - ARRAY['totalSpent', 'visitCount', 'monthlyVisitsCount', 'lastVisit', 'servicesHistory'])
              = (old_entry.item - ARRAY['totalSpent', 'visitCount', 'monthlyVisitsCount', 'lastVisit', 'servicesHistory'])
        )
      );
    ELSE
      should_archive := true;
    END IF;
    IF should_archive THEN
      INSERT INTO public.barberflow_app_data_history (data_key, data, changed_by)
      VALUES (p_key, old_value, auth.uid());
    END IF;
  END IF;

  INSERT INTO public.barberflow_app_data (key, data, updated_at)
  VALUES (p_key, p_value, now())
  ON CONFLICT (key)
  DO UPDATE SET data = EXCLUDED.data, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_append_entry(p_collection TEXT, p_entry JSONB)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  entries JSONB;
  today_text TEXT := to_char(timezone('UTC', now())::date, 'YYYY-MM-DD');
  customer_list JSONB;
  customer_key TEXT;
  customer_index INTEGER;
  customer_record JSONB;
  entry_amount NUMERIC;
  current_total NUMERIC;
  current_month TEXT := to_char(timezone('UTC', now()), 'YYYY-MM');
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.barberflow_user_roles
    WHERE user_id = auth.uid() AND role = 'employee'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_collection IS NULL OR p_collection NOT IN ('transactions', 'expenses')
     OR jsonb_typeof(p_entry) <> 'object'
     OR COALESCE(p_entry->>'id', '') = ''
     OR p_entry->>'date' IS DISTINCT FROM today_text
     OR COALESCE((p_entry->>'amount')::NUMERIC, 0) <= 0
     OR COALESCE((p_entry->>'tip')::NUMERIC, 0) < 0 THEN
    RAISE EXCEPTION 'La operación no cumple las condiciones de carga';
  END IF;

  INSERT INTO public.barberflow_app_data (key, data)
  VALUES (p_collection, '[]'::jsonb)
  ON CONFLICT (key) DO NOTHING;

  SELECT data INTO entries
  FROM public.barberflow_app_data
  WHERE key = p_collection
  FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(entries) AS existing(item)
    WHERE existing.item->>'id' = p_entry->>'id'
  ) THEN
    RETURN;
  END IF;

  UPDATE public.barberflow_app_data
  SET data = entries || jsonb_build_array(p_entry), updated_at = now()
  WHERE key = p_collection;

  IF p_collection = 'transactions'
     AND COALESCE(NULLIF(trim(p_entry->>'clientPhone'), ''), NULLIF(trim(p_entry->>'clientName'), '')) IS NOT NULL THEN
    customer_key := lower(trim(COALESCE(
      NULLIF(p_entry->>'clientPhone', ''),
      NULLIF(p_entry->>'clientName', '')
    )));
    SELECT COALESCE(
      (SELECT data FROM public.barberflow_app_data WHERE key = 'customers'),
      (SELECT jsonb_agg(data) FROM public.barberflow_customers),
      '[]'::jsonb
    )
    INTO customer_list;

    SELECT (ordinality - 1)::INTEGER INTO customer_index
    FROM jsonb_array_elements(customer_list) WITH ORDINALITY AS customer(item, ordinality)
    WHERE lower(trim(COALESCE(
      NULLIF(item->>'phone', ''),
      NULLIF(item->>'name', '')
    ))) = customer_key
    LIMIT 1;

    entry_amount := COALESCE((p_entry->>'amount')::NUMERIC, 0)
      + COALESCE((p_entry->>'tip')::NUMERIC, 0);

    IF customer_index IS NULL THEN
      customer_record := jsonb_build_object(
        'id', 'cust-' || replace(gen_random_uuid()::TEXT, '-', ''),
        'name', COALESCE(NULLIF(p_entry->>'clientName', ''), 'Cliente Ocasional'),
        'phone', COALESCE(p_entry->>'clientPhone', ''),
        'birthdate', COALESCE(p_entry->>'birthdate', ''),
        'totalSpent', entry_amount,
        'visitCount', 1,
        'monthlyVisitsCount', CASE WHEN left(today_text, 7) = current_month THEN 1 ELSE 0 END,
        'lastVisit', today_text,
        'servicesHistory', jsonb_build_array(COALESCE(p_entry->>'service', ''))
      );
      customer_list := customer_list || jsonb_build_array(customer_record);
    ELSE
      customer_record := customer_list->customer_index;
      current_total := COALESCE((customer_record->>'totalSpent')::NUMERIC, 0);
      customer_record := jsonb_set(customer_record, '{totalSpent}', to_jsonb(current_total + entry_amount), true);
      customer_record := jsonb_set(
        customer_record,
        '{visitCount}',
        to_jsonb(COALESCE((customer_record->>'visitCount')::INTEGER, 0) + 1),
        true
      );
      IF left(today_text, 7) = current_month THEN
        customer_record := jsonb_set(
          customer_record,
          '{monthlyVisitsCount}',
          to_jsonb(COALESCE((customer_record->>'monthlyVisitsCount')::INTEGER, 0) + 1),
          true
        );
      END IF;
      customer_record := jsonb_set(
        customer_record,
        '{servicesHistory}',
        COALESCE(customer_record->'servicesHistory', '[]'::jsonb)
          || jsonb_build_array(COALESCE(p_entry->>'service', '')),
        true
      );
      IF COALESCE(customer_record->>'lastVisit', '') < today_text THEN
        customer_record := jsonb_set(customer_record, '{lastVisit}', to_jsonb(today_text), true);
        IF COALESCE(p_entry->>'clientName', '') <> '' THEN
          customer_record := jsonb_set(customer_record, '{name}', to_jsonb(p_entry->>'clientName'), true);
        END IF;
      END IF;
      IF COALESCE(customer_record->>'birthdate', '') = '' AND COALESCE(p_entry->>'birthdate', '') <> '' THEN
        customer_record := jsonb_set(customer_record, '{birthdate}', to_jsonb(p_entry->>'birthdate'), true);
      END IF;
      customer_list := jsonb_set(customer_list, ARRAY[customer_index::TEXT], customer_record, false);
    END IF;

    INSERT INTO public.barberflow_app_data (key, data, updated_at)
    VALUES ('customers', customer_list, now())
    ON CONFLICT (key)
    DO UPDATE SET data = EXCLUDED.data, updated_at = now();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_app_data_history()
RETURNS TABLE(id BIGINT, data_key TEXT, archived_at TIMESTAMPTZ)
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.barberflow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  RETURN QUERY
  SELECT history.id, history.data_key, history.archived_at
  FROM public.barberflow_app_data_history AS history
  ORDER BY history.archived_at DESC
  LIMIT 100;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_app_data_history(p_history_id BIGINT)
RETURNS VOID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  archived_key TEXT;
  archived_data JSONB;
  current_data JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.barberflow_user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT data_key, data
  INTO archived_key, archived_data
  FROM public.barberflow_app_data_history
  WHERE id = p_history_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la versión solicitada';
  END IF;

  SELECT data INTO current_data
  FROM public.barberflow_app_data
  WHERE key = archived_key
  FOR UPDATE;

  IF FOUND AND current_data IS DISTINCT FROM archived_data THEN
    INSERT INTO public.barberflow_app_data_history (data_key, data, changed_by)
    VALUES (archived_key, current_data, auth.uid());
  END IF;

  INSERT INTO public.barberflow_app_data (key, data, updated_at)
  VALUES (archived_key, archived_data, now())
  ON CONFLICT (key)
  DO UPDATE SET data = EXCLUDED.data, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_role() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_app_data() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_get_app_data() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_app_data(TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_append_entry(TEXT, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_app_data_history() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_restore_app_data_history(BIGINT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_my_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_app_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_get_app_data() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_app_data(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_append_entry(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_app_data_history() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_restore_app_data_history(BIGINT) TO authenticated;
