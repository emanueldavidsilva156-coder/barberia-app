-- PASO 2 · Base de datos de Barbería Radikal (versión 2)
--
-- Crea las tablas, las reglas de acceso (RLS), el historial de cambios, el
-- bloqueo de meses cerrados y los cálculos de liquidación y conciliación.
-- No borra las tablas de la versión anterior: solo deja de usarlas.
--
-- Se ejecuta una sola vez, completo, en Supabase > SQL Editor.

-- ---------------------------------------------------------------------------
-- Fecha de hoy en Córdoba
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bf_today()
RETURNS DATE
LANGUAGE SQL
STABLE
SET search_path = ''
AS $$
  SELECT (now() AT TIME ZONE 'America/Argentina/Cordoba')::DATE;
$$;

-- ---------------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------------

CREATE TABLE public.barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE CHECK (length(trim(name)) > 0),
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.50 CHECK (commission_rate >= 0 AND commission_rate <= 1),
  pay_frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (pay_frequency IN ('weekly', 'monthly')),
  is_partner BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ
);

CREATE TABLE public.profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE CHECK (username = lower(trim(username)) AND length(username) > 0),
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'barber')),
  barber_id UUID REFERENCES public.barbers(id),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (role = 'admin' OR barber_id IS NOT NULL)
);
CREATE INDEX profiles_barber_idx ON public.profiles (barber_id);

CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  type TEXT NOT NULL DEFAULT 'servicio' CHECK (type IN ('servicio', 'producto')),
  price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ
);

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  phone TEXT NOT NULL DEFAULT '',
  birthdate TEXT NOT NULL DEFAULT '',
  edit_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ
);

-- Un mismo celular no puede repetirse entre clientes (se comparan solo los números).
CREATE UNIQUE INDEX customers_phone_unique
  ON public.customers ((NULLIF(regexp_replace(phone, '\D', '', 'g'), '')));

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_date DATE NOT NULL DEFAULT public.bf_today(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id),
  customer_id UUID REFERENCES public.customers(id),
  client_name TEXT NOT NULL DEFAULT 'Cliente Ocasional',
  client_phone TEXT NOT NULL DEFAULT '',
  service_id UUID REFERENCES public.services(id),
  service_name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  tip NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tip >= 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'transferencia')),
  commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.50,
  voided BOOLEAN NOT NULL DEFAULT false,
  void_reason TEXT,
  voided_by UUID,
  voided_at TIMESTAMPTZ,
  edit_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ
);
CREATE INDEX sales_date_idx ON public.sales (movement_date);
CREATE INDEX sales_barber_date_idx ON public.sales (barber_id, movement_date);
CREATE INDEX sales_customer_idx ON public.sales (customer_id);
CREATE INDEX sales_service_idx ON public.sales (service_id);

-- Gastos del día. charged_to_barber_id vacío = gasto de la sociedad (50% y 50%);
-- con un socio = gasto personal de ese socio.
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_date DATE NOT NULL DEFAULT public.bf_today(),
  category TEXT NOT NULL CHECK (category IN ('insumos', 'agua', 'limpieza', 'varios')),
  description TEXT NOT NULL CHECK (length(trim(description)) > 0),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'banco')),
  charged_to_barber_id UUID REFERENCES public.barbers(id),
  voided BOOLEAN NOT NULL DEFAULT false,
  void_reason TEXT,
  voided_by UUID,
  voided_at TIMESTAMPTZ,
  edit_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ
);
CREATE INDEX expenses_date_idx ON public.expenses (movement_date);
CREATE INDEX expenses_charged_to_idx ON public.expenses (charged_to_barber_id);

CREATE TABLE public.salary_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_date DATE NOT NULL DEFAULT public.bf_today(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'banco')),
  note TEXT NOT NULL DEFAULT '',
  voided BOOLEAN NOT NULL DEFAULT false,
  void_reason TEXT,
  voided_by UUID,
  voided_at TIMESTAMPTZ,
  edit_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ
);
CREATE INDEX salary_advances_date_idx ON public.salary_advances (movement_date);
CREATE INDEX salary_advances_barber_idx ON public.salary_advances (barber_id, movement_date);

-- Pagos de sueldo (solo administración). movement_date = día en que se pagó.
CREATE TABLE public.barber_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_date DATE NOT NULL DEFAULT public.bf_today(),
  barber_id UUID NOT NULL REFERENCES public.barbers(id),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('efectivo', 'banco')),
  note TEXT NOT NULL DEFAULT '',
  voided BOOLEAN NOT NULL DEFAULT false,
  void_reason TEXT,
  voided_by UUID,
  voided_at TIMESTAMPTZ,
  edit_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ,
  CHECK (period_end >= period_start)
);
CREATE INDEX barber_payments_period_idx ON public.barber_payments (barber_id, period_start, period_end);

-- Gastos fijos del mes (alquiler, luz, internet...). Siempre de la sociedad.
CREATE TABLE public.fixed_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_date DATE NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'banco' CHECK (payment_method IN ('efectivo', 'banco')),
  edit_reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ
);
CREATE INDEX fixed_expenses_date_idx ON public.fixed_expenses (movement_date);

-- Conciliaciones: lo que se contó (caja) o se vio en el banco, contra lo esperado.
CREATE TABLE public.reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('caja', 'banco')),
  movement_date DATE NOT NULL,
  expected NUMERIC(12,2) NOT NULL,
  actual NUMERIC(12,2) NOT NULL,
  difference NUMERIC(12,2) NOT NULL,
  note TEXT NOT NULL DEFAULT '',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID,
  updated_at TIMESTAMPTZ
);
CREATE INDEX reconciliations_kind_date_idx ON public.reconciliations (kind, movement_date);

