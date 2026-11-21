// Conexión con Supabase. Todo se lee y se guarda directamente en la base de
// datos compartida; el celular solo guarda en memoria lo que está mostrando.
// Los cambios de otros celulares llegan en tiempo real.
import { createClient } from '@supabase/supabase-js';
import { currentMonth, monthEnd, monthOf, monthStart } from './dates.js';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const loginEmailTemplate = env.VITE_LOGIN_EMAIL_TEMPLATE || 'barber.radikal+{usuario}@gmail.com';

const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

const MOVEMENT_TABLES = ['sales', 'expenses', 'salary_advances', 'barber_payments'];
const PAGE_SIZE = 1000;

const createEmptyState = () => ({
  profile: null,
  barbers: [],
  services: [],
  profiles: [],
  customers: [],
  months: new Map(),
  closedMonths: new Set(),
  connection: 'offline',
  error: ''
});

let state = createEmptyState();
let version = 0;
let channel = null;
let hasSubscribedOnce = false;
let customersTimer = null;
const listeners = new Set();
const changeListeners = new Set();

const notify = () => {
  version += 1;
  listeners.forEach(listener => listener());
};

const notifyDataChange = (table) => {
  notify();
  changeListeners.forEach(listener => listener(table));
};

const translateError = (error) => {
  const message = error?.message || String(error || '');
  if (/Invalid login credentials/i.test(message)) return 'Usuario o contraseña incorrectos.';
  if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return 'Sin conexión a internet. Revisá la conexión y probá de nuevo.';
  if (/JWT expired|invalid JWT/i.test(message)) return 'La sesión venció. Volvé a iniciar sesión.';
  if (/permission denied|row-level security/i.test(message)) return 'Tu usuario no tiene permiso para hacer esto.';
  return message || 'Ocurrió un error inesperado.';
};

const fail = (error) => {
  const friendly = new Error(translateError(error));
  friendly.cause = error;
  throw friendly;
};

const requireClient = () => {
  if (!supabase) throw new Error('Falta configurar Supabase (VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY).');
  return supabase;
};

const rpc = async (name, params = {}) => {
  const { data, error } = await requireClient().rpc(name, params);
  if (error) fail(error);
  return data;
};

// PostgREST devuelve como máximo 1000 filas por pedido: se piden por páginas.
const fetchAll = async (buildQuery) => {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) fail(error);
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
};

const emptyMonth = () => ({ sales: [], expenses: [], salary_advances: [], barber_payments: [] });

const upsertInList = (list, row) => {
  const index = list.findIndex(item => item.id === row.id);
  if (index === -1) return [...list, row];
  const copy = list.slice();
  copy[index] = row;
  return copy;
};

const applyMovement = (table, row, oldId) => {
  const id = row?.id || oldId;
  for (const bucket of state.months.values()) {
    if (bucket[table].some(item => item.id === id)) bucket[table] = bucket[table].filter(item => item.id !== id);
  }
  if (!row) return;
  const bucket = state.months.get(monthOf(row.movement_date));
  if (bucket) bucket[table] = upsertInList(bucket[table], row);
};

const sortByName = (rows) => rows.slice().sort((first, second) => (
  (first.sort_order ?? 0) - (second.sort_order ?? 0) || first.name.localeCompare(second.name)
));

const loadCatalogs = async () => {
  const client = requireClient();
  const [barbers, services, profiles, closings] = await Promise.all([
    fetchAll(() => client.from('barbers').select('*').order('sort_order')),
    fetchAll(() => client.from('services').select('*').order('sort_order')),
    fetchAll(() => client.from('profiles').select('user_id, username, display_name, role, barber_id, active')),
    fetchAll(() => client.from('month_closings').select('month, closed_at, closed_by'))
  ]);
  state.barbers = sortByName(barbers);
  state.services = sortByName(services);
  state.profiles = profiles;
  state.closedMonths = new Set(closings.map(closing => monthOf(closing.month)));
};

const loadCustomers = async () => {
  const client = requireClient();
  state.customers = await fetchAll(() => client.from('customer_stats').select('*').order('name'));
};

