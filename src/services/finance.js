// Cálculos rápidos de la caja del día. Los números del mes (liquidación,
// sociedad, conciliación) los calcula la base de datos en bf_month_report.

const sum = (rows, pick) => rows.reduce((total, row) => total + (Number(pick(row)) || 0), 0);

export const activeRows = (rows) => rows.filter(row => !row.voided);

export const daySummary = ({ sales = [], expenses = [], advances = [] }) => {
  const validSales = activeRows(sales);
  const validExpenses = activeRows(expenses);
  const validAdvances = activeRows(advances);

  const services = sum(validSales, sale => sale.amount);
  const tips = sum(validSales, sale => sale.tip);
  const cashIn = sum(validSales.filter(sale => sale.payment_method === 'efectivo'), sale => Number(sale.amount) + Number(sale.tip));
  const transferIn = sum(validSales.filter(sale => sale.payment_method === 'transferencia'), sale => Number(sale.amount) + Number(sale.tip));
  const expensesTotal = sum(validExpenses, expense => expense.amount);
  const advancesTotal = sum(validAdvances, advance => advance.amount);
  const cashOut = sum(validExpenses.filter(row => row.payment_method === 'efectivo'), row => row.amount)
    + sum(validAdvances.filter(row => row.payment_method === 'efectivo'), row => row.amount);

  return {
    services,
    tips,
    total: services + tips,
    cashIn,
    transferIn,
    expensesTotal,
    advancesTotal,
    outTotal: expensesTotal + advancesTotal,
    cashNet: cashIn - cashOut,
    count: validSales.length
  };
};

export const byBarber = (sales, barbers) => barbers
  .map(barber => {
    const rows = activeRows(sales).filter(sale => sale.barber_id === barber.id);
    return {
      barberId: barber.id,
      name: barber.name,
      count: rows.length,
      total: sum(rows, sale => Number(sale.amount) + Number(sale.tip))
    };
  })
  .filter(row => row.count > 0);

export const money = (value) => `$${(Number(value) || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 })}`;