CREATE TABLE public.month_closings (
  month DATE PRIMARY KEY CHECK (month = date_trunc('month', month)::DATE),
  closed_by UUID,
  closed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot JSONB NOT NULL
);

CREATE TABLE public.audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'VOID', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  reason TEXT,
  changed_by UUID,
  changed_by_name TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_changed_at_idx ON public.audit_log (changed_at DESC);
CREATE INDEX audit_log_record_idx ON public.audit_log (table_name, record_id);

-- ---------------------------------------------------------------------------
-- Quién es el usuario actual
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bf_role()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT role FROM public.profiles WHERE user_id = auth.uid() AND active;
$$;

CREATE OR REPLACE FUNCTION public.bf_is_active_user()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.bf_role() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.bf_is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(public.bf_role() = 'admin', false);
$$;

CREATE OR REPLACE FUNCTION public.bf_my_barber_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT barber_id FROM public.profiles WHERE user_id = auth.uid() AND active;
$$;

-- La parte de la sociedad la ven la administración y los socios.
CREATE OR REPLACE FUNCTION public.bf_can_see_society()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.bf_is_admin() OR EXISTS (
    SELECT 1
    FROM public.profiles AS p
    JOIN public.barbers AS b ON b.id = p.barber_id
    WHERE p.user_id = auth.uid() AND p.active AND b.is_partner
  );
$$;

CREATE OR REPLACE FUNCTION public.bf_whoami()
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'user_id', p.user_id,
    'username', p.username,
    'display_name', p.display_name,
    'role', p.role,
    'barber_id', p.barber_id,
    'can_see_society', public.bf_can_see_society(),
    'today', public.bf_today()
  )
  INTO result
  FROM public.profiles AS p
  WHERE p.user_id = auth.uid() AND p.active;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Esta cuenta no está habilitada. Pedile a la administración que la active.';
  END IF;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.bf_month_is_closed(p_date DATE)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.month_closings
    WHERE month = date_trunc('month', p_date)::DATE
  );
$$;

-- ---------------------------------------------------------------------------
-- Guardia de cada cambio: quién y cuándo, permisos por día, mes cerrado,
-- anulaciones e historial de cambios.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bf_guard()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_role TEXT := public.bf_role();
  v_today DATE := public.bf_today();
  v_new JSONB;
  v_old JSONB;
  v_new_date DATE;
  v_old_date DATE;
  v_action TEXT := TG_OP;
  v_reason TEXT;
  v_is_movement BOOLEAN := TG_TABLE_NAME IN ('sales', 'expenses', 'salary_advances');
  v_needs_reason BOOLEAN := TG_TABLE_NAME IN ('sales', 'expenses', 'salary_advances', 'barber_payments', 'fixed_expenses');
  v_changer TEXT;
