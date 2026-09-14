// Storage & Financial Logic Engine for BarberFlow Pro
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const STORAGE_KEYS = {
  TRANSACTIONS: 'barberflow_transactions_v1',
  EXPENSES: 'barberflow_expenses_v1',
  CUSTOMERS: 'barberflow_customers_v1',
  BARBERS: 'barberflow_barbers_v1',
  SERVICES: 'barberflow_services_v1',
  USER_ROLE: 'barberflow_user_role_v1',
  ADMIN_PIN: 'barberflow_admin_pin_v1',
  FIXED_EXPENSES: 'barberflow_fixed_expenses_v1',
  BANK_EXPENSES_OVERRIDE: 'barberflow_bank_expenses_override_v1'
};

const DEFAULT_BARBERS = [
  { id: 'ema', name: 'Ema', commissionRate: 0.40, phone: '', active: true },
  { id: 'diego', name: 'Diego', commissionRate: 0.40, phone: '', active: true },
  { id: 'barbero_invitado', name: 'Barbero 3', commissionRate: 0.40, phone: '', active: true }
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

const DEFAULT_FIXED_EXPENSES = {
  alquiler: 180000,
  alarma: 15000,
  internet: 20000,
  luz: 45000,
  dispenser_agua: 9000
};

const getCustomerId = (key) => {
  const hash = Array.from(key).reduce((value, character) => (
    ((value << 5) - value + character.charCodeAt(0)) | 0
  ), 0);
  return `cust-${Math.abs(hash)}`;
};

const getInitialMockTransactions = () => {
  const today = new Date().toISOString().split('T')[0];
  const currentMonthPrefix = today.substring(0, 7);

  const dateObj = new Date();
  dateObj.setMonth(dateObj.getMonth() - 1);
  const prevMonthPrefix = dateObj.toISOString().substring(0, 7);

  return [
    { id: 'tx-1', date: `${currentMonthPrefix}-01`, clientName: 'Martín Gómez', clientPhone: '+5491145678901', birthdate: '09-13', service: 'Combo Corte + Barba', amount: 8500, tip: 1000, paymentMethod: 'transferencia', barberId: 'ema' },
    { id: 'tx-2', date: `${currentMonthPrefix}-01`, clientName: 'Lucas Rodríguez', clientPhone: '+5491156789012', birthdate: '05-20', service: 'Corte de Pelo', amount: 6000, tip: 500, paymentMethod: 'contado', barberId: 'diego' },
    { id: 'tx-3', date: `${currentMonthPrefix}-02`, clientName: 'Gonzalo Pérez', clientPhone: '+5491167890123', birthdate: '11-04', service: 'Arreglo de Barba', amount: 4000, tip: 0, paymentMethod: 'contado', barberId: 'ema' },
    { id: 'tx-4', date: `${currentMonthPrefix}-02`, clientName: 'Facundo Silva', clientPhone: '+5491178901234', birthdate: '02-18', service: 'Combo Corte + Barba', amount: 8500, tip: 1500, paymentMethod: 'transferencia', barberId: 'barbero_invitado' },
    { id: 'tx-5', date: today, clientName: 'Nicolás Rossi', clientPhone: '+5491189012345', birthdate: '09-13', service: 'Corte de Pelo', amount: 6000, tip: 1000, paymentMethod: 'transferencia', barberId: 'ema' },
    { id: 'tx-6', date: today, clientName: 'Julian Alvarez', clientPhone: '+5491190123456', birthdate: '01-31', service: 'Combo Corte + Barba', amount: 8500, tip: 500, paymentMethod: 'contado', barberId: 'diego' },

    { id: 'tx-prev-1', date: `${prevMonthPrefix}-10`, clientName: 'Carlos Benítez', clientPhone: '+5491133334444', birthdate: '08-12', service: 'Corte de Pelo', amount: 6000, tip: 500, paymentMethod: 'contado', barberId: 'ema' },
    { id: 'tx-prev-2', date: `${prevMonthPrefix}-15`, clientName: 'Mateo Fernández', clientPhone: '+5491155556666', birthdate: '03-25', service: 'Combo Corte + Barba', amount: 8500, tip: 1000, paymentMethod: 'transferencia', barberId: 'diego' }
  ];
};

const getInitialMockExpenses = () => {
  const today = new Date().toISOString().split('T')[0];
  const currentMonthPrefix = today.substring(0, 7);

  return [
    { id: 'ex-1', date: `${currentMonthPrefix}-01`, category: 'insumos', description: 'Papel cuello y navajas', amount: 7200, paymentMethod: 'banco_transferencia', barberId: null },
    { id: 'ex-2', date: `${currentMonthPrefix}-05`, category: 'adelanto', description: 'Adelanto de sueldo Ema', amount: 10000, paymentMethod: 'caja_efectivo', barberId: 'ema' },
    { id: 'ex-3', date: today, category: 'adelanto', description: 'Adelanto de sueldo Diego', amount: 5000, paymentMethod: 'caja_efectivo', barberId: 'diego' }
  ];
};

export const storageService = {
  // --- ROLE & PIN MANAGEMENT ---
  getUserRole: () => {
    return localStorage.getItem(STORAGE_KEYS.USER_ROLE) || 'barber'; // 'admin' | 'barber'
  },

  setUserRole: (role) => {
    localStorage.setItem(STORAGE_KEYS.USER_ROLE, role);
  },

  getAdminPIN: () => {
    return localStorage.getItem(STORAGE_KEYS.ADMIN_PIN) || '1234';
  },

  setAdminPIN: (pin) => {
    localStorage.setItem(STORAGE_KEYS.ADMIN_PIN, pin);
  },

  verifyAdminPIN: (inputPin) => {
    const currentPin = storageService.getAdminPIN();
    return inputPin.trim() === currentPin.trim();
  },

  // --- BANK EXPENSES OVERRIDE ---
  getBankExpensesOverride: (yearMonthStr) => {
    const data = localStorage.getItem(STORAGE_KEYS.BANK_EXPENSES_OVERRIDE);
    const obj = data ? JSON.parse(data) : {};
    return obj[yearMonthStr] !== undefined ? Number(obj[yearMonthStr]) : null;
  },

  setBankExpensesOverride: (yearMonthStr, amount) => {
    const data = localStorage.getItem(STORAGE_KEYS.BANK_EXPENSES_OVERRIDE);
    const obj = data ? JSON.parse(data) : {};
    obj[yearMonthStr] = Number(amount) || 0;
    localStorage.setItem(STORAGE_KEYS.BANK_EXPENSES_OVERRIDE, JSON.stringify(obj));
    return obj[yearMonthStr];
  },

  // --- FIXED MONTHLY EXPENSES ---
  getFixedExpenses: () => {
    const data = localStorage.getItem(STORAGE_KEYS.FIXED_EXPENSES);
    return data ? JSON.parse(data) : DEFAULT_FIXED_EXPENSES;
  },

  saveFixedExpenses: (fixedObj) => {
    localStorage.setItem(STORAGE_KEYS.FIXED_EXPENSES, JSON.stringify(fixedObj));
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

  // --- BARBERS MANAGEMENT ---
  getBarbers: () => {
    const data = localStorage.getItem(STORAGE_KEYS.BARBERS);
    return data ? JSON.parse(data) : DEFAULT_BARBERS;
  },

  saveBarbers: (barbers) => {
    localStorage.setItem(STORAGE_KEYS.BARBERS, JSON.stringify(barbers));
  },

  addBarber: ({ name, commissionRate }) => {
    const barbers = storageService.getBarbers();
    const newBarber = {
      id: 'barber_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      name: name.trim(),
      commissionRate: Number(commissionRate) / 100 || 0.40,
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
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
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
    const data = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
    if (!data) {
      const initial = getInitialMockTransactions();
      localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(data);
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
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
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

    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(updated));
    storageService.syncCustomersFromTransactions(updated);
    return updated;
  },

  deleteTransaction: (id) => {
    const transactions = storageService.getTransactions().filter(t => t.id !== id);
    localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(transactions));
    storageService.syncCustomersFromTransactions(transactions);
  },

  // --- EXPENSES (EGRESOS) ---
  getExpenses: () => {
    const data = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (!data) {
      const initial = getInitialMockExpenses();
      localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(data);
  },

  addExpense: (expense) => {
    const expenses = storageService.getExpenses();
    const newEx = {
      ...expense,
      id: 'ex-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      amount: Number(expense.amount) || 0
    };
    expenses.unshift(newEx);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
    return newEx;
  },

  deleteExpense: (id) => {
    const expenses = storageService.getExpenses().filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(expenses));
  },

  // --- CUSTOMERS ---
  getCustomers: () => {
    const data = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!data) {
      const txs = storageService.getTransactions();
      return storageService.syncCustomersFromTransactions(txs);
    }
    return JSON.parse(data);
  },

  updateCustomerBirthdate: (customerId, birthdate) => {
    const customers = storageService.getCustomers();
    const updated = customers.map(c => c.id === customerId ? { ...c, birthdate } : c);
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updated));
    storageService.syncCustomersToCloud(updated);
    return updated;
  },

  getCustomersShared: async () => {
    const localData = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);

    if (!supabase) return storageService.getCustomers();

    const { data, error } = await supabase
      .from('barberflow_customers')
      .select('id, data')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('No se pudo cargar la base compartida de clientes:', error);
      return storageService.getCustomers();
    }

    if (data.length > 0) {
      const customers = data.map(row => row.data);
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
      return customers;
    }

    const localCustomers = localData ? JSON.parse(localData) : storageService.getCustomers();
    if (localData && localCustomers.length > 0) {
      await storageService.syncCustomersToCloud(localCustomers);
    }
    return localCustomers;
  },

  syncCustomersToCloud: async (customers) => {
    if (!supabase || !customers?.length) return;

    const rows = customers.map(customer => ({
      id: customer.id,
      data: customer,
      updated_at: new Date().toISOString()
    }));
    const { error } = await supabase.from('barberflow_customers').upsert(rows);
    if (error) console.error('No se pudo sincronizar la base de clientes:', error);
  },

  syncCustomersFromTransactions: (transactions) => {
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
    localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customerList));
    storageService.syncCustomersToCloud(customerList);
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

      const commissionRate = barber.commissionRate || 0.40;
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

    const totalClientesAtendidos = allTxs.length;
    const ticketPromedio = totalClientesAtendidos > 0 ? Math.round(totalServiciosMes / totalClientesAtendidos) : 0;
    
    const gananciaBrutaBarberia = totalServiciosMes * 0.60;
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
      totalClientesAtendidos,
      ticketPromedio,
      gananciaBrutaBarberia,
      gananciaNetaBarberia,
      allTxs,
      allExs
    };
  },

  getMonthlyFinancialReport: (yearMonthStr) => {
    const currentMetrics = storageService.getRawMonthMetrics(yearMonthStr);

    const [y, m] = yearMonthStr.split('-').map(Number);
    let prevYear = y;
    let prevMonth = m - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = y - 1;
    }
    const prevYearMonthStr = `${prevYear}-${prevMonth.toString().padStart(2, '0')}`;
    const previousMetrics = storageService.getRawMonthMetrics(prevYearMonthStr);

    const diffFacturado = currentMetrics.totalFacturadoMes - previousMetrics.totalFacturadoMes;
    const pctGrowthFacturado = previousMetrics.totalFacturadoMes > 0 
      ? Math.round((diffFacturado / previousMetrics.totalFacturadoMes) * 100) 
      : 0;

    const diffClientes = currentMetrics.totalClientesAtendidos - previousMetrics.totalClientesAtendidos;
    const pctGrowthClientes = previousMetrics.totalClientesAtendidos > 0 
      ? Math.round((diffClientes / previousMetrics.totalClientesAtendidos) * 100) 
      : 0;

    const diffGananciaNeta = currentMetrics.gananciaNetaBarberia - previousMetrics.gananciaNetaBarberia;
    const pctGrowthGananciaNeta = previousMetrics.gananciaNetaBarberia > 0 
      ? Math.round((diffGananciaNeta / previousMetrics.gananciaNetaBarberia) * 100) 
      : 0;

    return {
      ...currentMetrics,
      previousMonthStr: prevYearMonthStr,
      previousMetrics,
      comparison: {
        pctGrowthFacturado,
        diffFacturado,
        pctGrowthClientes,
        diffClientes,
        pctGrowthGananciaNeta,
        diffGananciaNeta
      }
    };
  },

  exportJSONData: () => {
    return JSON.stringify({
      transactions: storageService.getTransactions(),
      expenses: storageService.getExpenses(),
      customers: storageService.getCustomers(),
      barbers: storageService.getBarbers(),
      services: storageService.getServices(),
      fixedExpenses: storageService.getFixedExpenses(),
      exportDate: new Date().toISOString()
    }, null, 2);
  },

  importJSONData: (jsonString) => {
    try {
      const parsed = JSON.parse(jsonString);
      if (parsed.transactions) localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(parsed.transactions));
      if (parsed.expenses) localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(parsed.expenses));
      if (parsed.customers) {
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(parsed.customers));
        storageService.syncCustomersToCloud(parsed.customers);
      }
      if (parsed.barbers) localStorage.setItem(STORAGE_KEYS.BARBERS, JSON.stringify(parsed.barbers));
      if (parsed.services) localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(parsed.services));
      if (parsed.fixedExpenses) localStorage.setItem(STORAGE_KEYS.FIXED_EXPENSES, JSON.stringify(parsed.fixedExpenses));
      return true;
    } catch (e) {
      console.error('Error importing JSON data:', e);
      return false;
    }
  }
};
