// Storage & Financial Logic Engine for BarberFlow Pro
import { createClient } from '@supabase/supabase-js';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};
const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const CLOUD_KEYS = {
  TRANSACTIONS: 'transactions',
  EXPENSES: 'expenses',
  CUSTOMERS: 'customers',
  BARBERS: 'barbers',
  SERVICES: 'services',
  FIXED_EXPENSES: 'fixed_expenses',
  BANK_EXPENSES_OVERRIDE: 'bank_expenses_override',
  COMMISSION_MIGRATION: 'commission_migration_50_v1'
};

const PENDING_SYNC_KEY = 'barberflow_pending_sync_v1';
const SYNC_STATUS_EVENT = 'barberflow:sync-status';

const STORAGE_KEYS = {
  TRANSACTIONS: 'barberflow_transactions_v1',
  EXPENSES: 'barberflow_expenses_v1',
  CUSTOMERS: 'barberflow_customers_v1',
  BARBERS: 'barberflow_barbers_v1',
  SERVICES: 'barberflow_services_v1',
  USER_ROLE: 'barberflow_user_role_v1',
  FIXED_EXPENSES: 'barberflow_fixed_expenses_v1',
  BANK_EXPENSES_OVERRIDE: 'barberflow_bank_expenses_override_v1'
};

const OPERATIONAL_DATA_RESET_KEY = 'barberflow_operational_data_reset_v2';
const SAFE_BACKUP_KEY = 'barberflow_safe_backup_v1';
const COMMISSION_MIGRATION_LOCAL_KEY = 'barberflow_commission_migration_50_v1';
const DEFAULT_COMMISSION_RATE = 0.5;
let currentUserRole = null;
let currentUserId = null;

const DEFAULT_BARBERS = [
  { id: 'ema', name: 'Ema', commissionRate: DEFAULT_COMMISSION_RATE, phone: '', active: true },
  { id: 'diego', name: 'Diego', commissionRate: DEFAULT_COMMISSION_RATE, phone: '', active: true },
  { id: 'barbero_invitado', name: 'Barbero 3', commissionRate: DEFAULT_COMMISSION_RATE, phone: '', active: true }
];

const DEFAULT_SERVICES = [
  { id: 'corte', name: 'Corte de Pelo', type: 'servicio', price: 6000 },
  { id: 'barba', name: 'Arreglo de Barba', type: 'servicio', price: 4000 },
  { id: 'combo', name: 'Combo Corte + Barba', type: 'servicio', price: 8500 },
  { id: 'color', name: 'Color / Tintura', type: 'servicio', price: 12000 },
  { id: 'niño', name: 'Corte Niños', type: 'servicio', price: 5000 },
  { id: 'cera', name: 'Cera para Peinar (Producto)', type: 'producto', price: 4500 },
  { id: 'aceite_barba', name: 'Aceite de Barba (Producto)', type: 'producto', price: 3800 },
  { id: 'pomada', name: 'Pomada Mate (Producto)', type: 'producto', price: 5000 }
];

const DEFAULT_FIXED_EXPENSES = {};

const getCustomerId = (key) => {
  const hash = Array.from(key).reduce((value, character) => (
    ((value << 5) - value + character.charCodeAt(0)) | 0
  ), 0);
  return `cust-${Math.abs(hash)}`;
};

const readLocal = (key, fallback) => {
  const value = localStorage.getItem(key);
  return value ? JSON.parse(value) : fallback;
};

const writeLocal = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
};

const getSupabaseData = async (functionName, params = {}) => {
  if (!supabase) throw new Error('Supabase no está configurado. Revisá VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
  const { data, error } = await supabase.rpc(functionName, params);
  if (error) throw error;
  return data;
};

const writeCloudValue = async (key, value) => {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { error } = await supabase.rpc('admin_save_app_data', {
    p_key: key,
    p_value: value
  });
  if (error) throw error;
};

const appendEmployeeEntry = async (collection, entry) => {
  if (!supabase) throw new Error('Supabase no está configurado.');
  const { error } = await supabase.rpc('staff_append_entry', {
    p_collection: collection,
    p_entry: entry
  });
  if (error) throw error;
};

const emitSyncStatus = (status, error = '') => {
  if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_STATUS_EVENT, { detail: { status, error } }));
  }
};

let syncPromise;
const syncPendingValues = async () => {
  if (!supabase) return;
  if (syncPromise) return syncPromise;

  emitSyncStatus('syncing');
  syncPromise = (async () => {
    while (true) {
      const pending = readLocal(PENDING_SYNC_KEY, []);
      if (!Array.isArray(pending)) {
        throw new Error('La cola de cambios pendientes está dañada. No se borró; exportá los datos locales antes de continuar.');
      }
      const operation = pending.find(item => item.userId === currentUserId);
      if (!operation) break;
      if (operation.role === 'employee') {
        await appendEmployeeEntry(operation.key, operation.value);
      } else {
        await writeCloudValue(operation.key, operation.value);
      }
      const latest = readLocal(PENDING_SYNC_KEY, []);
      writeLocal(PENDING_SYNC_KEY, latest.filter(item => item.id !== operation.id));
    }
    emitSyncStatus('synced');
  })().catch((error) => {
    console.error('No se pudieron guardar los cambios en Supabase:', error);
    emitSyncStatus('error', error.message);
    throw error;
  }).finally(() => {
    syncPromise = undefined;
  });

  return syncPromise;
};

