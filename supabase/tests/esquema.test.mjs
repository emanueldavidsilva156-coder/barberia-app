import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = fileURLToPath(new URL('../..', import.meta.url));
const sql = (name) => readFileSync(join(repo, 'supabase', name), 'utf8');
const db = new PGlite();

const ids = {
  ema: '11111111-1111-1111-1111-111111111111',
  diego: '22222222-2222-2222-2222-222222222222',
  lionel: '33333333-3333-3333-3333-333333333333',
  extra: '44444444-4444-4444-4444-444444444444',
  stranger: '55555555-5555-5555-5555-555555555555'
};

// Simulación mínima de Supabase
await db.exec(`
  CREATE ROLE anon NOLOGIN;
  CREATE ROLE authenticated NOLOGIN;
  CREATE SCHEMA auth;
  CREATE TABLE auth.users (id UUID PRIMARY KEY, email TEXT);
  CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE SQL STABLE AS
    $$ SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID $$;
  GRANT USAGE ON SCHEMA auth TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  GRANT USAGE ON SCHEMA public TO anon, authenticated;
  INSERT INTO auth.users VALUES
    ('${ids.ema}', 'barber.radikal+ema@gmail.com'),
    ('${ids.diego}', 'barber.radikal+diego@gmail.com'),
    ('${ids.lionel}', 'barber.radikal+lionel@gmail.com'),
    ('${ids.extra}', 'barber.radikal+barbero4@gmail.com'),
    ('${ids.stranger}', 'otro@gmail.com');
`);

// Versión vieja con datos
await db.exec(sql('legacy/schema_v1.sql'));
await db.query(`INSERT INTO public.barberflow_app_data (key, data) VALUES
  ('customers', $1), ('services', $2), ('transactions', $3)`, [
  JSON.stringify([
    { id: 'c1', name: 'Juan', phone: '351-555-1111', birthdate: '09-13' },
    { id: 'c2', name: 'Juan Duplicado', phone: '3515551111', birthdate: '' },
    { id: 'c3', name: 'Pedro', phone: '', birthdate: '' }
  ]),
  JSON.stringify([{ id: 'corte', name: 'Corte de Pelo', type: 'servicio', price: 7000 }]),
  JSON.stringify([{ id: 'tx1', amount: 1000, date: '2026-11-01' }])
]);

// Reglas abiertas de la primera versión, como las que tiene hoy el proyecto real
await db.exec(`
  CREATE POLICY "Datos de la app visibles para el equipo" ON public.barberflow_app_data FOR SELECT TO anon, authenticated USING (true);
  CREATE POLICY "Clientes guardables desde la app" ON public.barberflow_customers FOR INSERT TO anon, authenticated WITH CHECK (true);
  GRANT ALL ON public.barberflow_app_data, public.barberflow_customers TO anon, authenticated;
`);

for (const file of ['000_respaldo_previo.sql', '001_esquema.sql', '002_importar_catalogo.sql', '003_usuarios.sql']) {
  await db.exec(sql(`migrations/${file}`));
  console.log('OK', file);
}
// Ejecutar dos veces lo que debe ser repetible
await db.exec(sql('migrations/000_respaldo_previo.sql'));
await db.exec(sql('migrations/002_importar_catalogo.sql'));
await db.exec(sql('migrations/003_usuarios.sql'));