BEGIN
  IF v_uid IS NOT NULL AND v_role IS NULL THEN
    RAISE EXCEPTION 'Esta cuenta no está habilitada.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_old := to_jsonb(OLD);
    v_old_date := (v_old->>'movement_date')::DATE;
    IF v_old_date IS NOT NULL AND public.bf_month_is_closed(v_old_date) THEN
      RAISE EXCEPTION 'El mes % está cerrado: no se puede modificar.', to_char(v_old_date, 'MM/YYYY');
    END IF;
    v_new := NULL;
  ELSE
    v_new := to_jsonb(NEW);
    v_new_date := (v_new->>'movement_date')::DATE;
    IF TG_OP = 'UPDATE' THEN
      v_old := to_jsonb(OLD);
      v_old_date := (v_old->>'movement_date')::DATE;
    END IF;

    -- Mes cerrado: nadie agrega ni cambia nada de ese mes.
    IF (v_new_date IS NOT NULL AND public.bf_month_is_closed(v_new_date))
       OR (v_old_date IS NOT NULL AND public.bf_month_is_closed(v_old_date)) THEN
      RAISE EXCEPTION 'El mes % está cerrado: no se puede modificar.',
        to_char(COALESCE(v_old_date, v_new_date), 'MM/YYYY');
    END IF;

    -- Registros anulados quedan como están.
    IF TG_OP = 'UPDATE' AND COALESCE((v_old->>'voided')::BOOLEAN, false) THEN
      RAISE EXCEPTION 'Este registro está anulado y no se puede modificar.';
    END IF;

    IF TG_OP = 'UPDATE'
       AND COALESCE((v_new->>'voided')::BOOLEAN, false)
       AND NOT COALESCE((v_old->>'voided')::BOOLEAN, false) THEN
      v_action := 'VOID';
    END IF;

    -- Reglas para barberos.
    IF v_role = 'barber' THEN
      IF NOT v_is_movement AND TG_TABLE_NAME <> 'customers' THEN
        RAISE EXCEPTION 'Solo la administración puede modificar esto.';
      END IF;
      IF v_is_movement THEN
        IF TG_OP = 'INSERT' THEN
          IF v_new_date IS DISTINCT FROM v_today THEN
            RAISE EXCEPTION 'Solo se pueden cargar movimientos del día de hoy.';
          END IF;
          IF COALESCE((v_new->>'voided')::BOOLEAN, false) THEN
            RAISE EXCEPTION 'Solo la administración puede anular registros.';
          END IF;
          IF TG_TABLE_NAME = 'salary_advances'
             AND (v_new->>'barber_id')::UUID IS DISTINCT FROM public.bf_my_barber_id() THEN
            RAISE EXCEPTION 'Cada barbero carga solo sus propios adelantos.';
          END IF;
        ELSE
          IF v_old_date IS DISTINCT FROM v_today THEN
            RAISE EXCEPTION 'Los barberos solo pueden corregir movimientos del día de hoy.';
          END IF;
          IF v_new_date IS DISTINCT FROM v_old_date THEN
            RAISE EXCEPTION 'No se puede cambiar la fecha de un movimiento.';
          END IF;
          IF v_action = 'VOID'
             OR (v_new->'void_reason') IS DISTINCT FROM (v_old->'void_reason') THEN
            RAISE EXCEPTION 'Solo la administración puede anular registros.';
          END IF;
          IF TG_TABLE_NAME IN ('sales', 'salary_advances')
             AND (v_new->'barber_id') IS DISTINCT FROM (v_old->'barber_id') THEN
            RAISE EXCEPTION 'Solo la administración puede pasar un movimiento a otro barbero.';
          END IF;
        END IF;
      END IF;
    END IF;

    -- Quién cargó y cuándo (no se puede falsificar desde el celular).
    IF TG_OP = 'INSERT' THEN
      IF v_new ? 'created_by' AND v_uid IS NOT NULL THEN
        v_new := v_new || jsonb_build_object('created_by', v_uid);
      END IF;
      IF v_new ? 'created_at' THEN
        v_new := v_new || jsonb_build_object('created_at', now());
      END IF;
      IF v_new ? 'updated_by' THEN
        v_new := v_new || jsonb_build_object('updated_by', NULL, 'updated_at', NULL);
      END IF;
      IF v_new ? 'voided' THEN
        v_new := v_new || jsonb_build_object('voided', false, 'void_reason', NULL, 'voided_by', NULL, 'voided_at', NULL);
      END IF;
    ELSE
      IF v_new ? 'created_by' THEN
        v_new := v_new || jsonb_build_object('created_by', v_old->'created_by', 'created_at', v_old->'created_at');
      END IF;
      IF v_new ? 'updated_by' THEN
        v_new := v_new || jsonb_build_object('updated_by', v_uid, 'updated_at', now());
      END IF;
    END IF;

    -- Anulación: solo con motivo.
    IF v_action = 'VOID' THEN
      v_reason := NULLIF(trim(COALESCE(v_new->>'void_reason', '')), '');
      IF v_reason IS NULL THEN
        RAISE EXCEPTION 'Indicá el motivo de la anulación.';
      END IF;
      v_new := v_new || jsonb_build_object('voided_by', v_uid, 'voided_at', now());
    ELSIF TG_OP = 'UPDATE' THEN
      IF v_new ? 'voided' THEN
        v_new := v_new || jsonb_build_object(
          'voided', false, 'void_reason', NULL, 'voided_by', NULL, 'voided_at', NULL
        );
      END IF;
      IF v_new ? 'edit_reason' THEN
        v_reason := NULLIF(trim(COALESCE(v_new->>'edit_reason', '')), '');
      END IF;
      IF v_needs_reason AND v_reason IS NULL THEN
        RAISE EXCEPTION 'Indicá el motivo de la corrección.';
      END IF;
    END IF;

    -- La comisión se toma del barbero al cargar o al cambiar de barbero.
    IF TG_TABLE_NAME = 'sales' THEN
      IF TG_OP = 'INSERT' OR (v_new->'barber_id') IS DISTINCT FROM (v_old->'barber_id') THEN
        v_new := v_new || jsonb_build_object('commission_rate', (
          SELECT commission_rate FROM public.barbers WHERE id = (v_new->>'barber_id')::UUID
        ));
      ELSE
        v_new := v_new || jsonb_build_object('commission_rate', v_old->'commission_rate');
      END IF;
    END IF;

    -- Un gasto personal solo puede cargarse a un socio.
    IF TG_TABLE_NAME = 'expenses' AND v_new->>'charged_to_barber_id' IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.barbers
         WHERE id = (v_new->>'charged_to_barber_id')::UUID AND is_partner
       ) THEN
      RAISE EXCEPTION 'Un gasto personal solo puede cargarse a un socio.';
    END IF;

    -- El motivo se guarda en el historial y se limpia para la próxima corrección.
    IF v_new ? 'edit_reason' THEN
      v_new := v_new || jsonb_build_object('edit_reason', NULL);
    END IF;
  END IF;

  SELECT display_name INTO v_changer FROM public.profiles WHERE user_id = v_uid;

  INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, reason, changed_by, changed_by_name)
  VALUES (
    TG_TABLE_NAME,
    COALESCE(v_new->>'id', v_old->>'id', v_new->>'month', v_old->>'month', v_new->>'user_id', v_old->>'user_id'),
    v_action,
    v_old,
    v_new,
    v_reason,
    v_uid,
    COALESCE(v_changer, 'Sistema')
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  NEW := jsonb_populate_record(NEW, v_new);
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  guarded_table TEXT;
BEGIN
  FOREACH guarded_table IN ARRAY ARRAY[
    'barbers', 'services', 'customers', 'sales', 'expenses', 'salary_advances',
    'barber_payments', 'fixed_expenses', 'reconciliations', 'profiles'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER bf_guard BEFORE INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.bf_guard()',
      guarded_table
    );
  END LOOP;
END;
$$;

-- El cierre de mes y su eventual reapertura de emergencia quedan en el historial.
CREATE OR REPLACE FUNCTION public.bf_audit_month_closing()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_changer TEXT;
BEGIN
  SELECT display_name INTO v_changer FROM public.profiles WHERE user_id = auth.uid();
  INSERT INTO public.audit_log (table_name, record_id, action, old_data, new_data, reason, changed_by, changed_by_name)
  VALUES (
    'month_closings',
    COALESCE(NEW.month, OLD.month)::TEXT,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) - 'snapshot' END,
    CASE WHEN TG_OP = 'INSERT' THEN to_jsonb(NEW) - 'snapshot' END,
    CASE WHEN TG_OP = 'INSERT' THEN 'Cierre de mes' ELSE 'Reapertura de emergencia' END,
    auth.uid(),
    COALESCE(v_changer, 'Sistema')
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER bf_audit_month_closing
  AFTER INSERT OR DELETE ON public.month_closings
  FOR EACH ROW EXECUTE FUNCTION public.bf_audit_month_closing();

-- El historial no se puede editar ni borrar desde la app.
CREATE OR REPLACE FUNCTION public.bf_audit_is_append_only()
RETURNS TRIGGER
LANGUAGE PLPGSQL
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'El historial de cambios no se puede modificar.';
END;
$$;

CREATE TRIGGER bf_audit_is_append_only
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW EXECUTE FUNCTION public.bf_audit_is_append_only();

-- ---------------------------------------------------------------------------
-- Permisos (RLS)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  app_table TEXT;
BEGIN
  FOREACH app_table IN ARRAY ARRAY[
    'barbers', 'profiles', 'services', 'customers', 'sales', 'expenses', 'salary_advances',
    'barber_payments', 'fixed_expenses', 'reconciliations', 'month_closings', 'audit_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', app_table);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', app_table);
  END LOOP;
END;
$$;

-- Lectura
GRANT SELECT ON public.barbers, public.profiles, public.services, public.customers,
  public.sales, public.expenses, public.salary_advances, public.barber_payments,
  public.fixed_expenses, public.reconciliations, public.month_closings, public.audit_log
  TO authenticated;

-- Escritura (nadie puede borrar movimientos: solo anularlos)
GRANT INSERT, UPDATE ON public.customers, public.sales, public.expenses, public.salary_advances,
  public.barber_payments, public.barbers, public.services
  TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.fixed_expenses TO authenticated;

CREATE POLICY "equipo ve barberos" ON public.barbers FOR SELECT TO authenticated USING ((SELECT public.bf_is_active_user()));
CREATE POLICY "admin agrega barberos" ON public.barbers FOR INSERT TO authenticated WITH CHECK ((SELECT public.bf_is_admin()));
CREATE POLICY "admin edita barberos" ON public.barbers FOR UPDATE TO authenticated USING ((SELECT public.bf_is_admin())) WITH CHECK ((SELECT public.bf_is_admin()));

CREATE POLICY "equipo ve usuarios" ON public.profiles FOR SELECT TO authenticated USING ((SELECT public.bf_is_active_user()));

CREATE POLICY "equipo ve catalogo" ON public.services FOR SELECT TO authenticated USING ((SELECT public.bf_is_active_user()));
CREATE POLICY "admin agrega catalogo" ON public.services FOR INSERT TO authenticated WITH CHECK ((SELECT public.bf_is_admin()));
CREATE POLICY "admin edita catalogo" ON public.services FOR UPDATE TO authenticated USING ((SELECT public.bf_is_admin())) WITH CHECK ((SELECT public.bf_is_admin()));

CREATE POLICY "equipo ve clientes" ON public.customers FOR SELECT TO authenticated USING ((SELECT public.bf_is_active_user()));
CREATE POLICY "equipo agrega clientes" ON public.customers FOR INSERT TO authenticated WITH CHECK ((SELECT public.bf_is_active_user()));
CREATE POLICY "equipo edita clientes" ON public.customers FOR UPDATE TO authenticated USING ((SELECT public.bf_is_active_user())) WITH CHECK ((SELECT public.bf_is_active_user()));

CREATE POLICY "equipo ve ventas" ON public.sales FOR SELECT TO authenticated USING ((SELECT public.bf_is_active_user()));
CREATE POLICY "equipo carga ventas" ON public.sales FOR INSERT TO authenticated WITH CHECK ((SELECT public.bf_is_active_user()));
CREATE POLICY "equipo corrige ventas" ON public.sales FOR UPDATE TO authenticated USING ((SELECT public.bf_is_active_user())) WITH CHECK ((SELECT public.bf_is_active_user()));

CREATE POLICY "equipo ve gastos" ON public.expenses FOR SELECT TO authenticated USING ((SELECT public.bf_is_active_user()));
CREATE POLICY "equipo carga gastos" ON public.expenses FOR INSERT TO authenticated WITH CHECK ((SELECT public.bf_is_active_user()));
CREATE POLICY "equipo corrige gastos" ON public.expenses FOR UPDATE TO authenticated USING ((SELECT public.bf_is_active_user())) WITH CHECK ((SELECT public.bf_is_active_user()));

CREATE POLICY "equipo ve adelantos" ON public.salary_advances FOR SELECT TO authenticated USING ((SELECT public.bf_is_active_user()));
CREATE POLICY "equipo carga adelantos" ON public.salary_advances FOR INSERT TO authenticated WITH CHECK ((SELECT public.bf_is_active_user()));
CREATE POLICY "equipo corrige adelantos" ON public.salary_advances FOR UPDATE TO authenticated USING ((SELECT public.bf_is_active_user())) WITH CHECK ((SELECT public.bf_is_active_user()));

CREATE POLICY "equipo ve pagos" ON public.barber_payments FOR SELECT TO authenticated USING ((SELECT public.bf_is_active_user()));
CREATE POLICY "admin registra pagos" ON public.barber_payments FOR INSERT TO authenticated WITH CHECK ((SELECT public.bf_is_admin()));
CREATE POLICY "admin corrige pagos" ON public.barber_payments FOR UPDATE TO authenticated USING ((SELECT public.bf_is_admin())) WITH CHECK ((SELECT public.bf_is_admin()));

CREATE POLICY "socios ven gastos fijos" ON public.fixed_expenses FOR SELECT TO authenticated USING ((SELECT public.bf_can_see_society()));
CREATE POLICY "admin agrega gastos fijos" ON public.fixed_expenses FOR INSERT TO authenticated WITH CHECK ((SELECT public.bf_is_admin()));
CREATE POLICY "admin edita gastos fijos" ON public.fixed_expenses FOR UPDATE TO authenticated USING ((SELECT public.bf_is_admin())) WITH CHECK ((SELECT public.bf_is_admin()));
CREATE POLICY "admin quita gastos fijos" ON public.fixed_expenses FOR DELETE TO authenticated USING ((SELECT public.bf_is_admin()));

CREATE POLICY "admin ve conciliaciones" ON public.reconciliations FOR SELECT TO authenticated USING ((SELECT public.bf_is_admin()));

CREATE POLICY "equipo ve cierres" ON public.month_closings FOR SELECT TO authenticated USING ((SELECT public.bf_is_active_user()));

CREATE POLICY "admin ve historial" ON public.audit_log FOR SELECT TO authenticated USING ((SELECT public.bf_is_admin()));

-- ---------------------------------------------------------------------------
-- Clientes con historial
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.customer_stats
WITH (security_invoker = true)
AS
SELECT
  c.id,
  c.name,
  c.phone,
  c.birthdate,
  c.created_at,
  count(s.id)::INTEGER AS visit_count,
  (count(s.id) FILTER (
    WHERE date_trunc('month', s.movement_date) = date_trunc('month', public.bf_today())
  ))::INTEGER AS month_visit_count,
  COALESCE(sum(s.amount + s.tip), 0) AS total_spent,
  max(s.movement_date) AS last_visit
FROM public.customers AS c
LEFT JOIN public.sales AS s ON s.customer_id = c.id AND NOT s.voided
GROUP BY c.id;

REVOKE ALL ON public.customer_stats FROM PUBLIC, anon;
GRANT SELECT ON public.customer_stats TO authenticated;

-- Busca un cliente por celular (o por nombre si no tiene celular) y lo crea si no existe.
CREATE OR REPLACE FUNCTION public.bf_upsert_customer(p_name TEXT, p_phone TEXT, p_birthdate TEXT DEFAULT '')
RETURNS UUID
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_name TEXT := NULLIF(trim(COALESCE(p_name, '')), '');
  v_phone TEXT := trim(COALESCE(p_phone, ''));
  v_phone_key TEXT := NULLIF(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), '');
  v_birthdate TEXT := trim(COALESCE(p_birthdate, ''));
  v_id UUID;
  v_current_birthdate TEXT;