const saveSharedValue = (localKey, cloudKey, value, createBackup = true) => {
  if (createBackup) persistSafeBackup();
  const previous = readLocal(localKey, Array.isArray(value) ? [] : {});
  writeLocal(localKey, value);
  if (!supabase) return;
  if (!currentUserRole || !currentUserId) {
    writeLocal(localKey, previous);
    emitSyncStatus('error', 'Iniciá sesión para guardar los cambios.');
    return;
  }
  let operation;
  if (currentUserRole === 'employee') {
    if (cloudKey !== CLOUD_KEYS.TRANSACTIONS && cloudKey !== CLOUD_KEYS.EXPENSES) {
      writeLocal(localKey, previous);
      emitSyncStatus('error', 'Tu cuenta no tiene permiso para modificar esta información.');
      return;
    }
    const previousIds = new Set((Array.isArray(previous) ? previous : []).map(item => item.id));
    const addedEntries = (Array.isArray(value) ? value : []).filter(item => !previousIds.has(item.id));
    if (addedEntries.length !== 1 || (Array.isArray(previous) && value.length !== previous.length + 1)) {
      writeLocal(localKey, previous);
      emitSyncStatus('error', 'Tu cuenta solo puede agregar operaciones nuevas.');
      return;
    }
    operation = { id: crypto.randomUUID(), userId: currentUserId, role: 'employee', key: cloudKey, value: addedEntries[0] };
  } else {
    if (currentUserRole !== 'admin') {
      writeLocal(localKey, previous);
      emitSyncStatus('error', 'Tu cuenta no tiene permiso para modificar esta información.');
      return;
    }
    operation = { id: crypto.randomUUID(), userId: currentUserId, role: 'admin', key: cloudKey, value };
  }
  const storedPending = readLocal(PENDING_SYNC_KEY, []);
  const pending = Array.isArray(storedPending) ? storedPending : [];
  pending.push(operation);
  writeLocal(PENDING_SYNC_KEY, pending);
  void syncPendingValues().catch(() => {});
};

const hasMeaningfulData = (value) => {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return Boolean(value);
};

const createSafeBackup = () => ({
  transactions: readLocal(STORAGE_KEYS.TRANSACTIONS, []),
  expenses: readLocal(STORAGE_KEYS.EXPENSES, []),
  customers: readLocal(STORAGE_KEYS.CUSTOMERS, []),
  barbers: readLocal(STORAGE_KEYS.BARBERS, DEFAULT_BARBERS),
  services: readLocal(STORAGE_KEYS.SERVICES, DEFAULT_SERVICES),
  fixedExpenses: readLocal(STORAGE_KEYS.FIXED_EXPENSES, DEFAULT_FIXED_EXPENSES),
  bankExpensesOverride: readLocal(STORAGE_KEYS.BANK_EXPENSES_OVERRIDE, {}),
  exportDate: new Date().toISOString()
});

const persistSafeBackup = () => {
  const snapshot = createSafeBackup();
  const hasOperationalData = [
    snapshot.transactions,
    snapshot.expenses,
    snapshot.customers,
    snapshot.fixedExpenses,
    snapshot.bankExpensesOverride
  ].some(hasMeaningfulData);
  const hasCustomSettings = JSON.stringify(snapshot.barbers) !== JSON.stringify(DEFAULT_BARBERS)
    || JSON.stringify(snapshot.services) !== JSON.stringify(DEFAULT_SERVICES);

  if (hasOperationalData || hasCustomSettings) {
    localStorage.setItem(SAFE_BACKUP_KEY, JSON.stringify(snapshot));
    return snapshot;
  }

  return null;
};

