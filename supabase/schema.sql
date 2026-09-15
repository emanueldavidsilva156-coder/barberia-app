create table if not exists public.barberflow_customers (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.barberflow_customers enable row level security;

drop policy if exists "Clientes visibles para la app" on public.barberflow_customers;
drop policy if exists "Clientes guardables desde la app" on public.barberflow_customers;
drop policy if exists "Clientes actualizables desde la app" on public.barberflow_customers;

create policy "Clientes visibles para la app"
  on public.barberflow_customers for select to anon, authenticated
  using (true);

create policy "Clientes guardables desde la app"
  on public.barberflow_customers for insert to anon, authenticated
  with check (true);

create policy "Clientes actualizables desde la app"
  on public.barberflow_customers for update to anon, authenticated
  using (true)
  with check (true);

create table if not exists public.barberflow_app_data (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.barberflow_app_data enable row level security;

drop policy if exists "Datos de la app visibles para el equipo" on public.barberflow_app_data;
drop policy if exists "Datos de la app guardables por el equipo" on public.barberflow_app_data;
drop policy if exists "Datos de la app actualizables por el equipo" on public.barberflow_app_data;

create policy "Datos de la app visibles para el equipo"
  on public.barberflow_app_data for select to anon, authenticated
  using (true);

create policy "Datos de la app guardables por el equipo"
  on public.barberflow_app_data for insert to anon, authenticated
  with check (true);

create policy "Datos de la app actualizables por el equipo"
  on public.barberflow_app_data for update to anon, authenticated
  using (true)
  with check (true);