BEGIN
  IF NOT public.bf_is_active_user() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF v_name IS NULL AND v_phone_key IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_phone_key IS NOT NULL THEN
    SELECT id, birthdate INTO v_id, v_current_birthdate
    FROM public.customers
    WHERE NULLIF(regexp_replace(phone, '\D', '', 'g'), '') = v_phone_key;
  ELSE
    SELECT id, birthdate INTO v_id, v_current_birthdate
    FROM public.customers
    WHERE NULLIF(regexp_replace(phone, '\D', '', 'g'), '') IS NULL
      AND lower(trim(name)) = lower(v_name)
    ORDER BY created_at
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    INSERT INTO public.customers (name, phone, birthdate)
    VALUES (COALESCE(v_name, 'Cliente Ocasional'), v_phone, v_birthdate)
    RETURNING id INTO v_id;
  ELSIF v_birthdate <> '' AND COALESCE(v_current_birthdate, '') = '' THEN
    UPDATE public.customers
    SET birthdate = v_birthdate, edit_reason = 'Cumpleaños cargado en una venta'
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Liquidaciones, sociedad y conciliaciones
-- ---------------------------------------------------------------------------

-- Liquidación de un barbero en un período: 50% de sus cortes + propinas
-- − adelantos del período − pagos ya hechos de ese período.
CREATE OR REPLACE FUNCTION public.bf_settlement(p_barber UUID, p_start DATE, p_end DATE)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cuts INTEGER;
  v_services NUMERIC;
  v_tips NUMERIC;
  v_commission NUMERIC;
  v_advances NUMERIC;
  v_paid NUMERIC;