export const authService = {
  isConfigured: () => Boolean(supabase),

  getSession: async () => {
    if (!supabase) return null;
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!sessionData.session) return null;
    const role = await authService.getRole();
    return { user: sessionData.session.user, role };
  },

  signIn: async (email, password) => {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    try {
      const role = await authService.getRole();
      return { user: data.user, role };
    } catch (roleError) {
      await supabase.auth.signOut();
      throw roleError;
    }
  },

  getRole: async () => {
    const role = await getSupabaseData('get_my_role');
    if (role !== 'admin' && role !== 'employee') {
      throw new Error('Esta cuenta todavía no tiene un rol asignado. Pedile al administrador que la habilite.');
    }
    currentUserRole = role;
    const { data } = await supabase.auth.getUser();
    currentUserId = data.user?.id || null;
    return role;
  },

  updatePassword: async (password) => {
    if (!supabase) throw new Error('Supabase no está configurado.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  },

  signOut: async () => {
    try {
      if (supabase) {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
    } finally {
      currentUserRole = null;
      currentUserId = null;
      storageService.clearSensitiveLocalData();
    }
  }
};

export const storageService = {
  onSyncStatus: (callback) => {
    if (typeof window === 'undefined') return () => {};
    const listener = (event) => callback(event.detail);
    window.addEventListener(SYNC_STATUS_EVENT, listener);
    return () => window.removeEventListener(SYNC_STATUS_EVENT, listener);
  },

  syncPendingChanges: () => syncPendingValues(),
  getAppDataHistory: async () => {
    if (currentUserRole !== 'admin') throw new Error('Solo una administradora puede ver el historial.');
    return getSupabaseData('admin_get_app_data_history');
  },
  restoreAppDataHistory: async (historyId) => {
    if (currentUserRole !== 'admin') throw new Error('Solo una administradora puede restaurar versiones.');
    await syncPendingValues();
    await getSupabaseData('admin_restore_app_data_history', { p_history_id: historyId });
    await storageService.initializeSharedData();
  },
  setAuthenticatedUser: (role, userId) => {
    currentUserRole = role;
    currentUserId = userId;
    if (role === 'employee') storageService.clearSensitiveLocalData();
  },

  clearSensitiveLocalData: () => {
    [
      STORAGE_KEYS.TRANSACTIONS,
      STORAGE_KEYS.EXPENSES,
      STORAGE_KEYS.CUSTOMERS,
      STORAGE_KEYS.BARBERS,
      STORAGE_KEYS.SERVICES,
      STORAGE_KEYS.FIXED_EXPENSES,
      STORAGE_KEYS.BANK_EXPENSES_OVERRIDE,
      STORAGE_KEYS.USER_ROLE,
      SAFE_BACKUP_KEY
    ].forEach(key => localStorage.removeItem(key));
  },

  initializeSharedData: async () => {
    const sharedCollections = [
      [STORAGE_KEYS.TRANSACTIONS, CLOUD_KEYS.TRANSACTIONS, []],
      [STORAGE_KEYS.EXPENSES, CLOUD_KEYS.EXPENSES, []],
      [STORAGE_KEYS.CUSTOMERS, CLOUD_KEYS.CUSTOMERS, []],
      [STORAGE_KEYS.BARBERS, CLOUD_KEYS.BARBERS, DEFAULT_BARBERS],
      [STORAGE_KEYS.SERVICES, CLOUD_KEYS.SERVICES, DEFAULT_SERVICES],
      [STORAGE_KEYS.FIXED_EXPENSES, CLOUD_KEYS.FIXED_EXPENSES, DEFAULT_FIXED_EXPENSES],
      [STORAGE_KEYS.BANK_EXPENSES_OVERRIDE, CLOUD_KEYS.BANK_EXPENSES_OVERRIDE, {}]
    ];

    if (!supabase) {
      const hadLocalOperationalData = [
        STORAGE_KEYS.TRANSACTIONS,
        STORAGE_KEYS.EXPENSES,
        STORAGE_KEYS.CUSTOMERS,
        STORAGE_KEYS.FIXED_EXPENSES,
        STORAGE_KEYS.BANK_EXPENSES_OVERRIDE
      ].some((key) => hasMeaningfulData(readLocal(key, null)));
      if (hadLocalOperationalData) persistSafeBackup();

      for (const [localKey, , fallbackValue] of sharedCollections) {
        if (localStorage.getItem(localKey) === null) writeLocal(localKey, fallbackValue);
      }
      if (localStorage.getItem(COMMISSION_MIGRATION_LOCAL_KEY) !== '1') {
        const updatedBarbers = storageService.getBarbers().map(barber => ({
          ...barber,
          commissionRate: DEFAULT_COMMISSION_RATE
        }));
        writeLocal(STORAGE_KEYS.BARBERS, updatedBarbers);
        localStorage.setItem(COMMISSION_MIGRATION_LOCAL_KEY, '1');
      }
      return;
    }

    if (!currentUserRole || !currentUserId) {
      throw new Error('No hay una sesión autorizada para cargar los datos.');
    }
    const remoteValues = await getSupabaseData(
      currentUserRole === 'admin' ? 'admin_get_app_data' : 'staff_get_app_data'
    );
    const storedPending = readLocal(PENDING_SYNC_KEY, []);
    const pending = Array.isArray(storedPending) ? storedPending : [];
    if (currentUserRole === 'employee') {
      for (const [localKey, cloudKey, defaultValue] of sharedCollections) {
        const remoteValue = remoteValues?.[cloudKey];
        writeLocal(localKey, remoteValue ?? defaultValue);
      }
      return;
    }

    for (const [localKey, cloudKey, defaultValue] of sharedCollections) {
      const localValue = readLocal(localKey, defaultValue);
      const hasRemoteValue = Object.prototype.hasOwnProperty.call(remoteValues, cloudKey)
        && remoteValues[cloudKey] !== null;
      const remoteValue = remoteValues[cloudKey];
      let value = hasRemoteValue ? remoteValue : localValue;

      const pendingValue = pending
        .filter(item => item.userId === currentUserId && item.key === cloudKey)
        .at(-1);
      if (pendingValue) {
        value = pendingValue.value;
      } else if (hasRemoteValue && hasMeaningfulData(localValue) && !hasMeaningfulData(remoteValue)) {
        persistSafeBackup();
        value = localValue;
        pending.push({ id: crypto.randomUUID(), userId: currentUserId, role: 'admin', key: cloudKey, value });
      } else if (!hasRemoteValue) {
        pending.push({ id: crypto.randomUUID(), userId: currentUserId, role: 'admin', key: cloudKey, value });
      }

      writeLocal(localKey, value);
    }
    writeLocal(PENDING_SYNC_KEY, pending);
    const commissionMigration = remoteValues?.[CLOUD_KEYS.COMMISSION_MIGRATION];
    if (commissionMigration !== 'complete') {
      const updatedBarbers = storageService.getBarbers().map(barber => ({
        ...barber,
        commissionRate: DEFAULT_COMMISSION_RATE
      }));
      writeLocal(STORAGE_KEYS.BARBERS, updatedBarbers);
      pending.push({ id: crypto.randomUUID(), userId: currentUserId, role: 'admin', key: CLOUD_KEYS.BARBERS, value: updatedBarbers });
      pending.push({ id: crypto.randomUUID(), userId: currentUserId, role: 'admin', key: CLOUD_KEYS.COMMISSION_MIGRATION, value: 'complete' });
      writeLocal(PENDING_SYNC_KEY, pending);
    }

    await syncPendingValues();
  },

  // --- SESSION ROLE ---
  getUserRole: () => {
    return currentUserRole;
  },

  // --- BANK EXPENSES OVERRIDE ---
  getBankExpensesOverride: (yearMonthStr) => {
    const data = localStorage.getItem(STORAGE_KEYS.BANK_EXPENSES_OVERRIDE);
    const obj = data ? JSON.parse(data) : {};
    return obj[yearMonthStr] !== undefined ? Number(obj[yearMonthStr]) : null;
  },

  setBankExpensesOverride: (yearMonthStr, amount) => {
    const obj = readLocal(STORAGE_KEYS.BANK_EXPENSES_OVERRIDE, {});
    obj[yearMonthStr] = Number(amount) || 0;
    saveSharedValue(STORAGE_KEYS.BANK_EXPENSES_OVERRIDE, CLOUD_KEYS.BANK_EXPENSES_OVERRIDE, obj);
    return obj[yearMonthStr];
  },

  // --- FIXED MONTHLY EXPENSES ---
  getFixedExpenses: () => {
    const data = localStorage.getItem(STORAGE_KEYS.FIXED_EXPENSES);
    return data ? JSON.parse(data) : DEFAULT_FIXED_EXPENSES;
  },

  saveFixedExpenses: (fixedObj) => {
    saveSharedValue(STORAGE_KEYS.FIXED_EXPENSES, CLOUD_KEYS.FIXED_EXPENSES, fixedObj);
  },

  updateFixedExpense: (key, amount) => {
    const current = storageService.getFixedExpenses();
    const updated = {
      ...current,
      [key]: Number(amount) || 0
    };
    storageService.saveFixedExpenses(updated);
    return updated;
  },

  addFixedExpense: (name, amount) => {
    const key = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_')}_${Date.now()}`;
    return storageService.updateFixedExpense(key, amount);
  },

  deleteFixedExpense: (key) => {
    const current = storageService.getFixedExpenses();
    const updated = { ...current };
    delete updated[key];
    storageService.saveFixedExpenses(updated);
    return updated;
  },

  // --- BARBERS MANAGEMENT ---
  getBarbers: () => {
    const data = localStorage.getItem(STORAGE_KEYS.BARBERS);
    return data ? JSON.parse(data) : DEFAULT_BARBERS;
  },

  saveBarbers: (barbers) => {
    saveSharedValue(STORAGE_KEYS.BARBERS, CLOUD_KEYS.BARBERS, barbers);
  },

  updateBarberCommission: (id, commissionPercent) => {
    const barbers = storageService.getBarbers().map(barber => (
      barber.id === id
        ? { ...barber, commissionRate: Number(commissionPercent) / 100 }
        : barber
    ));
    storageService.saveBarbers(barbers);
    return barbers;
  },

  addBarber: ({ name, commissionRate }) => {
    const barbers = storageService.getBarbers();
    const commission = Number(commissionRate);
    const newBarber = {
      id: 'barber_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: name.trim(),
      commissionRate: Number.isFinite(commission) && commission >= 0 && commission <= 100
        ? commission / 100
        : DEFAULT_COMMISSION_RATE,
      phone: '',
      active: true
    };
    barbers.push(newBarber);
    storageService.saveBarbers(barbers);
    return barbers;
  },

  deleteBarber: (id) => {
    const barbers = storageService.getBarbers().filter(b => b.id !== id);
    storageService.saveBarbers(barbers);
    return barbers;
  },

  // --- CATALOG (SERVICES & PRODUCTS) ---
  getServices: () => {
    const data = localStorage.getItem(STORAGE_KEYS.SERVICES);
    return data ? JSON.parse(data) : DEFAULT_SERVICES;
  },

  saveServices: (services) => {
    saveSharedValue(STORAGE_KEYS.SERVICES, CLOUD_KEYS.SERVICES, services);
  },

  addCatalogItem: ({ name, type, price }) => {
    const catalog = storageService.getServices();
    const newItem = {
      id: 'cat_' + Date.now(),
      name: name.trim(),
      type: type || 'servicio',
      price: Number(price) || 0
    };
    catalog.push(newItem);
    storageService.saveServices(catalog);
    return catalog;
  },

  updateServicePrice: (serviceId, newPrice) => {
    const services = storageService.getServices();
    const updated = services.map(s => s.id === serviceId ? { ...s, price: Number(newPrice) || s.price } : s);
    storageService.saveServices(updated);
    return updated;
  },

  deleteCatalogItem: (id) => {
    const catalog = storageService.getServices().filter(s => s.id !== id);
    storageService.saveServices(catalog);
    return catalog;
  },

  // --- TRANSACTIONS (DAILY CASH) WITH AUDIT TRAIL ---
  getTransactions: () => {
    return readLocal(STORAGE_KEYS.TRANSACTIONS, []);
  },

  addTransaction: (tx) => {
    const transactions = storageService.getTransactions();
    const newTx = {
      ...tx,
      id: 'tx-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      amount: Number(tx.amount) || 0,
      tip: Number(tx.tip) || 0,
      birthdate: tx.birthdate || '',
      edited: false,
      editHistory: []
    };
    transactions.unshift(newTx);
    saveSharedValue(STORAGE_KEYS.TRANSACTIONS, CLOUD_KEYS.TRANSACTIONS, transactions);
    storageService.syncCustomersFromTransactions(transactions);
    return newTx;
  },

  // Update transaction with Audit Trail (who edited & reason)
  updateTransaction: (txId, updatedFields, { editedBy, editReason }) => {
    const transactions = storageService.getTransactions();
    const updated = transactions.map(t => {
      if (t.id === txId) {
        const history = t.editHistory || [];
        const auditEntry = {
          editedBy: editedBy || 'Usuario',
          editReason: editReason || 'Modificación de monto/servicio',
          editedAt: new Date().toLocaleString('es-AR'),
          oldAmount: t.amount,
          newAmount: Number(updatedFields.amount) || t.amount,
          oldTip: t.tip,
          newTip: Number(updatedFields.tip) || t.tip
          ,oldPaymentMethod: t.paymentMethod || '',
          newPaymentMethod: updatedFields.paymentMethod || t.paymentMethod || '',
          oldService: t.service || '',
          newService: updatedFields.service || t.service || '',
          oldBarberId: t.barberId || '',
          newBarberId: updatedFields.barberId || t.barberId || ''
        };

        return {
          ...t,
          ...updatedFields,
          amount: Number(updatedFields.amount) || 0,
          tip: Number(updatedFields.tip) || 0,
          edited: true,
          editHistory: [auditEntry, ...history]
        };
      }
      return t;
    });

    saveSharedValue(STORAGE_KEYS.TRANSACTIONS, CLOUD_KEYS.TRANSACTIONS, updated);
    storageService.syncCustomersFromTransactions(updated);
    return updated;
  },

  getTransactionAuditLog: () => storageService.getTransactions()
    .flatMap(transaction => (transaction.editHistory || []).map(entry => ({
      ...entry,
      transactionId: transaction.id,
      transactionDate: transaction.date,
      clientName: transaction.clientName || 'Cliente Ocasional',
      clientPhone: transaction.clientPhone || '',
      currentService: transaction.service || '',
      currentPaymentMethod: transaction.paymentMethod || ''
    })))
    .sort((first, second) => new Date(second.editedAt) - new Date(first.editedAt)),

  deleteTransaction: (id) => {
    const transactions = storageService.getTransactions().filter(t => t.id !== id);
    saveSharedValue(STORAGE_KEYS.TRANSACTIONS, CLOUD_KEYS.TRANSACTIONS, transactions);
    storageService.syncCustomersFromTransactions(transactions);
  },

  // --- EXPENSES (EGRESOS) ---
  getExpenses: () => {
    return readLocal(STORAGE_KEYS.EXPENSES, []);
  },

  addExpense: (expense) => {
    const expenses = storageService.getExpenses();
    const newEx = {
      ...expense,
      id: 'ex-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      amount: Number(expense.amount) || 0
    };
    expenses.unshift(newEx);
    saveSharedValue(STORAGE_KEYS.EXPENSES, CLOUD_KEYS.EXPENSES, expenses);
    return newEx;
  },

  deleteExpense: (id) => {
    const expenses = storageService.getExpenses().filter(e => e.id !== id);
    saveSharedValue(STORAGE_KEYS.EXPENSES, CLOUD_KEYS.EXPENSES, expenses);
  },

  // --- CUSTOMERS ---
  getCustomers: () => {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (data) return JSON.parse(data);
    return storageService.syncCustomersFromTransactions(storageService.getTransactions());
  },

  updateCustomerBirthdate: (customerId, birthdate) => {
    if (currentUserRole !== 'admin') return storageService.getCustomers();
    const customers = storageService.getCustomers();
    const updated = customers.map(c => c.id === customerId ? { ...c, birthdate } : c);
    saveSharedValue(STORAGE_KEYS.CUSTOMERS, CLOUD_KEYS.CUSTOMERS, updated);
    return updated;
  },

  getCustomersShared: async () => {
    if (supabase && currentUserRole === 'employee') {
      const data = await getSupabaseData('staff_get_app_data');
      const customers = data?.customers || [];
      writeLocal(STORAGE_KEYS.CUSTOMERS, customers);
      return customers;
    }
    return storageService.getCustomers();
  },

  syncCustomersToCloud: async (customers) => {
    if (!customers || currentUserRole !== 'admin') return;
    saveSharedValue(STORAGE_KEYS.CUSTOMERS, CLOUD_KEYS.CUSTOMERS, customers);
    await syncPendingValues();
  },

  syncCustomersFromTransactions: (transactions) => {
    if (currentUserRole === 'employee') return storageService.getCustomers();
    const customerMap = {};
    const currentMonthPrefix = new Date().toISOString().substring(0, 7);

    transactions.forEach(tx => {
      if (!tx.clientPhone && !tx.clientName) return;
      const key = (tx.clientPhone || tx.clientName).trim().toLowerCase();

      if (!customerMap[key]) {
        customerMap[key] = {
          id: getCustomerId(key),
          name: tx.clientName || 'Cliente Ocasional',
          phone: tx.clientPhone || '',
          birthdate: tx.birthdate || '',
          totalSpent: 0,
          visitCount: 0,
          monthlyVisitsCount: 0,
          lastVisit: tx.date,
          servicesHistory: []
        };
      }

      customerMap[key].totalSpent += (Number(tx.amount) || 0) + (Number(tx.tip) || 0);
      customerMap[key].visitCount += 1;
      
      if (tx.date.startsWith(currentMonthPrefix)) {
        customerMap[key].monthlyVisitsCount += 1;
      }

      customerMap[key].servicesHistory.push(tx.service);
      if (tx.date > customerMap[key].lastVisit) {
        customerMap[key].lastVisit = tx.date;
        if (tx.clientName) customerMap[key].name = tx.clientName;
        if (tx.birthdate && !customerMap[key].birthdate) customerMap[key].birthdate = tx.birthdate;
      }
    });

    const customerList = Object.values(customerMap);
    saveSharedValue(STORAGE_KEYS.CUSTOMERS, CLOUD_KEYS.CUSTOMERS, customerList);
    return customerList;
  },

  isBirthdayToday: (birthdateStr, targetDateStr) => {
    if (!birthdateStr) return false;
    const targetDateObj = targetDateStr ? new Date(targetDateStr + 'T00:00:00') : new Date();
    const month = (targetDateObj.getMonth() + 1).toString().padStart(2, '0');
    const day = targetDateObj.getDate().toString().padStart(2, '0');
    const todayMMDD = `${month}-${day}`;

    if (birthdateStr.length === 5) {
      return birthdateStr === todayMMDD;
    } else if (birthdateStr.length === 10) {
      const birthMMDD = birthdateStr.substring(5);
      return birthMMDD === todayMMDD;
    }
    return false;
  },

  getClientVisitsInMonth: (clientPhoneOrName, yearMonthStr) => {
    if (!clientPhoneOrName) return 0;
    const key = clientPhoneOrName.trim().toLowerCase();
    const allTxs = storageService.getTransactions().filter(t => t.date.startsWith(yearMonthStr));
    return allTxs.filter(t => 
      (t.clientPhone && t.clientPhone.trim().toLowerCase() === key) ||
      (t.clientName && t.clientName.trim().toLowerCase() === key)
    ).length;
  },

  // --- FINANCIAL ANALYTICS ENGINE ---
  getDailySummary: (dateStr) => {
    const transactions = storageService.getTransactions().filter(t => t.date === dateStr);
    const expenses = storageService.getExpenses().filter(e => e.date === dateStr);

    const totalFacturadoServicios = transactions.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const totalPropinas = transactions.reduce((acc, t) => acc + (Number(t.tip) || 0), 0);
    const totalFacturadoTotal = totalFacturadoServicios + totalPropinas;

    const totalContado = transactions.filter(t => t.paymentMethod === 'contado').reduce((acc, t) => acc + (Number(t.amount) || 0) + (Number(t.tip) || 0), 0);
    const totalTransferencia = transactions.filter(t => t.paymentMethod === 'transferencia').reduce((acc, t) => acc + (Number(t.amount) || 0) + (Number(t.tip) || 0), 0);
    const totalEgresos = expenses.reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

    return {
      date: dateStr,
      totalFacturadoServicios,
      totalPropinas,
      totalFacturadoTotal,
      totalContado,
      totalTransferencia,
      totalEgresos,
      clientesAtendidos: transactions.length,
      transactions,
      expenses
    };
  },

  getRawMonthMetrics: (yearMonthStr) => {
    const allTxs = storageService.getTransactions().filter(t => t.date.startsWith(yearMonthStr));
    const allExs = storageService.getExpenses().filter(e => e.date.startsWith(yearMonthStr));
    const barbers = storageService.getBarbers();
    const fixedObj = storageService.getFixedExpenses();

    const totalServiciosMes = allTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
    const totalPropinasMes = allTxs.reduce((acc, t) => acc + (Number(t.tip) || 0), 0);
    const totalFacturadoMes = totalServiciosMes + totalPropinasMes;

    const totalEfectivoIngresado = allTxs.filter(t => t.paymentMethod === 'contado').reduce((acc, t) => acc + (Number(t.amount) || 0) + (Number(t.tip) || 0), 0);
    const totalTransferenciasIngresadas = allTxs.filter(t => t.paymentMethod === 'transferencia').reduce((acc, t) => acc + (Number(t.amount) || 0) + (Number(t.tip) || 0), 0);

    const egresosVariables = allExs.filter(e => e.category !== 'adelanto').reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const totalEgresosFijos = Object.values(fixedObj).reduce((acc, val) => acc + (Number(val) || 0), 0);
    const totalEgresosOperativosGlobales = egresosVariables + totalEgresosFijos;

    const egresosPagadosEnEfectivo = allExs.filter(e => e.paymentMethod === 'caja_efectivo').reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    
    const bankOverride = storageService.getBankExpensesOverride(yearMonthStr);
    const calculatedBankExpenses = allExs.filter(e => e.paymentMethod === 'banco_transferencia').reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
    const egresosPagadosConBanco = bankOverride !== null ? bankOverride : calculatedBankExpenses;

    const saldoEsperadoBanco = totalTransferenciasIngresadas - egresosPagadosConBanco;
    const saldoEfectivoCaja = totalEfectivoIngresado - egresosPagadosEnEfectivo;

    const barberStats = barbers.map(barber => {
      const barberTxs = allTxs.filter(t => t.barberId === barber.id);
      const facturadoServicios = barberTxs.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      const propinasRecibidas = barberTxs.reduce((acc, t) => acc + (Number(t.tip) || 0), 0);

      const commissionRate = barber.commissionRate ?? DEFAULT_COMMISSION_RATE;
      const comisionServicios = facturadoServicios * commissionRate;
      const totalGananciaCalculada = comisionServicios + propinasRecibidas;

      const barberAdvances = allExs
        .filter(e => e.category === 'adelanto' && (e.barberId === barber.id || e.description.toLowerCase().includes(barber.name.toLowerCase())))
        .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);

      const saldoNetoAPagarEfectivo = totalGananciaCalculada - barberAdvances;

      return {
        barberId: barber.id,
        barberName: barber.name,
        clientesAtendidos: barberTxs.length,
        facturadoServicios,
        propinasRecibidas,
        commissionRate,
        comisionServicios,
        totalGananciaCalculada,
        adelantosRecibidos: barberAdvances,
        saldoNetoAPagarEfectivo
      };
    });

    const dailyBarberStats = [];
    const dailyStatsMap = new Map();

    for (const tx of allTxs) {
      const key = `${tx.date}|${tx.barberId}`;
      if (!dailyStatsMap.has(key)) {
        dailyStatsMap.set(key, {
          date: tx.date,
          barberId: tx.barberId,
          barberName: barbers.find(b => b.id === tx.barberId)?.name || 'Barbero',
          clientesAtendidos: 0,
          facturadoServicios: 0,
          propinasRecibidas: 0,
          adelantosRecibidos: 0
        });
      }

      const bucket = dailyStatsMap.get(key);
      bucket.clientesAtendidos += 1;
      bucket.facturadoServicios += Number(tx.amount) || 0;
      bucket.propinasRecibidas += Number(tx.tip) || 0;
    }

    for (const [key, entry] of dailyStatsMap.entries()) {
      const [date, barberId] = key.split('|');
      const barber = barbers.find(b => b.id === barberId);
      const commissionRate = barber?.commissionRate ?? DEFAULT_COMMISSION_RATE;
      const comisionServicios = entry.facturadoServicios * commissionRate;
      const adelantosRecibidos = allExs
        .filter(e => e.category === 'adelanto' && e.date === date && (e.barberId === barberId || e.description.toLowerCase().includes((barber?.name || '').toLowerCase())))
        .reduce((acc, e) => acc + (Number(e.amount) || 0), 0);
      const totalGananciaCalculada = comisionServicios + entry.propinasRecibidas;
      const saldoNetoAPagarEfectivo = totalGananciaCalculada - adelantosRecibidos;

      dailyBarberStats.push({
        date,
        barberId,
        barberName: entry.barberName,
        clientesAtendidos: entry.clientesAtendidos,
        facturadoServicios: entry.facturadoServicios,
        propinasRecibidas: entry.propinasRecibidas,
        commissionRate,
        comisionServicios,
        totalGananciaCalculada,
        adelantosRecibidos,
        saldoNetoAPagarEfectivo
      });
    }

    dailyBarberStats.sort((a, b) => a.date.localeCompare(b.date) || a.barberName.localeCompare(b.barberName));

    const totalClientesAtendidos = allTxs.length;
    const ticketPromedio = totalClientesAtendidos > 0 ? Math.round(totalServiciosMes / totalClientesAtendidos) : 0;
    
    const gananciaBrutaBarberia = totalServiciosMes - barberStats.reduce(
      (total, barber) => total + barber.comisionServicios,
      0
    );
    const gananciaNetaBarberia = gananciaBrutaBarberia - totalEgresosOperativosGlobales;

    return {
      yearMonth: yearMonthStr,
      totalServiciosMes,
      totalPropinasMes,
      totalFacturadoMes,
      totalEfectivoIngresado,
      totalTransferenciasIngresadas,
      egresosVariables,
      fixedExpensesObj: fixedObj,
      totalEgresosFijos,
      totalEgresosOperativosGlobales,
      egresosPagadosEnEfectivo,
      egresosPagadosConBanco,
      isBankOverride: bankOverride !== null,
      saldoEsperadoBanco,
      saldoEfectivoCaja,
      barberStats,
      dailyBarberStats,
      totalClientesAtendidos,
      ticketPromedio,
      gananciaBrutaBarberia,
      gananciaNetaBarberia,
      allTxs,
      allExs
    };
  },

  getMonthlyFinancialReport: (yearMonthStr) => {
    return storageService.getRawMonthMetrics(yearMonthStr);
  },

  backupData: () => persistSafeBackup(),

  restoreLastKnownBackup: () => {
    const rawBackup = localStorage.getItem(SAFE_BACKUP_KEY);
    if (!rawBackup) return false;

    try {
      const backup = JSON.parse(rawBackup);
      const restores = [
        ['transactions', STORAGE_KEYS.TRANSACTIONS, CLOUD_KEYS.TRANSACTIONS],
        ['expenses', STORAGE_KEYS.EXPENSES, CLOUD_KEYS.EXPENSES],
        ['customers', STORAGE_KEYS.CUSTOMERS, CLOUD_KEYS.CUSTOMERS],
        ['barbers', STORAGE_KEYS.BARBERS, CLOUD_KEYS.BARBERS],
        ['services', STORAGE_KEYS.SERVICES, CLOUD_KEYS.SERVICES],
        ['fixedExpenses', STORAGE_KEYS.FIXED_EXPENSES, CLOUD_KEYS.FIXED_EXPENSES],
        ['bankExpensesOverride', STORAGE_KEYS.BANK_EXPENSES_OVERRIDE, CLOUD_KEYS.BANK_EXPENSES_OVERRIDE]
      ];
      for (const [field, localKey, cloudKey] of restores) {
        if (backup[field] !== undefined) saveSharedValue(localKey, cloudKey, backup[field]);
      }
      localStorage.setItem(OPERATIONAL_DATA_RESET_KEY, '1');
      return true;
    } catch (error) {
      console.error('No se pudo restaurar el backup seguro:', error);
      return false;
    }
  },

  exportJSONData: async () => {
    if (!supabase || currentUserRole !== 'admin' || !currentUserId) {
      throw new Error('Iniciá sesión como administradora y conectate a Supabase para descargar una copia actualizada.');
    }

    await syncPendingValues();
    const data = await getSupabaseData('admin_get_app_data');
    const requiredArrays = ['transactions', 'expenses', 'customers', 'barbers', 'services'];
    if (!data || requiredArrays.some(field => !Array.isArray(data[field]))
      || !data.fixed_expenses || typeof data.fixed_expenses !== 'object' || Array.isArray(data.fixed_expenses)
      || !data.bank_expenses_override || typeof data.bank_expenses_override !== 'object' || Array.isArray(data.bank_expenses_override)) {
      throw new Error('Supabase devolvió datos incompletos. No se descargó una copia parcial.');
    }

    return JSON.stringify({
      transactions: data.transactions,
      expenses: data.expenses,
      customers: data.customers,
      barbers: data.barbers,
      services: data.services,
      fixedExpenses: data.fixed_expenses,
      bankExpensesOverride: data.bank_expenses_override,
      exportDate: new Date().toISOString()
    }, null, 2);
  },

  importJSONData: (jsonString) => {
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('El archivo no contiene un backup JSON válido.');
    }
    const requiredArrays = ['transactions', 'expenses', 'customers', 'barbers', 'services'];
    if (requiredArrays.some(field => !Array.isArray(parsed[field]))) {
      throw new Error('El backup está incompleto o tiene colecciones con formato inválido.');
    }
    if (requiredArrays.some(field => parsed[field].some(item => (
      !item || typeof item !== 'object' || Array.isArray(item)
    )))) {
      throw new Error('El backup contiene registros con formato inválido.');
    }
    if (!parsed.fixedExpenses || typeof parsed.fixedExpenses !== 'object' || Array.isArray(parsed.fixedExpenses)
      || !parsed.bankExpensesOverride || typeof parsed.bankExpensesOverride !== 'object' || Array.isArray(parsed.bankExpensesOverride)) {
      throw new Error('El backup está incompleto o tiene configuraciones con formato inválido.');
    }
    if (supabase && (currentUserRole !== 'admin' || !currentUserId)) {
      throw new Error('Solo una sesión administradora puede importar datos.');
    }
    persistSafeBackup();
    const imports = [
      ['transactions', STORAGE_KEYS.TRANSACTIONS, CLOUD_KEYS.TRANSACTIONS],
      ['expenses', STORAGE_KEYS.EXPENSES, CLOUD_KEYS.EXPENSES],
      ['customers', STORAGE_KEYS.CUSTOMERS, CLOUD_KEYS.CUSTOMERS],
      ['barbers', STORAGE_KEYS.BARBERS, CLOUD_KEYS.BARBERS],
      ['services', STORAGE_KEYS.SERVICES, CLOUD_KEYS.SERVICES],
      ['fixedExpenses', STORAGE_KEYS.FIXED_EXPENSES, CLOUD_KEYS.FIXED_EXPENSES],
      ['bankExpensesOverride', STORAGE_KEYS.BANK_EXPENSES_OVERRIDE, CLOUD_KEYS.BANK_EXPENSES_OVERRIDE]
    ];
    for (const [field, localKey, cloudKey] of imports) {
      saveSharedValue(localKey, cloudKey, parsed[field], false);
    }
    return true;
  }
};
