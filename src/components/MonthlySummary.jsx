import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { 
  TrendingUp, DollarSign, Wallet, CreditCard, PieChart, BarChart2, 
  CheckCircle, ArrowDownCircle, Users, Award, ShieldAlert, FileText, Gift, 
  ArrowUpRight, ArrowDownRight, Home, Shield, Wifi, Zap, Droplet, Edit3, Save 
} from 'lucide-react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function MonthlySummary() {
  const currentMonthStr = new Date().toISOString().substring(0, 7); // "YYYY-MM"
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [report, setReport] = useState(null);

  // Editable Bank Expenses local state
  const [isEditingBankExpenses, setIsEditingBankExpenses] = useState(false);
  const [bankExpensesInput, setBankExpensesInput] = useState('');

  // Editable Fixed Expenses local state
  const [editingFixedKey, setEditingFixedKey] = useState(null);
  const [fixedExpensesState, setFixedExpensesState] = useState({
    alquiler: 180000,
    alarma: 15000,
    internet: 20000,
    luz: 45000,
    dispenser_agua: 9000
  });

  useEffect(() => {
    loadMonthlyReport();
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

  const handleSaveBankExpenses = (newVal) => {
    storageService.setBankExpensesOverride(selectedMonth, newVal);
    loadMonthlyReport();
    setIsEditingBankExpenses(false);
  };

  if (!report) return null;

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

  const monthNames = {
    '01': 'Enero', '02': 'Febrero', '03': 'Marzo', '04': 'Abril',
    '05': 'Mayo', '06': 'Junio', '07': 'Julio', '08': 'Agosto',
    '09': 'Septiembre', '10': 'Octubre', '11': 'Noviembre', '12': 'Diciembre'
  };

  const [year, monthNum] = selectedMonth.split('-');
  const formattedMonthName = `${monthNames[monthNum] || monthNum} ${year}`;

  const [prevYear, prevMonthNum] = report.previousMonthStr.split('-');
  const formattedPrevMonthName = `${monthNames[prevMonthNum] || prevMonthNum} ${prevYear}`;

  const fixedItemsConfig = [
    { key: 'alquiler', name: 'Alquiler del Local', icon: Home, color: '#f59e0b' },
    { key: 'alarma', name: 'Alarma de Seguridad', icon: Shield, color: '#a78bfa' },
    { key: 'internet', name: 'Internet / WiFi', icon: Wifi, color: '#38bdf8' },
    { key: 'luz', name: 'Servicio de Luz', icon: Zap, color: '#fbbf24' },
    { key: 'dispenser_agua', name: 'Dispenser de Agua', icon: Droplet, color: '#06b6d4' }
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      
      {/* Header & Month Selector */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp style={{ color: 'var(--accent-gold)' }} />
            Resumen Mensual & Comparativa Contable
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Análisis de precisión contable para Administración Ema: Comparativa mensual, egresos fijos editables y saldos
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

      {/* COMPARATIVA CON MES ANTERIOR CARDS */}
      <div style={{ marginBottom: '28px' }}>
        <h3 style={{ fontSize: '1.15rem', color: 'var(--text-main)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <BarChart2 size={20} style={{ color: 'var(--accent-gold)' }} />
          Comparativa de Rendimiento ({formattedMonthName} vs {formattedPrevMonthName})
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          
          {/* Facturación Comparada */}
          <div className="glass-panel" style={{ padding: '18px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Facturación Total
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '6px' }}>
              <h4 style={{ fontSize: '1.5rem', color: 'var(--accent-gold)' }}>
                ${report.totalFacturadoMes.toLocaleString('es-AR')}
              </h4>
              <span className={`badge ${report.comparison.pctGrowthFacturado >= 0 ? 'badge-contado' : 'badge-egreso'}`}>
                {report.comparison.pctGrowthFacturado >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {report.comparison.pctGrowthFacturado >= 0 ? `+${report.comparison.pctGrowthFacturado}%` : `${report.comparison.pctGrowthFacturado}%`}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Mes anterior ({formattedPrevMonthName}): ${report.previousMetrics.totalFacturadoMes.toLocaleString('es-AR')}
            </div>
          </div>

          {/* Clientes Atendidos Comparados */}
          <div className="glass-panel" style={{ padding: '18px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Clientes Atendidos
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '6px' }}>
              <h4 style={{ fontSize: '1.5rem', color: '#38bdf8' }}>
                {report.totalClientesAtendidos} Clientes
              </h4>
              <span className={`badge ${report.comparison.pctGrowthClientes >= 0 ? 'badge-transferencia' : 'badge-egreso'}`}>
                {report.comparison.pctGrowthClientes >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {report.comparison.pctGrowthClientes >= 0 ? `+${report.comparison.pctGrowthClientes}%` : `${report.comparison.pctGrowthClientes}%`}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Mes anterior ({formattedPrevMonthName}): {report.previousMetrics.totalClientesAtendidos} Clientes
            </div>
          </div>

          {/* Ganancia Neta Barbería Comparada */}
          <div className="glass-panel" style={{ padding: '18px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
              Ganancia Neta Limpia (Barbería)
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: '6px' }}>
              <h4 style={{ fontSize: '1.5rem', color: '#a78bfa' }}>
                ${report.gananciaNetaBarberia.toLocaleString('es-AR')}
              </h4>
              <span className={`badge ${report.comparison.pctGrowthGananciaNeta >= 0 ? 'badge-contado' : 'badge-egreso'}`}>
                {report.comparison.pctGrowthGananciaNeta >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                {report.comparison.pctGrowthGananciaNeta >= 0 ? `+${report.comparison.pctGrowthGananciaNeta}%` : `${report.comparison.pctGrowthGananciaNeta}%`}
              </span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px' }}>
              Mes anterior ({formattedPrevMonthName}): ${report.previousMetrics.gananciaNetaBarberia.toLocaleString('es-AR')}
            </div>
          </div>

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
              Montos editables del mes que se descuentan de la ganancia neta de la barbería (60%)
            </p>
          </div>
          <span className="badge badge-egreso" style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
            Total Fijos: ${report.totalEgresosFijos.toLocaleString('es-AR')}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '14px' }}>
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ACCOUNTING CONCILIATION CARDS WITH EDITABLE BANK OUTFLOWS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '28px' }}>
        
        {/* Conciliación Bancaria (Transferencias) */}
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

            {/* Editable Bank Outflows */}
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

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '8px', fontSize: '1.1rem' }}>
              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>🏦 Dinero Esperado en Banco:</span>
              <span style={{ fontWeight: 800, color: '#38bdf8' }}>${report.saldoEsperadoBanco.toLocaleString('es-AR')}</span>
            </div>
          </div>
        </div>

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

      {/* TABLE LIQUIDACIÓN DE BARBEROS */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={22} />
              Liquidación de Sueldos & Comisiones (40% Servicios + 100% Propinas)
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              Fórmula: (40% Facturación Servicios) + (100% Propinas) - (Adelantos Tomados) = Saldo Neto a Pagar
            </p>
          </div>
          <span className="badge badge-gold">Propinas 100% para el Barbero</span>
        </div>

        <div className="custom-table-container">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Barbero</th>
                <th>Clientes</th>
                <th>Facturación Servicios</th>
                <th>Comisión (40%)</th>
                <th>Propinas (100%)</th>
                <th>Total Ganado</th>
                <th>Adelantos Tomados</th>
                <th>Saldo Neto a Pagar (Efectivo)</th>
              </tr>
            </thead>
            <tbody>
              {report.barberStats.map(b => (
                <tr key={b.barberId}>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                      {b.barberName}
                    </div>
                  </td>
                  <td>{b.clientesAtendidos}</td>
                  <td style={{ fontWeight: 600 }}>${b.facturadoServicios.toLocaleString('es-AR')}</td>
                  <td style={{ color: 'var(--accent-gold)' }}>${b.comisionServicios.toLocaleString('es-AR')}</td>
                  <td style={{ color: '#34d399', fontWeight: 600 }}>+${b.propinasRecibidas.toLocaleString('es-AR')}</td>
                  <td style={{ fontWeight: 700, color: '#34d399' }}>${b.totalGananciaCalculada.toLocaleString('es-AR')}</td>
                  <td style={{ fontWeight: 600, color: '#fb7185' }}>
                    -${b.adelantosRecibidos.toLocaleString('es-AR')}
                  </td>
                  <td>
                    <span style={{ 
                      fontSize: '1rem', 
                      fontWeight: 800, 
                      color: b.saldoNetoAPagarEfectivo >= 0 ? '#38bdf8' : '#f43f5e',
                      background: b.saldoNetoAPagarEfectivo >= 0 ? 'rgba(56, 189, 248, 0.12)' : 'rgba(244, 63, 94, 0.12)',
                      padding: '6px 12px',
                      borderRadius: '6px',
                      border: `1px solid ${b.saldoNetoAPagarEfectivo >= 0 ? 'rgba(56, 189, 248, 0.3)' : 'rgba(244, 63, 94, 0.3)'}`
                    }}>
                      ${b.saldoNetoAPagarEfectivo.toLocaleString('es-AR')}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
          </div>
        </div>

        {/* Gráfico 2: Distribución de Formas de Pago */}
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={20} style={{ color: '#06b6d4' }} />
            Distribución de Pagos (Efectivo vs Transferencia)
          </h3>
          <div style={{ height: '260px', display: 'flex', justifyContent: 'center' }}>
            <Pie 
              data={pieData} 
              options={{ 
                responsive: true, 
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8' } } }
              }} 
            />
          </div>
        </div>

      </div>

    </div>
  );
}