BEGIN
  IF NOT public.bf_is_active_user() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT count(*), COALESCE(sum(amount), 0), COALESCE(sum(tip), 0),
         COALESCE(round(sum(amount * commission_rate), 2), 0)
  INTO v_cuts, v_services, v_tips, v_commission
  FROM public.sales
  WHERE barber_id = p_barber AND NOT voided AND movement_date BETWEEN p_start AND p_end;

  SELECT COALESCE(sum(amount), 0) INTO v_advances
  FROM public.salary_advances
  WHERE barber_id = p_barber AND NOT voided AND movement_date BETWEEN p_start AND p_end;

  SELECT COALESCE(sum(amount), 0) INTO v_paid
  FROM public.barber_payments
  WHERE barber_id = p_barber AND NOT voided
    AND period_start >= p_start AND period_end <= p_end;

  RETURN jsonb_build_object(
    'barber_id', p_barber,
    'period_start', p_start,
    'period_end', p_end,
    'cuts', v_cuts,
    'services', v_services,
    'tips', v_tips,
    'commission', v_commission,
    'gross', v_commission + v_tips,
    'advances', v_advances,
    'paid', v_paid,
    'balance', v_commission + v_tips - v_advances - v_paid
  );
END;
$$;

-- Entradas y salidas de dinero de la caja chica (efectivo) o del banco entre dos fechas.
CREATE OR REPLACE FUNCTION public.bf_money_flows(p_kind TEXT, p_from DATE, p_to DATE)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_in_method TEXT := CASE p_kind WHEN 'caja' THEN 'efectivo' WHEN 'banco' THEN 'transferencia' END;
  v_out_method TEXT := CASE p_kind WHEN 'caja' THEN 'efectivo' WHEN 'banco' THEN 'banco' END;
  v_sales NUMERIC;
  v_expenses NUMERIC;
  v_advances NUMERIC;
  v_payments NUMERIC;
  v_fixed NUMERIC;
