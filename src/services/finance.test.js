import test from 'node:test';
import assert from 'node:assert/strict';
import { daySummary, byBarber } from './finance.js';
import { todayISO, monthEnd, isBirthdayOn, formatDate } from './dates.js';

test('daySummary suma efectivo y transferencias e ignora lo anulado', () => {
  const summary = daySummary({
    sales: [
      { barber_id: 'a', amount: '6000', tip: '500', payment_method: 'efectivo', voided: false },
      { barber_id: 'b', amount: '8000', tip: '0', payment_method: 'transferencia', voided: false },
      { barber_id: 'b', amount: '9999', tip: '0', payment_method: 'transferencia', voided: true }
    ],
    expenses: [
      { amount: '1000', payment_method: 'efectivo', voided: false },
      { amount: '2000', payment_method: 'banco', voided: false }
    ],
    advances: [{ amount: '1500', payment_method: 'efectivo', voided: false }]
  });
  assert.equal(summary.total, 14500);
  assert.equal(summary.services, 14000);
  assert.equal(summary.tips, 500);
  assert.equal(summary.cashIn, 6500);
  assert.equal(summary.transferIn, 8000);
  assert.equal(summary.outTotal, 4500);
  assert.equal(summary.cashNet, 6500 - 1000 - 1500);
  assert.equal(summary.count, 2);
});

test('byBarber muestra los totales de cada barbero', () => {
  const rows = byBarber(
    [
      { barber_id: 'a', amount: 1000, tip: 100, voided: false },
      { barber_id: 'a', amount: 2000, tip: 0, voided: false },
      { barber_id: 'b', amount: 500, tip: 0, voided: true }
    ],
    [{ id: 'a', name: 'Diego' }, { id: 'b', name: 'Lionel' }]
  );
  assert.deepEqual(rows, [{ barberId: 'a', name: 'Diego', count: 2, total: 3100 }]);
});

test('la fecha de hoy se calcula en hora de Córdoba', () => {
  // 23:30 del 31/12 en Córdoba = 02:30 UTC del 1/1: sigue siendo 31/12.
  assert.equal(todayISO(new Date('2027-01-01T02:30:00Z')), '2026-12-31');
  assert.equal(todayISO(new Date('2027-01-01T03:00:00Z')), '2027-01-01');
});

test('fin de mes y formato de fecha', () => {
  assert.equal(monthEnd('2026-02'), '2026-02-28');
  assert.equal(monthEnd('2028-02'), '2028-02-29');
  assert.equal(monthEnd('2026-12'), '2026-12-31');
  assert.equal(formatDate('2026-12-05'), '05/12/2026');
});

test('cumpleaños en formato MM-DD o DD/MM', () => {
  assert.equal(isBirthdayOn('09-13', '2026-09-13'), true);
  assert.equal(isBirthdayOn('13/09', '2026-09-13'), true);
  assert.equal(isBirthdayOn('1990-09-13', '2026-09-13'), true);
  assert.equal(isBirthdayOn('09-14', '2026-09-13'), false);
  assert.equal(isBirthdayOn('', '2026-09-13'), false);
});