const scheduleCustomersReload = () => {
  clearTimeout(customersTimer);
  customersTimer = setTimeout(() => {
    loadCustomers().then(() => notifyDataChange('customers')).catch(error => setError(error));
  }, 400);
};

const fetchMonth = async (month) => {
  const client = requireClient();
  const from = monthStart(month);
  const to = monthEnd(month);
  const results = await Promise.all(MOVEMENT_TABLES.map(table => fetchAll(() => client
    .from(table)
    .select('*')
    .gte('movement_date', from)
    .lte('movement_date', to)
    .order('created_at', { ascending: false }))));
  const bucket = emptyMonth();
  MOVEMENT_TABLES.forEach((table, index) => { bucket[table] = results[index]; });
  state.months.set(month, bucket);
};

const reloadEverything = async () => {
  await Promise.all([loadCatalogs(), loadCustomers(), ...[...state.months.keys()].map(fetchMonth)]);
  notifyDataChange('all');
};

const setError = (error) => {
  state.error = error ? translateError(error) : '';
  notify();
};

const handleRealtime = (payload) => {
  const { table, eventType } = payload;
  const row = eventType === 'DELETE' ? null : payload.new;
  const oldId = payload.old?.id;

  if (MOVEMENT_TABLES.includes(table)) {
    applyMovement(table, row, oldId);
    if (table === 'sales') scheduleCustomersReload();
  } else if (table === 'barbers' || table === 'services') {
    const list = eventType === 'DELETE'
      ? state[table].filter(item => item.id !== oldId)
      : upsertInList(state[table], row);
    state[table] = sortByName(list);
  } else if (table === 'customers') {
    scheduleCustomersReload();
  } else if (table === 'month_closings') {
    if (row) state.closedMonths.add(monthOf(row.month));
    else if (payload.old?.month) state.closedMonths.delete(monthOf(payload.old.month));
  }
  notifyDataChange(table);
};

const startRealtime = () => {
  const client = requireClient();
  if (channel) return;
  hasSubscribedOnce = false;
  channel = client.channel('barberia-cambios');
  ['sales', 'expenses', 'salary_advances', 'barber_payments', 'customers', 'barbers', 'services',
    'fixed_expenses', 'reconciliations', 'month_closings'].forEach(table => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, handleRealtime);
  });
  channel.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      state.connection = 'online';
      // Al reconectar se vuelve a leer todo, por si hubo cambios mientras no había señal.
      if (hasSubscribedOnce) reloadEverything().catch(setError);
      hasSubscribedOnce = true;
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      state.connection = 'offline';
    }
    notify();
  });
};

const stopRealtime = async () => {
  if (channel && supabase) await supabase.removeChannel(channel);
  channel = null;
};

const handleVisibility = () => {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible' && state.profile) {
    reloadEverything().catch(setError);
  }
};

const insertRow = async (table, values) => {
  const row = { id: crypto.randomUUID(), ...values };
  const { data, error } = await requireClient().from(table).insert(row).select().single();
  if (error) fail(error);
  if (MOVEMENT_TABLES.includes(table)) applyMovement(table, data);
  notifyDataChange(table);
  return data;
};

const updateRow = async (table, id, values) => {
  const { data, error } = await requireClient().from(table).update(values).eq('id', id).select().single();
  if (error) fail(error);
  if (MOVEMENT_TABLES.includes(table)) applyMovement(table, data);
  notifyDataChange(table);
  return data;
};

const refreshCatalog = async () => {
  await loadCatalogs();
  notifyDataChange('catalog');
};

export const usernameToEmail = (username) => {
  const clean = username.trim().toLowerCase();
  return clean.includes('@') ? clean : loginEmailTemplate.replace('{usuario}', clean);
};

export const authService = {
  isConfigured: () => Boolean(supabase),

  getSession: async () => {
    if (!supabase) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) fail(error);
    return data.session;
  },

  signIn: async (username, password) => {
    const { error } = await requireClient().auth.signInWithPassword({
      email: usernameToEmail(username),
      password
    });
    if (error) fail(error);
  },

  signOut: async () => {
    await store.stop();
    if (supabase) await supabase.auth.signOut();
  },

  updatePassword: async (password) => {
    const { error } = await requireClient().auth.updateUser({ password });
    if (error) fail(error);
  }
};