BEGIN
  IF NOT public.bf_is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF v_in_method IS NULL THEN
    RAISE EXCEPTION 'Tipo de conciliación inválido';
  END IF;

  SELECT COALESCE(sum(amount + tip), 0) INTO v_sales FROM public.sales
  WHERE NOT voided AND payment_method = v_in_method AND movement_date BETWEEN p_from AND p_to;
  SELECT COALESCE(sum(amount), 0) INTO v_expenses FROM public.expenses
  WHERE NOT voided AND payment_method = v_out_method AND movement_date BETWEEN p_from AND p_to;
  SELECT COALESCE(sum(amount), 0) INTO v_advances FROM public.salary_advances
  WHERE NOT voided AND payment_method = v_out_method AND movement_date BETWEEN p_from AND p_to;
  SELECT COALESCE(sum(amount), 0) INTO v_payments FROM public.barber_payments
  WHERE NOT voided AND payment_method = v_out_method AND movement_date BETWEEN p_from AND p_to;
  SELECT COALESCE(sum(amount), 0) INTO v_fixed FROM public.fixed_expenses
  WHERE payment_method = v_out_method AND movement_date BETWEEN p_from AND p_to;

  RETURN jsonb_build_object(
    'sales_in', v_sales,
    'expenses_out', v_expenses,
    'advances_out', v_advances,
    'payments_out', v_payments,
    'fixed_out', v_fixed,
    'net', v_sales - v_expenses - v_advances - v_payments - v_fixed
  );
END;
$$;

-- Saldo esperado a una fecha: lo contado en la última conciliación anterior
-- más los movimientos desde entonces.
CREATE OR REPLACE FUNCTION public.bf_expected_balance(p_kind TEXT, p_as_of DATE)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_last_date DATE;
  v_opening NUMERIC := 0;
  v_from DATE := DATE '2000-01-01';
  v_flows JSONB;
