import test from 'node:test';
import assert from 'node:assert/strict';
import { storageService } from './storageService.js';

const makeLocalStorage = () => {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    }
  };
};

test('initializeSharedData does not wipe existing operational data on first run', async () => {
  global.localStorage = makeLocalStorage();
  const existingTransactions = [{ id: 'tx-1', amount: 1500, date: '2026-10-12' }];
  const existingCustomers = [{ id: 'cust-1', name: 'Ana', phone: '111' }];

  global.localStorage.setItem('barberflow_transactions_v1', JSON.stringify(existingTransactions));
  global.localStorage.setItem('barberflow_customers_v1', JSON.stringify(existingCustomers));

  await storageService.initializeSharedData();

  assert.deepEqual(JSON.parse(global.localStorage.getItem('barberflow_transactions_v1')), existingTransactions);
  assert.deepEqual(JSON.parse(global.localStorage.getItem('barberflow_customers_v1')), existingCustomers);
  assert.deepEqual(
    JSON.parse(global.localStorage.getItem('barberflow_safe_backup_v1')).transactions,
    existingTransactions
  );
});

test('save operations back up existing transactions before changing them', () => {
  global.localStorage = makeLocalStorage();
  const existingTransactions = [{ id: 'tx-1', amount: 1500, date: '2026-10-12' }];
  global.localStorage.setItem('barberflow_transactions_v1', JSON.stringify(existingTransactions));

  storageService.deleteTransaction('tx-1');

  assert.deepEqual(JSON.parse(global.localStorage.getItem('barberflow_transactions_v1')), []);
  assert.deepEqual(
    JSON.parse(global.localStorage.getItem('barberflow_safe_backup_v1')).transactions,
    existingTransactions
  );
});

test('import rejects an incomplete backup without changing existing data', () => {
  global.localStorage = makeLocalStorage();
  const existingTransactions = [{ id: 'tx-1', amount: 1500, date: '2026-10-12' }];
  global.localStorage.setItem('barberflow_transactions_v1', JSON.stringify(existingTransactions));

  assert.throws(
    () => storageService.importJSONData(JSON.stringify({ transactions: [] })),
    /backup está incompleto/
  );
  assert.deepEqual(JSON.parse(global.localStorage.getItem('barberflow_transactions_v1')), existingTransactions);
});

test('import preserves existing operational data before replacing it', () => {
  global.localStorage = makeLocalStorage();
  const existingTransactions = [{ id: 'tx-1', amount: 1500, date: '2026-10-12' }];
  const importedTransactions = [{ id: 'tx-2', amount: 2500, date: '2026-10-13' }];
  global.localStorage.setItem('barberflow_transactions_v1', JSON.stringify(existingTransactions));

  storageService.importJSONData(JSON.stringify({
    transactions: importedTransactions,
    expenses: [],
    customers: [],
    barbers: [],
    services: [],
    fixedExpenses: {},
    bankExpensesOverride: {}
  }));

  assert.deepEqual(JSON.parse(global.localStorage.getItem('barberflow_transactions_v1')), importedTransactions);
  assert.deepEqual(
    JSON.parse(global.localStorage.getItem('barberflow_safe_backup_v1')).transactions,
    existingTransactions
  );
});

test('remote backup export refuses to return a potentially stale local snapshot', async () => {
  global.localStorage = makeLocalStorage();

  await assert.rejects(
    storageService.exportJSONData(),
    /Supabase|administradora/
  );
});