export const store = {
  subscribe: (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  getVersion: () => version,
  onDataChange: (listener) => {
    changeListeners.add(listener);
    return () => changeListeners.delete(listener);
  },

  start: async () => {
    state = createEmptyState();
    state.profile = await rpc('bf_whoami');
    await Promise.all([loadCatalogs(), loadCustomers(), fetchMonth(currentMonth())]);
    startRealtime();
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', handleVisibility);
    notify();
    return state.profile;
  },

  stop: async () => {
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', handleVisibility);
    clearTimeout(customersTimer);
    await stopRealtime();
    state = createEmptyState();
    notify();
  },

  // --- Lectura ---
  get profile() { return state.profile; },
  get isAdmin() { return state.profile?.role === 'admin'; },
  get canSeeSociety() { return Boolean(state.profile?.can_see_society); },
  get connection() { return state.connection; },
  get error() { return state.error; },
  clearError: () => setError(null),
  reportError: (error) => setError(error),

  barbers: ({ includeInactive = false } = {}) => state.barbers.filter(barber => includeInactive || barber.active),
  partners: () => state.barbers.filter(barber => barber.is_partner),
  services: ({ includeInactive = false } = {}) => state.services.filter(service => includeInactive || service.active),
  customers: () => state.customers,
  barberName: (id) => state.barbers.find(barber => barber.id === id)?.name || 'Barbero',
  userName: (userId) => state.profiles.find(profile => profile.user_id === userId)?.display_name || 'Sistema',
  isMonthClosed: (month) => state.closedMonths.has(month),
  isMonthLoaded: (month) => state.months.has(month),

  ensureMonth: async (month) => {
    if (state.months.has(month)) return;
    await fetchMonth(month);
    notify();
  },

  day: (isoDate) => {
    const bucket = state.months.get(monthOf(isoDate)) || emptyMonth();
    const onDay = (rows) => rows.filter(row => row.movement_date === isoDate);
    return {
      sales: onDay(bucket.sales),
      expenses: onDay(bucket.expenses),
      advances: onDay(bucket.salary_advances),
      payments: onDay(bucket.barber_payments)
    };
  },

  monthPayments: (month) => (state.months.get(month)?.barber_payments || [])
    .slice()
    .sort((first, second) => second.created_at.localeCompare(first.created_at)),

  monthSalesForCustomer: (customerId, month) => {
    const bucket = state.months.get(month);
    if (!bucket) return 0;
    return bucket.sales.filter(sale => sale.customer_id === customerId && !sale.voided).length;
  },

  // --- Ventas ---
  addSale: async ({ clientName, clientPhone, birthdate, ...sale }) => {
    const customerId = await rpc('bf_upsert_customer', {
      p_name: clientName,
      p_phone: clientPhone,
      p_birthdate: birthdate || ''
    });
    const row = await insertRow('sales', {
      ...sale,
      customer_id: customerId,
      client_name: clientName?.trim() || 'Cliente Ocasional',
      client_phone: clientPhone?.trim() || ''
    });
    scheduleCustomersReload();
    return row;
  },
  updateSale: async (id, { clientName, clientPhone, ...values }, reason) => {
    const changes = { ...values, edit_reason: reason };
    if (clientName !== undefined || clientPhone !== undefined) {
      changes.customer_id = await rpc('bf_upsert_customer', {
        p_name: clientName || '',
        p_phone: clientPhone || '',
        p_birthdate: ''
      });
      changes.client_name = clientName?.trim() || 'Cliente Ocasional';
      changes.client_phone = clientPhone?.trim() || '';
    }
    const row = await updateRow('sales', id, changes);
    scheduleCustomersReload();
    return row;
  },
  voidSale: (id, reason) => updateRow('sales', id, { voided: true, void_reason: reason }),

  // --- Gastos y adelantos ---
  addExpense: (expense) => insertRow('expenses', expense),
  updateExpense: (id, values, reason) => updateRow('expenses', id, { ...values, edit_reason: reason }),
  voidExpense: (id, reason) => updateRow('expenses', id, { voided: true, void_reason: reason }),

  addAdvance: (advance) => insertRow('salary_advances', advance),
  updateAdvance: (id, values, reason) => updateRow('salary_advances', id, { ...values, edit_reason: reason }),
  voidAdvance: (id, reason) => updateRow('salary_advances', id, { voided: true, void_reason: reason }),

  // --- Pagos de sueldo (admin) ---
  addPayment: (payment) => insertRow('barber_payments', payment),
  voidPayment: (id, reason) => updateRow('barber_payments', id, { voided: true, void_reason: reason }),

  // --- Resumen del mes ---
  monthReport: (month) => rpc('bf_month_report', { p_month: monthStart(month) }),
  closeMonth: (month) => rpc('bf_close_month', { p_month: monthStart(month) }),
  addReconciliation: ({ kind, date, actual, note }) => rpc('bf_add_reconciliation', {
    p_kind: kind, p_date: date, p_actual: actual, p_note: note || ''
  }),
  expectedBalance: (kind, date) => rpc('bf_expected_balance', { p_kind: kind, p_as_of: date }),

  addFixedExpense: async (values) => {
    const { error } = await requireClient().from('fixed_expenses').insert(values);
    if (error) fail(error);
    notifyDataChange('fixed_expenses');
  },
  updateFixedExpense: async (id, values, reason) => {
    const { error } = await requireClient().from('fixed_expenses').update({ ...values, edit_reason: reason }).eq('id', id);
    if (error) fail(error);
    notifyDataChange('fixed_expenses');
  },
  deleteFixedExpense: async (id) => {
    const { error } = await requireClient().from('fixed_expenses').delete().eq('id', id);
    if (error) fail(error);
    notifyDataChange('fixed_expenses');
  },
  copyFixedExpenses: async (month) => {
    const count = await rpc('bf_copy_fixed_expenses', { p_month: monthStart(month) });
    notifyDataChange('fixed_expenses');
    return count;
  },

  // --- Clientes ---
  updateCustomer: async (id, values) => {
    const { error } = await requireClient().from('customers').update(values).eq('id', id);
    if (error) fail(error);
    await loadCustomers();
    notifyDataChange('customers');
  },
  customerHistory: async (customerId) => {
    const client = requireClient();
    return fetchAll(() => client
      .from('sales')
      .select('id, movement_date, barber_id, service_name, amount, tip, payment_method, voided')
      .eq('customer_id', customerId)
      .order('movement_date', { ascending: false }));
  },

  // --- Configuración (admin) ---
  updateBarber: async (id, values) => {
    const { error } = await requireClient().from('barbers').update(values).eq('id', id);
    if (error) fail(error);
    await refreshCatalog();
  },
  addService: async (values) => {
    const { error } = await requireClient().from('services').insert(values);
    if (error) fail(error);
    await refreshCatalog();
  },
  updateService: async (id, values) => {
    const { error } = await requireClient().from('services').update(values).eq('id', id);
    if (error) fail(error);
    await refreshCatalog();
  },

  auditLog: async (limit = 200) => {
    const { data, error } = await requireClient()
      .from('audit_log')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(limit);
    if (error) fail(error);
    return data;
  },

  // Copia completa en JSON, descargable desde Configuración.
  exportBackup: async () => {
    const client = requireClient();
    const tables = ['barbers', 'profiles', 'services', 'customers', 'sales', 'expenses', 'salary_advances',
      'barber_payments', 'fixed_expenses', 'reconciliations', 'month_closings', 'audit_log'];
    const orderColumns = { month_closings: 'month', profiles: 'user_id' };
    const data = {};
    for (const table of tables) {
      data[table] = await fetchAll(() => client.from(table).select('*').order(orderColumns[table] || 'id'));
    }
    return JSON.stringify({ createdAt: new Date().toISOString(), source: 'app', tables: data }, null, 2);
  }
};