BEGIN
  IF NOT public.bf_is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT movement_date, actual INTO v_last_date, v_opening
  FROM public.reconciliations
  WHERE kind = p_kind AND movement_date < p_as_of
  ORDER BY movement_date DESC, created_at DESC
  LIMIT 1;

  IF v_last_date IS NOT NULL THEN
    v_from := v_last_date + 1;
  ELSE
    v_opening := 0;
  END IF;

  v_flows := public.bf_money_flows(p_kind, v_from, p_as_of);
  RETURN jsonb_build_object(
    'kind', p_kind,
    'as_of', p_as_of,
    'opening_date', v_last_date,
    'opening', v_opening,
    'flows', v_flows,
    'expected', v_opening + (v_flows->>'net')::NUMERIC
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.bf_add_reconciliation(p_kind TEXT, p_date DATE, p_actual NUMERIC, p_note TEXT DEFAULT '')
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_expected NUMERIC;
  v_row public.reconciliations;
BEGIN
  IF NOT public.bf_is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF p_date > public.bf_today() THEN
    RAISE EXCEPTION 'No se puede conciliar una fecha futura.';
  END IF;
  IF p_actual IS NULL THEN
    RAISE EXCEPTION 'Indicá el monto contado.';
  END IF;

  v_expected := (public.bf_expected_balance(p_kind, p_date)->>'expected')::NUMERIC;

  INSERT INTO public.reconciliations (kind, movement_date, expected, actual, difference, note)
  VALUES (p_kind, p_date, v_expected, p_actual, p_actual - v_expected, COALESCE(p_note, ''))
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

-- Resumen completo de un mes. Cada parte se muestra según quién pregunta:
-- liquidaciones de barberos → todos; sociedad → admin y socios;
-- conciliación de caja y banco → admin.
CREATE OR REPLACE FUNCTION public.bf_month_report(p_month DATE)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  m_start DATE := date_trunc('month', p_month)::DATE;
  m_end DATE := (date_trunc('month', p_month) + INTERVAL '1 month - 1 day')::DATE;
  v_today DATE := public.bf_today();
  v_totals JSONB;
  v_house NUMERIC;
  v_barbers JSONB;
  v_daily JSONB;
  v_society JSONB := NULL;
  v_money JSONB := NULL;
  v_closing JSONB;
  v_variable NUMERIC;
  v_fixed NUMERIC;
  v_fixed_items JSONB;
  v_profit NUMERIC;
  v_partner_count INTEGER;
BEGIN
  IF NOT public.bf_is_active_user() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT jsonb_build_object(
      'services', COALESCE(sum(amount), 0),
      'tips', COALESCE(sum(tip), 0),
      'total', COALESCE(sum(amount + tip), 0),
      'cash', COALESCE(sum(amount + tip) FILTER (WHERE payment_method = 'efectivo'), 0),
      'transfer', COALESCE(sum(amount + tip) FILTER (WHERE payment_method = 'transferencia'), 0),
      'count', count(*),
      'ticket_avg', CASE WHEN count(*) > 0 THEN round(sum(amount) / count(*)) ELSE 0 END
    ),
    COALESCE(round(sum(amount * (1 - commission_rate)), 2), 0)
  INTO v_totals, v_house
  FROM public.sales
  WHERE NOT voided AND movement_date BETWEEN m_start AND m_end;

  SELECT COALESCE(jsonb_agg(barber_row ORDER BY sort_order, name), '[]'::JSONB)
  INTO v_barbers
  FROM (
    SELECT
      b.sort_order,
      b.name,
      jsonb_build_object(
        'barber_id', b.id,
        'name', b.name,
        'pay_frequency', b.pay_frequency,
        'is_partner', b.is_partner,
        'commission_rate', b.commission_rate,
        'month', public.bf_settlement(b.id, m_start, m_end),
        'weeks', CASE WHEN b.pay_frequency = 'weekly' THEN (
          SELECT COALESCE(jsonb_agg(public.bf_settlement(b.id, saturday::DATE - 6, saturday::DATE) ORDER BY saturday), '[]'::JSONB)
          FROM generate_series(
            m_start + ((6 - EXTRACT(DOW FROM m_start)::INTEGER) % 7),
            m_end,
            INTERVAL '7 days'
          ) AS saturday
        ) ELSE '[]'::JSONB END
      ) AS barber_row
    FROM public.barbers AS b
    WHERE b.active
       OR EXISTS (SELECT 1 FROM public.sales s WHERE s.barber_id = b.id AND s.movement_date BETWEEN m_start AND m_end)
       OR EXISTS (SELECT 1 FROM public.salary_advances a WHERE a.barber_id = b.id AND a.movement_date BETWEEN m_start AND m_end)
  ) AS rows_per_barber;

  SELECT COALESCE(jsonb_agg(day_row ORDER BY movement_date, name), '[]'::JSONB)
  INTO v_daily
  FROM (
    SELECT
      s.movement_date,
      b.name,
      jsonb_build_object(
        'date', s.movement_date,
        'barber_id', b.id,
        'name', b.name,
        'cuts', count(*),
        'services', sum(s.amount),
        'tips', sum(s.tip),
        'commission', round(sum(s.amount * s.commission_rate), 2),
        'advances', COALESCE((
          SELECT sum(a.amount) FROM public.salary_advances a
          WHERE a.barber_id = b.id AND NOT a.voided AND a.movement_date = s.movement_date
        ), 0)
      ) AS day_row
    FROM public.sales AS s
    JOIN public.barbers AS b ON b.id = s.barber_id
    WHERE NOT s.voided AND s.movement_date BETWEEN m_start AND m_end
    GROUP BY s.movement_date, b.id, b.name
  ) AS rows_per_day;

  IF public.bf_can_see_society() THEN
    SELECT COALESCE(sum(amount), 0) INTO v_variable
    FROM public.expenses
    WHERE NOT voided AND charged_to_barber_id IS NULL AND movement_date BETWEEN m_start AND m_end;

    SELECT COALESCE(sum(amount), 0),
           COALESCE(jsonb_agg(to_jsonb(f) ORDER BY f.movement_date, f.name), '[]'::JSONB)
    INTO v_fixed, v_fixed_items
    FROM public.fixed_expenses AS f
    WHERE f.movement_date BETWEEN m_start AND m_end;

    v_profit := v_house - v_variable - v_fixed;
    SELECT count(*) INTO v_partner_count FROM public.barbers WHERE is_partner;

    SELECT jsonb_build_object(
      'house_share', v_house,
      'society_expenses', v_variable,
      'fixed_expenses', v_fixed,
      'fixed_items', v_fixed_items,
      'profit', v_profit,
      'partners', COALESCE(jsonb_agg(partner_row ORDER BY sort_order, name), '[]'::JSONB)
    )
    INTO v_society
    FROM (
      SELECT
        b.sort_order,
        b.name,
        jsonb_build_object(
          'barber_id', b.id,
          'name', b.name,
          'share', round(v_profit / NULLIF(v_partner_count, 0), 2),
          'personal_expenses', personal.total,
          'partner_net', round(v_profit / NULLIF(v_partner_count, 0), 2) - personal.total,
          'barber_balance', (settlement->>'balance')::NUMERIC,
          'total', (settlement->>'balance')::NUMERIC
            + round(v_profit / NULLIF(v_partner_count, 0), 2) - personal.total
        ) AS partner_row
      FROM public.barbers AS b
      CROSS JOIN LATERAL (
        SELECT COALESCE(sum(e.amount), 0) AS total
        FROM public.expenses AS e
        WHERE NOT e.voided AND e.charged_to_barber_id = b.id AND e.movement_date BETWEEN m_start AND m_end
      ) AS personal
      CROSS JOIN LATERAL (SELECT public.bf_settlement(b.id, m_start, m_end) AS settlement) AS s
      WHERE b.is_partner
    ) AS partner_rows;
  END IF;

  IF public.bf_is_admin() THEN
    v_money := jsonb_build_object(
      'caja', public.bf_money_flows('caja', m_start, m_end),
      'banco', public.bf_money_flows('banco', m_start, m_end),
      'expected_caja', public.bf_expected_balance('caja', LEAST(m_end, v_today)),
      'expected_banco', public.bf_expected_balance('banco', LEAST(m_end, v_today)),
      'reconciliations', (
        SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.movement_date DESC, r.created_at DESC), '[]'::JSONB)
        FROM public.reconciliations AS r
        WHERE r.movement_date BETWEEN m_start AND m_end
      )
    );
  END IF;

  SELECT jsonb_build_object(
    'closed_at', c.closed_at,
    'closed_by_name', COALESCE(p.display_name, 'Sistema')
  )
  INTO v_closing
  FROM public.month_closings AS c
  LEFT JOIN public.profiles AS p ON p.user_id = c.closed_by
  WHERE c.month = m_start;

  RETURN jsonb_build_object(
    'month', to_char(m_start, 'YYYY-MM'),
    'month_start', m_start,
    'month_end', m_end,
    'today', v_today,
    'totals', v_totals,
    'barbers', v_barbers,
    'daily', v_daily,
    'society', v_society,
    'money', v_money,
    'closing', v_closing
  );
END;
$$;