const asSuper = async () => { await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '', false);`); };
const as = async (who) => {
  await db.exec(`RESET ROLE; SELECT set_config('request.jwt.claim.sub', '${ids[who]}', false); SET ROLE authenticated;`);
};
const one = async (q, p) => (await db.query(q, p)).rows[0];
const rows = async (q, p) => (await db.query(q, p)).rows;
const fails = async (q, p, re) => {
  try { await db.query(q, p); } catch (e) {
    if (re) assert.match(e.message, re);
    return e.message;
  }
  throw new Error('Se esperaba un error: ' + q);
};
const test = async (name, fn) => {
  try { await fn(); console.log('  ✓', name); }
  catch (e) { console.log('  ✗', name, '\n    ', e.message); process.exitCode = 1; }
  finally { await asSuper(); }
};

await asSuper();
const barber = Object.fromEntries((await rows('SELECT name, id FROM public.barbers')).map(r => [r.name, r.id]));
const today = (await one('SELECT public.bf_today()::text AS d')).d;
const service = (await one(`SELECT id FROM public.services WHERE name = 'Corte de Pelo'`)).id;
console.log('Hoy en Córdoba:', today);

await test('import: solo el catálogo viejo; clientes y ventas arrancan de cero', async () => {
  assert.equal((await one('SELECT count(*)::int AS n FROM public.customers')).n, 0);
  const s = await rows('SELECT name, price FROM public.services');
  assert.equal(s.length, 1);
  assert.equal(Number(s[0].price), 7000);
  assert.equal((await one('SELECT count(*)::int AS n FROM public.sales')).n, 0);
});

await test('usuarios vinculados con su rol', async () => {
  const p = await rows('SELECT username, role, active FROM public.profiles ORDER BY username');
  assert.deepEqual(p.map(x => `${x.username}:${x.role}:${x.active}`),
    ['barbero4:barber:false', 'diego:barber:true', 'ema:admin:true', 'lionel:barber:true']);
});

await test('anon no ve nada', async () => {
  await db.exec(`RESET ROLE; SET ROLE anon;`);
  await fails('SELECT * FROM public.sales', [], /permission denied/);
  await fails('SELECT public.bf_whoami()', [], /permission denied/);
});

await test('usuario sin perfil o desactivado no ve nada', async () => {
  await as('stranger');
  assert.equal((await rows('SELECT * FROM public.customers')).length, 0);
  await fails('SELECT public.bf_whoami()', [], /no está habilitada/);
  await fails(`INSERT INTO public.sales (barber_id, service_name, amount, payment_method) VALUES ($1,'x',1,'efectivo')`, [barber.Lionel]);
  await as('extra');
  assert.equal((await rows('SELECT * FROM public.sales')).length, 0);
});

let lionelSale;
await test('barbero carga venta de hoy; quién y cuándo se guardan solos', async () => {
  await as('lionel');
  const r = await one(`INSERT INTO public.sales (barber_id, service_id, service_name, amount, tip, payment_method, created_by, commission_rate)
    VALUES ($1, $2, 'Corte de Pelo', 7000, 500, 'efectivo', $3, 0.9) RETURNING *`, [barber.Lionel, service, ids.ema]);
  lionelSale = r.id;
  assert.equal(r.created_by, ids.lionel, 'created_by no se puede falsificar');
  assert.equal(Number(r.commission_rate), 0.5, 'comisión siempre la del barbero');
  assert.equal(r.movement_date.toISOString().slice(0, 10), today);
});

await test('barbero no puede cargar otro día', async () => {
  await as('lionel');
  await fails(`INSERT INTO public.sales (movement_date, barber_id, service_name, amount, payment_method) VALUES ('2026-01-05', $1, 'x', 1, 'efectivo')`, [barber.Lionel], /día de hoy/);
});

await test('todos ven las ventas de todos', async () => {
  await as('diego');
  assert.equal((await rows('SELECT * FROM public.sales')).length, 1);
});

await test('barbero corrige venta de hoy (con motivo) y queda en el historial', async () => {
  await as('diego');
  await fails(`UPDATE public.sales SET amount = 8000 WHERE id = $1`, [lionelSale], /motivo/);
  const r = await one(`UPDATE public.sales SET amount = 8000, edit_reason = 'Era combo' WHERE id = $1 RETURNING *`, [lionelSale]);
  assert.equal(Number(r.amount), 8000);
  assert.equal(r.updated_by, ids.diego);
  assert.equal(r.created_by, ids.lionel);
  assert.equal(r.edit_reason, null);
  await asSuper();
  const log = await one(`SELECT * FROM public.audit_log WHERE record_id = $1 AND action = 'UPDATE'`, [lionelSale]);
  assert.equal(log.reason, 'Era combo');
  assert.equal(log.changed_by_name, 'Diego');
  assert.equal(Number(log.old_data.amount), 7000);
  assert.equal(Number(log.new_data.amount), 8000);
});

await test('barbero no puede pasar la venta a otro barbero ni anular ni borrar', async () => {
  await as('diego');
  await fails(`UPDATE public.sales SET barber_id = $2, edit_reason = 'x' WHERE id = $1`, [lionelSale, barber.Diego], /administración/);
  await fails(`UPDATE public.sales SET voided = true, void_reason = 'x' WHERE id = $1`, [lionelSale], /administración/);
  await fails(`DELETE FROM public.sales WHERE id = $1`, [lionelSale], /permission denied/);
});

await test('admin tampoco puede borrar; solo anular con motivo', async () => {
  await as('ema');
  await fails(`DELETE FROM public.sales WHERE id = $1`, [lionelSale], /permission denied/);
  await fails(`UPDATE public.sales SET voided = true WHERE id = $1`, [lionelSale], /motivo/);
});

await test('adelantos: el barbero carga solo los suyos, todos los ven', async () => {
  await as('lionel');
  await fails(`INSERT INTO public.salary_advances (barber_id, amount, payment_method) VALUES ($1, 1000, 'efectivo')`, [barber.Diego], /propios adelantos/);
  await db.query(`INSERT INTO public.salary_advances (barber_id, amount, payment_method) VALUES ($1, 2000, 'efectivo')`, [barber.Lionel]);
  await as('diego');
  assert.equal((await rows('SELECT * FROM public.salary_advances')).length, 1);
  await as('ema');
  await db.query(`INSERT INTO public.salary_advances (barber_id, amount, payment_method) VALUES ($1, 3000, 'banco')`, [barber.Diego]);
});

await test('gastos: sociedad o personal de un socio (no de Lionel)', async () => {
  await as('lionel');
  await db.query(`INSERT INTO public.expenses (category, description, amount, payment_method) VALUES ('agua', 'Bidón', 10000, 'efectivo')`);
  await fails(`INSERT INTO public.expenses (category, description, amount, payment_method, charged_to_barber_id) VALUES ('varios', 'x', 1, 'efectivo', $1)`, [barber.Lionel], /socio/);
  await db.query(`INSERT INTO public.expenses (category, description, amount, payment_method, charged_to_barber_id) VALUES ('varios', 'Algo de Diego', 4000, 'efectivo', $1)`, [barber.Diego]);
});

await test('pagos de sueldo y gastos fijos: solo admin', async () => {
  await as('lionel');
  await fails(`INSERT INTO public.barber_payments (barber_id, period_start, period_end, amount, payment_method) VALUES ($1, $2, $2, 1, 'efectivo')`, [barber.Lionel, today]);
  await fails(`INSERT INTO public.fixed_expenses (movement_date, name, amount) VALUES ($1, 'Alquiler', 1)`, [today]);
  assert.equal((await rows('SELECT * FROM public.fixed_expenses')).length, 0);
  await as('ema');
  await db.query(`INSERT INTO public.fixed_expenses (movement_date, name, amount, payment_method) VALUES ($1, 'Alquiler', 20000, 'banco')`, [today]);
  await as('lionel');
  assert.equal((await rows('SELECT * FROM public.fixed_expenses')).length, 0, 'Lionel no ve gastos fijos');
  await as('diego');
  assert.equal((await rows('SELECT * FROM public.fixed_expenses')).length, 1, 'Diego (socio) sí los ve');
});

await test('resumen del mes: liquidación 50%, sociedad y visibilidad', async () => {
  await as('ema');
  await db.query(`INSERT INTO public.sales (barber_id, service_name, amount, tip, payment_method) VALUES ($1, 'Corte', 10000, 0, 'transferencia')`, [barber.Diego]);
  const r = (await one('SELECT public.bf_month_report($1) AS r', [today])).r;
  const lio = r.barbers.find(b => b.name === 'Lionel');
  assert.equal(Number(lio.month.commission), 4000);       // 50% de 8000
  assert.equal(Number(lio.month.tips), 500);
  assert.equal(Number(lio.month.advances), 2000);
  assert.equal(Number(lio.month.balance), 2500);
  assert.ok(lio.weeks.length >= 4, 'Lionel tiene semanas');
  // Casa = 4000 + 5000 = 9000; gastos sociedad 10000 (bidón); fijos 20000 → -21000
  assert.equal(Number(r.society.house_share), 9000);
  assert.equal(Number(r.society.society_expenses), 10000);
  assert.equal(Number(r.society.fixed_expenses), 20000);
  assert.equal(Number(r.society.profit), -21000);
  const diego = r.society.partners.find(p => p.name === 'Diego');
  assert.equal(Number(diego.share), -10500);
  assert.equal(Number(diego.personal_expenses), 4000);
  // Diego como barbero: 5000 comisión - 3000 adelanto = 2000
  assert.equal(Number(diego.barber_balance), 2000);
  assert.equal(Number(diego.total), 2000 - 10500 - 4000);
  // Caja: +8500 efectivo - 10000 bidón - 4000 Diego - 2000 adelanto Lionel = -7500
  assert.equal(Number(r.money.caja.net), -7500);
  // Banco: +10000 - 3000 adelanto Diego - 20000 alquiler = -13000
  assert.equal(Number(r.money.banco.net), -13000);
  assert.equal(Number(r.totals.total), 18500);

  await as('lionel');
  const rl = (await one('SELECT public.bf_month_report($1) AS r', [today])).r;
  assert.equal(rl.society, null, 'Lionel no ve la sociedad');
  assert.equal(rl.money, null, 'Lionel no ve conciliación');
  assert.ok(rl.barbers.length >= 3, 'Lionel ve las liquidaciones');
  await as('diego');
  const rd = (await one('SELECT public.bf_month_report($1) AS r', [today])).r;
  assert.ok(rd.society, 'Diego ve la sociedad');
  assert.equal(rd.money, null);
});

await test('pago de sueldo descuenta del saldo de la semana', async () => {
  await as('ema');
  const r = (await one('SELECT public.bf_month_report($1) AS r', [today])).r;
  const week = r.barbers.find(b => b.name === 'Lionel').weeks
    .find(w => w.period_start <= today && w.period_end >= today);
  assert.equal(Number(week.balance), 2500);
  await db.query(`INSERT INTO public.barber_payments (barber_id, period_start, period_end, amount, payment_method) VALUES ($1, $2, $3, 2500, 'efectivo')`,
    [barber.Lionel, week.period_start, week.period_end]);
  const after = (await one('SELECT public.bf_settlement($1, $2, $3) AS r', [barber.Lionel, week.period_start, week.period_end])).r;
  assert.equal(Number(after.balance), 0);
});

await test('conciliación de caja: esperado vs contado', async () => {
  await as('ema');
  const r = (await one(`SELECT public.bf_add_reconciliation('caja', $1, 1000, 'conteo') AS r`, [today])).r;
  // -7500 - 2500 pago de sueldo = -10000 esperado
  assert.equal(Number(r.expected), -10000);
  assert.equal(Number(r.difference), 11000);
  await as('lionel');
  await fails(`SELECT public.bf_add_reconciliation('caja', $1, 1, '')`, [today], /No autorizado/);
  assert.equal((await rows('SELECT * FROM public.reconciliations')).length, 0);
});

await test('clientes: alta por celular sin duplicar e historial', async () => {
  await as('lionel');
  const juan = (await one(`SELECT public.bf_upsert_customer('Juan', '351-555-1111', '09-13') AS id`)).id;
  const a = (await one(`SELECT public.bf_upsert_customer('Juancito', '(351) 555 1111', '') AS id`)).id;
  const b = (await one(`SELECT public.bf_upsert_customer('Nuevo', '351 999 0000', '05-20') AS id`)).id;
  assert.equal(a, juan, 'mismo celular con otro formato = mismo cliente');
  assert.notEqual(b, juan);
  assert.equal((await one(`SELECT birthdate FROM public.customers WHERE id = $1`, [juan])).birthdate, '09-13');
  await db.query(`INSERT INTO public.sales (barber_id, customer_id, client_name, service_name, amount, payment_method) VALUES ($1, $2, 'Juan', 'Corte', 7000, 'efectivo')`, [barber.Lionel, juan]);
  const s = await one(`SELECT * FROM public.customer_stats WHERE id = $1`, [juan]);
  assert.equal(s.visit_count, 1);
  assert.equal(Number(s.total_spent), 7000);
});

await test('cierre de mes bloquea todo, también al admin', async () => {
  await as('ema');
  await db.query(`INSERT INTO public.sales (movement_date, barber_id, service_name, amount, payment_method) VALUES ('2026-10-15', $1, 'Corte', 5000, 'efectivo')`, [barber.Diego]);
  const sale = (await one(`SELECT id FROM public.sales WHERE movement_date = '2026-10-15'`)).id;
  await fails(`SELECT public.bf_close_month($1)`, [today], /no terminó/);
  await as('lionel');
  await fails(`SELECT public.bf_close_month('2026-10-01')`, [], /administración/);
  await as('ema');
  const snap = (await one(`SELECT public.bf_close_month('2026-10-01') AS s`)).s;
  assert.equal(Number(snap.totals.total), 5000);
  await fails(`UPDATE public.sales SET amount = 1, edit_reason = 'x' WHERE id = $1`, [sale], /cerrado/);
  await fails(`UPDATE public.sales SET voided = true, void_reason = 'x' WHERE id = $1`, [sale], /cerrado/);
  await fails(`INSERT INTO public.sales (movement_date, barber_id, service_name, amount, payment_method) VALUES ('2026-10-20', $1, 'x', 1, 'efectivo')`, [barber.Diego], /cerrado/);
  await fails(`UPDATE public.sales SET movement_date = '2026-10-31', edit_reason = 'x' WHERE id = $1`, [lionelSale], /cerrado/);
  await fails(`SELECT public.bf_close_month('2026-10-01')`, [], /ya está cerrado/);
  const r = (await one(`SELECT public.bf_month_report('2026-10-01') AS r`)).r;
  assert.ok(r.closing, 'el mes cerrado se sigue viendo');
});

await test('anulación por admin con motivo; anulado no se edita y no suma', async () => {
  await as('ema');
  const r = await one(`UPDATE public.sales SET voided = true, void_reason = 'Cargado dos veces' WHERE id = $1 RETURNING *`, [lionelSale]);
  assert.equal(r.voided, true);
  assert.equal(r.voided_by, ids.ema);
  await fails(`UPDATE public.sales SET amount = 1, edit_reason = 'x' WHERE id = $1`, [lionelSale], /anulado/);
  const rep = (await one('SELECT public.bf_month_report($1) AS r', [today])).r;
  const lio = rep.barbers.find(b => b.name === 'Lionel');
  assert.equal(Number(lio.month.services), 7000, 'la venta anulada no suma');
  const log = await one(`SELECT * FROM public.audit_log WHERE record_id = $1 AND action = 'VOID'`, [lionelSale]);
  assert.equal(log.reason, 'Cargado dos veces');
});

await test('historial: solo admin lo ve y nadie lo modifica', async () => {
  await as('diego');
  assert.equal((await rows('SELECT * FROM public.audit_log')).length, 0);
  await as('ema');
  assert.ok((await rows('SELECT * FROM public.audit_log')).length > 5);
  await fails(`DELETE FROM public.audit_log`, [], /permission denied/);
  await asSuper();
  await fails(`DELETE FROM public.audit_log`, [], /no se puede modificar/);
});

await test('tablas viejas cerradas aunque tuvieran reglas abiertas', async () => {
  await db.exec(`RESET ROLE; SET ROLE anon;`);
  await fails('SELECT * FROM public.barberflow_app_data', [], /permission denied/);
  await fails(`INSERT INTO public.barberflow_customers (id, data) VALUES ('x', '{}')`, [], /permission denied/);
  await as('ema');
  await fails('SELECT * FROM public.barberflow_app_data', [], /permission denied/);
  await asSuper();
  assert.equal((await one(`SELECT count(*)::int AS n FROM pg_policy WHERE polrelid::regclass::text LIKE '%barberflow%'`)).n, 0);
});

await test('app vieja bloqueada', async () => {
  await as('ema');
  await fails(`SELECT public.admin_save_app_data('transactions', '[]'::jsonb)`, [], /permission denied/);
  await fails(`SELECT public.get_my_role()`, [], /permission denied/);
});

await test('copiar gastos fijos al mes siguiente', async () => {
  await as('ema');
  const next = (await one(`SELECT (date_trunc('month', $1::date) + interval '1 month')::date::text AS d`, [today])).d;
  assert.equal((await one(`SELECT public.bf_copy_fixed_expenses($1) AS n`, [next])).n, 1);
  assert.equal((await one(`SELECT public.bf_copy_fixed_expenses($1) AS n`, [next])).n, 0);
});

await test('whoami', async () => {
  await as('diego');
  const w = (await one('SELECT public.bf_whoami() AS w')).w;
  assert.equal(w.role, 'barber');
  assert.equal(w.can_see_society, true);
  await as('lionel');
  assert.equal((await one('SELECT public.bf_whoami() AS w')).w.can_see_society, false);
});

console.log(process.exitCode ? '\nHAY FALLAS' : '\nTodo OK');
