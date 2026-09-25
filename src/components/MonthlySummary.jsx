import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { 
  TrendingUp, DollarSign, Wallet, CreditCard, PieChart, BarChart2, PlusCircle, Trash2,
  CheckCircle, ArrowDownCircle, Users, Award, ShieldAlert, FileText, Gift, 
  Home, Shield, Wifi, Zap, Droplet, Edit3, Save 
} from 'lucide-react';

let Pie = null;
let Bar = null;
let ChartJS = null;

const loadCharting = async () => {
  if (Pie && Bar && ChartJS) return;

  const chartJsModule = await import('chart.js');
  const chartjs2 = await import('react-chartjs-2');

  ChartJS = chartJsModule.Chart;
  ChartJS.register(chartJsModule.ArcElement, chartJsModule.Tooltip, chartJsModule.Legend, chartJsModule.CategoryScale, chartJsModule.LinearScale, chartJsModule.BarElement, chartJsModule.Title);

  Pie = chartjs2.Pie;
  Bar = chartjs2.Bar;
};

export default function MonthlySummary() {
  const currentMonthStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [report, setReport] = useState(null);
  const [chartsReady, setChartsReady] = useState(false);

  // Editable Bank Expenses local state
  const [isEditingBankExpenses, setIsEditingBankExpenses] = useState(false);
  const [bankExpensesInput, setBankExpensesInput] = useState('');

  // Editable Fixed Expenses local state
  const [editingFixedKey, setEditingFixedKey] = useState(null);
  const [fixedExpensesState, setFixedExpensesState] = useState({});
  const [newFixedExpenseName, setNewFixedExpenseName] = useState('');
  const [newFixedExpenseAmount, setNewFixedExpenseAmount] = useState('');

  useEffect(() => {
    loadMonthlyReport();
    void loadCharting().then(() => setChartsReady(true));
  }, [selectedMonth]);

  const loadMonthlyReport = () => {
    const data = storageService.getMonthlyFinancialReport(selectedMonth);
    setReport(data);
    setFixedExpensesState(data.fixedExpensesObj);
    setBankExpensesInput(data.egresosPagadosConBanco);
  };

  const handleUpdateFixedExpense = (key, val) => {
    const updated = storageService.updateFixedExpense(key, val);
    setFixedExpensesState(updated);
    loadMonthlyReport();
    setEditingFixedKey(null);
  };

  const handleAddFixedExpense = (event) => {
    event.preventDefault();
    if (!newFixedExpenseName.trim() || !newFixedExpenseAmount || Number(newFixedExpenseAmount) < 0) return;

    const updated = storageService.addFixedExpense(newFixedExpenseName, newFixedExpenseAmount);
    setFixedExpensesState(updated);
    setNewFixedExpenseName('');
    setNewFixedExpenseAmount('');
    loadMonthlyReport();
  };

  const handleDeleteFixedExpense = (key) => {
    const updated = storageService.deleteFixedExpense(key);
    setFixedExpensesState(updated);
    loadMonthlyReport();
  };

  const handleSaveBankExpenses = (newVal) => {
    storageService.setBankExpensesOverride(selectedMonth, newVal);
    loadMonthlyReport();
    setIsEditingBankExpenses(false);
  };

  if (!report) return null;

  const hasFinancialData = Boolean(
    report.totalFacturadoMes ||
    report.totalEfectivoIngresado ||
    report.totalTransferenciasIngresadas ||
    report.totalEgresosOperativosGlobales ||
    report.totalClientesAtendidos ||
    report.totalEgresosFijos
  );
  const showBankSummary = Boolean(report.totalTransferenciasIngresadas || report.egresosPagadosConBanco || report.totalEfectivoIngresado);

  const formatDateLabel = (dateStr) => {
    const safeDate = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();
    return safeDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Chart Data: Payment Methods Split
  const pieData = {
    labels: ['Efectivo / Contado', 'Transferencias Bancarias'],
    datasets: [
      {
        data: [report.totalEfectivoIngresado, report.totalTransferenciasIngresadas],
        backgroundColor: ['#10b981', '#06b6d4'],
        borderColor: ['#059669', '#0891b2'],
        borderWidth: 1,
      },
    ],
  };

  // Chart Data: Barbers Sales Comparison
  const barData = {
    labels: report.barberStats.map(b => b.barberName),
    datasets: [
      {
        label: 'Servicios Facturados ($)',
        data: report.barberStats.map(b => b.facturadoServicios),
        backgroundColor: 'rgba(217, 119, 6, 0.7)',
        borderColor: '#d97706',
        borderWidth: 1,
        borderRadius: 6
      },
      {
        label: 'Ganancia Barbero (40% + Propinas)',
        data: report.barberStats.map(b => b.totalGananciaCalculada),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 6
      }
    ],
  };

  const fixedItemsConfig = Object.keys(fixedExpensesState).map((key, index) => ({
    key,
    name: key.replace(/_\d+$/, '').replace(/_/g, ' '),
    icon: [Home, Shield, Wifi, Zap, Droplet][index % 5],
    color: ['#f59e0b', '#a78bfa', '#38bdf8', '#fbbf24', '#06b6d4'][index % 5]
  }));

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      
      {/* Header & Month Selector */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp style={{ color: 'var(--accent-gold)' }} />
            Resumen Mensual
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Análisis contable del mes seleccionado, egresos fijos editables y saldos
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Mes de Análisis:</label>
          <input 
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="form-input"
            style={{ width: 'auto', padding: '8px 14px', background: 'var(--bg-card)', color: 'var(--accent-gold)', fontWeight: 700, fontSize: '1rem' }}
          />
        </div>
      </div>

      {/* SECCIÓN EGRESOS FIJOS DEL MES (EDITABLES) */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px', borderTop: '4px solid #f59e0b' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Home size={22} />
              Egresos Fijos Mensuales (Alquiler, Luz, Alarma, Internet, Agua)
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Agregá y editá los gastos fijos que quieras descontar de la ganancia neta.
            </p>
          </div>
          <span className="badge badge-egreso" style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
            Total Fijos: ${report.totalEgresosFijos.toLocaleString('es-AR')}
          </span>
        </div>

        <div className="fixed-expense-grid" style={{ gap: '14px' }}>
          {fixedItemsConfig.map(item => {
            const Icon = item.icon;
            const currentVal = fixedExpensesState[item.key] || 0;
            const isEditing = editingFixedKey === item.key;

            return (
              <div key={item.key} style={{
                background: 'rgba(15, 23, 42, 0.7)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: item.color, marginBottom: '6px' }}>
                  <Icon size={18} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{item.name}</span>
                </div>

                {isEditing ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                    <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>$</span>
                    <input 
                      type="number"
                      defaultValue={currentVal}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdateFixedExpense(item.key, e.target.value);
                      }}
                      onBlur={(e) => handleUpdateFixedExpense(item.key, e.target.value)}
                      className="form-input"
                      style={{ padding: '4px 8px', color: 'var(--accent-gold)', fontWeight: 700 }}
                      autoFocus
                    />
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                    <span style={{ fontSize: '1.2rem', fontWeight: 800, color: item.color }}>
                      ${currentVal.toLocaleString('es-AR')}
                    </span>
                    <button 
                      onClick={() => setEditingFixedKey(item.key)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px' }}
                      title="Modificar Monto"
                    >
                      <Edit3 size={13} />
                    </button>
                    <button
                      onClick={() => handleDeleteFixedExpense(item.key)}
                      className="btn btn-secondary btn-sm"
                      style={{ padding: '4px 8px', color: '#fb7185' }}
                      title="Eliminar gasto fijo"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <form onSubmit={handleAddFixedExpense} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '10px', marginTop: '18px', paddingTop: '18px', borderTop: '1px solid var(--border-color)' }}>
          <label style={{ flex: '1 1 220px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Nombre del gasto
            <input
              type="text"
              value={newFixedExpenseName}
              onChange={(event) => setNewFixedExpenseName(event.target.value)}
              placeholder="Ej. Seguro"
              className="form-input"
              style={{ marginTop: '5px' }}
            />
          </label>
          <label style={{ flex: '1 1 150px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Importe mensual
            <input
              type="number"
              min="0"
              value={newFixedExpenseAmount}
              onChange={(event) => setNewFixedExpenseAmount(event.target.value)}
              placeholder="0"
              className="form-input"
              style={{ marginTop: '5px' }}
            />
          </label>
          <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <PlusCircle size={16} /> Agregar gasto fijo
          </button>
        </form>
      </div>

      {/* ACCOUNTING CONCILIATION CARDS WITH EDITABLE BANK OUTFLOWS */}
      {hasFinancialData ? (
        <div className="accounting-grid" style={{ marginBottom: '28px' }}>
          
          {/* Conciliación Bancaria (Transferencias) */}
          {showBankSummary && (
            <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid #06b6d4' }}>
              <h3 style={{ fontSize: '1.15rem', color: '#38bdf8', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CreditCard size={20} />
                Conciliación Cuenta Bancaria
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>+ Total Transferencias Recibidas:</span>
                  <span style={{ fontWeight: 700, color: '#38bdf8' }}>+${report.totalTransferenciasIngresadas.toLocaleString('es-AR')}</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    - Gastos Pagados vía Banco:
                  </span>

                  {isEditingBankExpenses ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#fb7185', fontWeight: 700 }}>-$</span>
                      <input 
                        type="number"
                        value={bankExpensesInput}
                        onChange={(e) => setBankExpensesInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveBankExpenses(bankExpensesInput);
                        }}
                        className="form-input"
                        style={{ width: '120px', padding: '4px 8px', color: '#fb7185', fontWeight: 700 }}
                        autoFocus
                      />
                      <button 
                        onClick={() => handleSaveBankExpenses(bankExpensesInput)}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '4px 8px', background: '#10b981' }}
                      >
                        <Save size={13} />
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 700, color: '#fb7185' }}>
                        -${report.egresosPagadosConBanco.toLocaleString('es-AR')}
                      </span>
                      <button 
                        onClick={() => { setBankExpensesInput(report.egresosPagadosConBanco); setIsEditingBankExpenses(true); }}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '4px 8px' }}
                        title="Editar monto saliente del banco"
                      >
                        <Edit3 size={13} /> Modificar
                      </button>
                    </div>
                  )}
                </div>

                {(report.totalTransferenciasIngresadas > 0 || report.egresosPagadosConBanco > 0) && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', fontSize: '1.1rem' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>🏦 Dinero Esperado en Banco:</span>
                    <span style={{ fontWeight: 800, color: '#38bdf8' }}>${report.saldoEsperadoBanco.toLocaleString('es-AR')}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Conciliación Caja Chica (Efectivo) */}
          <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid #10b981' }}>
            <h3 style={{ fontSize: '1.15rem', color: '#34d399', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Wallet size={20} />
              Conciliación Caja Chica (Efectivo)
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>+ Total Efectivo Cobrado:</span>
                <span style={{ fontWeight: 700, color: '#34d399' }}>+${report.totalEfectivoIngresado.toLocaleString('es-AR')}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>- Egresos y Adelantos en Efectivo:</span>
                <span style={{ fontWeight: 700, color: '#fb7185' }}>-${report.egresosPagadosEnEfectivo.toLocaleString('es-AR')}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', fontSize: '1.1rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>💵 Efectivo Físico en Cajón:</span>
                <span style={{ fontWeight: 800, color: '#34d399' }}>${report.saldoEfectivoCaja.toLocaleString('es-AR')}</span>
              </div>
            </div>
          </div>

        </div>
      ) : (
        <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px', color: 'var(--text-muted)' }}>
          No hay movimientos cargados para este período. La conciliación bancaria y la liquidación diaria aparecerán cuando se registren ventas o egresos.
        </div>
      )}

      {/* TABLE LIQUIDACIÓN DE BARBEROS */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={22} />
              Liquidación de Sueldos & Comisiones por Día
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Se muestran los cortes y la comisión del 40% por fecha, no el acumulado mensual.
            </p>
          </div>
          <span className="badge badge-gold">Comisión de cada día</span>
        </div>

        {report.dailyBarberStats.length > 0 ? (
          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Barbero</th>
                  <th>Cortes</th>
                  <th>Facturación</th>
                  <th>Comisión 40%</th>
                  <th>Propinas</th>
                  <th>Ganancia Total</th>
                  <th>Adelantos</th>
                  <th>Saldo Neto</th>
                </tr>
              </thead>
              <tbody>
                {report.dailyBarberStats.map(item => (
                  <tr key={`${item.date}-${item.barberId}`}>
                    <td>{formatDateLabel(item.date)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.barberName}</td>
                    <td>{item.clientesAtendidos}</td>
                    <td>${item.facturadoServicios.toLocaleString('es-AR')}</td>
                    <td style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>${item.comisionServicios.toLocaleString('es-AR')}</td>
                    <td style={{ color: '#34d399', fontWeight: 700 }}>+${item.propinasRecibidas.toLocaleString('es-AR')}</td>
                    <td style={{ color: '#34d399', fontWeight: 700 }}>${item.totalGananciaCalculada.toLocaleString('es-AR')}</td>
                    <td style={{ color: '#fb7185', fontWeight: 700 }}>-${item.adelantosRecibidos.toLocaleString('es-AR')}</td>
                    <td style={{ color: item.saldoNetoAPagarEfectivo >= 0 ? '#38bdf8' : '#f43f5e', fontWeight: 800 }}>
                      ${item.saldoNetoAPagarEfectivo.toLocaleString('es-AR')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', padding: '20px 0' }}>
            No hay registros diarios para mostrar en esta fecha o mes.
          </div>
        )}
      </div>

      {/* CHARTS DASHBOARD */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        
        {/* Gráfico 1: Facturación por Barbero */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={20} style={{ color: 'var(--accent-gold)' }} />
            Rendimiento por Barbero (Servicios vs Total Ganancia)
          </h3>
          <div style={{ height: '260px' }}>
            {chartsReady && Bar ? (
              <Bar 
                data={barData} 
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  plugins: { legend: { labels: { color: '#94a3b8' } } },
                  scales: {
                    x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                    y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                  }
                }} 
              />
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Cargando gráficos…</div>
            )}
          </div>
        </div>

        {/* Gráfico 2: Distribución de Formas de Pago */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={20} style={{ color: '#06b6d4' }} />
            Distribución de Pagos (Efectivo vs Transferencia)
          </h3>
          <div style={{ height: '260px', display: 'flex', justifyContent: 'center' }}>
            {chartsReady && Pie ? (
              <Pie 
                data={pieData} 
                options={{ 
                  responsive: true, 
                  maintainAspectRatio: false,
                  plugins: { legend: { labels: { color: '#94a3b8' } } }
                }} 
              />
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Cargando gráficos…</div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