-- Cierre de mes: guarda una foto de los números y bloquea el mes.
CREATE OR REPLACE FUNCTION public.bf_close_month(p_month DATE)
RETURNS JSONB
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  m_start DATE := date_trunc('month', p_month)::DATE;
  m_end DATE := (date_trunc('month', p_month) + INTERVAL '1 month - 1 day')::DATE;
  v_snapshot JSONB;
BEGIN
  IF NOT public.bf_is_admin() THEN
    RAISE EXCEPTION 'Solo la administración puede cerrar un mes.';
  END IF;
  IF m_end >= public.bf_today() THEN
    RAISE EXCEPTION 'El mes todavía no terminó. Se puede cerrar desde el día 1 del mes siguiente.';
  END IF;
  IF public.bf_month_is_closed(m_start) THEN
    RAISE EXCEPTION 'Ese mes ya está cerrado.';
  END IF;

  v_snapshot := public.bf_month_report(m_start);
  INSERT INTO public.month_closings (month, closed_by, snapshot)
  VALUES (m_start, auth.uid(), v_snapshot);
  RETURN v_snapshot;
END;
$$;

-- Copia los gastos fijos del mes anterior al mes indicado (no repite los que ya están).
CREATE OR REPLACE FUNCTION public.bf_copy_fixed_expenses(p_month DATE)
RETURNS INTEGER
LANGUAGE PLPGSQL
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  m_start DATE := date_trunc('month', p_month)::DATE;
  v_count INTEGER;
BEGIN
  IF NOT public.bf_is_admin() THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  INSERT INTO public.fixed_expenses (movement_date, name, amount, payment_method)
  SELECT m_start, previous.name, previous.amount, previous.payment_method
  FROM public.fixed_expenses AS previous
  WHERE previous.movement_date >= (m_start - INTERVAL '1 month')::DATE
    AND previous.movement_date < m_start
    AND NOT EXISTS (
      SELECT 1 FROM public.fixed_expenses AS existing
      WHERE existing.movement_date >= m_start
        AND existing.movement_date < (m_start + INTERVAL '1 month')::DATE
        AND lower(existing.name) = lower(previous.name)
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Funciones que puede usar la app (todas validan el usuario adentro).
DO $$
DECLARE
  fn TEXT;
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'public.bf_today()',
    'public.bf_role()',
    'public.bf_is_active_user()',
    'public.bf_is_admin()',
    'public.bf_my_barber_id()',
    'public.bf_can_see_society()',
    'public.bf_whoami()',
    'public.bf_month_is_closed(date)',
    'public.bf_upsert_customer(text, text, text)',
    'public.bf_settlement(uuid, date, date)',
    'public.bf_money_flows(text, date, date)',
    'public.bf_expected_balance(text, date)',
    'public.bf_add_reconciliation(text, date, numeric, text)',
    'public.bf_month_report(date)',
    'public.bf_close_month(date)',
    'public.bf_copy_fixed_expenses(date)'
  ]
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', fn);
  END LOOP;
  REVOKE ALL ON FUNCTION public.bf_guard() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.bf_audit_month_closing() FROM PUBLIC, anon, authenticated;
END;
$$;

-- ---------------------------------------------------------------------------
-- Tiempo real: los celulares reciben los cambios al instante.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  realtime_table TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
  FOREACH realtime_table IN ARRAY ARRAY[
    'barbers', 'services', 'customers', 'sales', 'expenses', 'salary_advances',
    'barber_payments', 'fixed_expenses', 'reconciliations', 'month_closings'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = realtime_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', realtime_table);
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Barberos iniciales (comisión 50%)
-- ---------------------------------------------------------------------------

INSERT INTO public.barbers (name, pay_frequency, is_partner, active, sort_order) VALUES
  ('Ema', 'monthly', true, true, 1),
  ('Diego', 'monthly', true, true, 2),
  ('Lionel', 'weekly', false, true, 3),
  ('Barbero 4', 'monthly', false, false, 4)
ON CONFLICT (name) DO NOTHING;

-- ---------------------------------------------------------------------------
-- La versión anterior de la app deja de poder leer o guardar datos.
-- Así, un celular con la app vieja muestra un error en vez de guardar en un
-- lugar que ya nadie mira.
-- ---------------------------------------------------------------------------

-- Las tablas viejas quedan cerradas: ni la app ni nadie de afuera puede leerlas
-- o escribirlas (la primera versión las tenía abiertas a cualquiera).
DO $$
DECLARE
  legacy_table TEXT;
  legacy_policy RECORD;
BEGIN
  FOREACH legacy_table IN ARRAY ARRAY[
    'barberflow_app_data', 'barberflow_customers', 'barberflow_user_roles', 'barberflow_app_data_history'
  ]
  LOOP
    IF to_regclass('public.' || legacy_table) IS NOT NULL THEN
      FOR legacy_policy IN
        SELECT polname FROM pg_policy WHERE polrelid = ('public.' || legacy_table)::regclass
      LOOP
        EXECUTE format('DROP POLICY %I ON public.%I', legacy_policy.polname, legacy_table);
      END LOOP;
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', legacy_table);
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', legacy_table);
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  legacy_fn TEXT;
BEGIN
  FOREACH legacy_fn IN ARRAY ARRAY[
    'public.get_my_role()',
    'public.admin_get_app_data()',
    'public.staff_get_app_data()',
    'public.admin_save_app_data(text, jsonb)',
    'public.staff_append_entry(text, jsonb)',
    'public.admin_get_app_data_history()',
    'public.admin_restore_app_data_history(bigint)'
  ]
  LOOP
    IF to_regprocedure(legacy_fn) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', legacy_fn);
    END IF;
  END LOOP;
END;
$$;
