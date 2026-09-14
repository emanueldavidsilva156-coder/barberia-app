create table if not exists public.barberflow_customers (
  id text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.barberflow_customers enable row level security;

create policy "Clientes visibles para la app"
  on public.barberflow_customers for select
  using (true);

create policy "Clientes guardables desde la app"
  on public.barberflow_customers for insert
  with check (true);

create policy "Clientes actualizables desde la app"
  on public.barberflow_customers for update
  using (true)
  with check (true);