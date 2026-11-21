import { useCallback, useEffect, useState } from 'react';
import { store } from '../services/store.js';
import { useDataChange, useStoreVersion } from '../services/useStore.js';
import { currentMonth, formatDate, formatDateTime, formatMonthName, todayISO } from '../services/dates.js';
import { money } from '../services/finance.js';
import {
  TrendingUp, Wallet, CreditCard, PieChart, BarChart2, PlusCircle, Trash2, Users, Home, Edit3,
  Lock, Handshake, Scale, Copy, Banknote, Ban
} from 'lucide-react';

let Pie = null;
let Bar = null;

const loadCharting = async () => {
  if (Pie && Bar) return;
  const chartJsModule = await import('chart.js');
  const chartjs2 = await import('react-chartjs-2');
  chartJsModule.Chart.register(
    chartJsModule.ArcElement, chartJsModule.Tooltip, chartJsModule.Legend, chartJsModule.CategoryScale,
    chartJsModule.LinearScale, chartJsModule.BarElement, chartJsModule.Title
  );
  Pie = chartjs2.Pie;
  Bar = chartjs2.Bar;
};

const WATCHED_TABLES = ['sales', 'expenses', 'salary_advances', 'barber_payments', 'fixed_expenses', 'reconciliations', 'month_closings', 'barbers'];

const Row = ({ label, value, color = 'var(--text-main)', strong = false }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)', padding: '6px 0', fontSize: strong ? '1.05rem' : '0.92rem' }}>
    <span style={{ color: strong ? 'var(--text-main)' : 'var(--text-muted)', fontWeight: strong ? 700 : 400 }}>{label}</span>
    <span style={{ fontWeight: strong ? 800 : 700, color }}>{value}</span>
  </div>
);

const periodLabel = (settlement) => `${formatDate(settlement.period_start).slice(0, 5)} al ${formatDate(settlement.period_end).slice(0, 5)}`;

export default function MonthlySummary() {
  useStoreVersion();
  const isAdmin = store.isAdmin;
  const today = todayISO();
  const [selectedMonth, setSelectedMonth] = useState(currentMonth());
  const [report, setReport] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [chartsReady, setChartsReady] = useState(false);
  const [paying, setPaying] = useState(null); // { barber, settlement }
  const [actionError, setActionError] = useState('');

  const loadReport = useCallback(() => {
    store.monthReport(selectedMonth)
      .then(data => { setReport(data); setLoadError(''); })
      .catch(error => setLoadError(error.message));
  }, [selectedMonth]);

  useEffect(() => {
    setReport(null);
    loadReport();
    store.ensureMonth(selectedMonth).catch(store.reportError);
    void loadCharting().then(() => setChartsReady(true));
  }, [loadReport, selectedMonth]);

  useDataChange(WATCHED_TABLES, loadReport);

  const runAction = async (action) => {
    setActionError('');
    try {
      await action();
      loadReport();
    } catch (error) {
      setActionError(error.message);
    }
  };

  if (loadError) {
    return <div className="glass-panel" style={{ maxWidth: '1200px', margin: '20px auto', padding: '24px', color: '#fb7185' }}>No se pudo cargar el resumen: {loadError}</div>;
  }
  if (!report) {
    return <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Calculando el resumen…</div>;
  }

  const isClosed = Boolean(report.closing);
  const canClose = isAdmin && !isClosed && report.month_end < today;
  const totals = report.totals;
  const society = report.society;
  const partnerById = Object.fromEntries((society?.partners || []).map(partner => [partner.barber_id, partner]));
  const payments = store.monthPayments(selectedMonth);

  const handleCloseMonth = () => {
    if (!window.confirm(`¿Cerrar ${formatMonthName(selectedMonth)}? Después nadie va a poder agregar ni corregir movimientos de ese mes, tampoco la administración.`)) return;
    void runAction(() => store.closeMonth(selectedMonth));
  };

  const handleVoidPayment = (payment) => {
    const reason = window.prompt('Motivo de la anulación del pago (queda registrado):');
    if (!reason || !reason.trim()) return;
    void runAction(() => store.voidPayment(payment.id, reason.trim()));
  };

  const pieData = {
    labels: ['Efectivo', 'Transferencias'],
    datasets: [{
      data: [totals.cash, totals.transfer],
      backgroundColor: ['#10b981', '#06b6d4'],
      borderColor: ['#059669', '#0891b2'],
      borderWidth: 1
    }]
  };

  const barData = {
    labels: report.barbers.map(barber => barber.name),
    datasets: [
      { label: 'Servicios facturados ($)', data: report.barbers.map(barber => barber.month.services), backgroundColor: 'rgba(217, 119, 6, 0.7)', borderColor: '#d97706', borderWidth: 1, borderRadius: 6 },
      { label: 'Ganancia barbero (50% + propinas)', data: report.barbers.map(barber => barber.month.gross), backgroundColor: 'rgba(16, 185, 129, 0.7)', borderColor: '#10b981', borderWidth: 1, borderRadius: 6 }
    ]
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>

      {/* Encabezado */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp style={{ color: 'var(--accent-gold)' }} />
            Resumen y Liquidación · <span style={{ textTransform: 'capitalize' }}>{formatMonthName(selectedMonth)}</span>
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Números calculados por la base de datos con todo lo cargado por el equipo
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Mes:</label>
          <input
            type="month"
            value={selectedMonth}
            max={currentMonth()}
            onChange={(event) => event.target.value && setSelectedMonth(event.target.value)}
            className="form-input"
            style={{ width: 'auto', padding: '8px 14px', background: 'var(--bg-card)', color: 'var(--accent-gold)', fontWeight: 700, fontSize: '1rem' }}
          />
          {canClose && (
            <button onClick={handleCloseMonth} className="btn btn-secondary" style={{ borderColor: '#a78bfa', color: '#a78bfa' }}>
              <Lock size={16} /> Cerrar mes
            </button>
          )}
        </div>
      </div>

      {isClosed && (
        <div className="glass-panel" style={{ padding: '12px 18px', marginBottom: '20px', borderLeft: '4px solid #a78bfa', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)' }}>
          <Lock size={18} style={{ color: '#a78bfa' }} />
          Mes cerrado por {report.closing.closed_by_name} el {formatDateTime(report.closing.closed_at)}. Solo lectura.
        </div>
      )}

      {actionError && (
        <div role="alert" className="glass-panel" style={{ padding: '12px 18px', marginBottom: '20px', borderLeft: '4px solid #f43f5e', color: '#fecdd3' }}>
          {actionError}
        </div>
      )}

      {/* Totales */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        <div className="stat-card"><div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Facturado del mes</span>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--accent-gold)', marginTop: '4px' }}>{money(totals.total)}</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Servicios {money(totals.services)} · Propinas {money(totals.tips)}</span>
        </div></div>
        <div className="stat-card"><div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Efectivo</span>
          <h3 style={{ fontSize: '1.5rem', color: '#34d399', marginTop: '4px' }}>{money(totals.cash)}</h3>
        </div></div>
        <div className="stat-card"><div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Transferencias</span>
          <h3 style={{ fontSize: '1.5rem', color: '#38bdf8', marginTop: '4px' }}>{money(totals.transfer)}</h3>
        </div></div>
        <div className="stat-card"><div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Clientes atendidos</span>
          <h3 style={{ fontSize: '1.5rem', color: 'var(--text-main)', marginTop: '4px' }}>{totals.count}</h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Ticket promedio {money(totals.ticket_avg)}</span>
        </div></div>
      </div>

      {/* Liquidación de barberos */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
          <Users size={22} /> Liquidación de barberos
        </h3>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
          50% de los cortes + propinas − adelantos − pagos ya hechos = saldo a pagar.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '18px' }}>
          {report.barbers.map(barber => {
            const month = barber.month;
            const partner = partnerById[barber.barber_id];
            const periods = barber.pay_frequency === 'weekly' ? barber.weeks : [month];
            return (
              <div key={barber.barber_id} style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>{barber.name}</strong>
                  <span className="badge badge-gold">
                    {Math.round(barber.commission_rate * 100)}% · {barber.pay_frequency === 'weekly' ? 'cobra los sábados' : 'cobra a fin de mes'}
                  </span>
                </div>

                <Row label={`Cortes del mes (${month.cuts})`} value={money(month.services)} />
                <Row label="50% de comisión" value={money(month.commission)} color="var(--accent-gold)" />
                <Row label="+ Propinas" value={money(month.tips)} color="#34d399" />
                <Row label="− Adelantos" value={`-${money(month.advances)}`} color="#fb7185" />

                {barber.is_partner && (
                  <Row label="Subtotal barbero" value={money(Number(month.gross) - Number(month.advances))} color="#38bdf8" strong />
                )}

                {!barber.is_partner && periods.map(settlement => {
                  const isPaid = Number(settlement.paid) > 0 && Number(settlement.balance) <= 0;
                  return (
                    <div key={settlement.period_start} style={{ marginTop: '12px', padding: '10px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${isPaid ? 'rgba(16,185,129,0.4)' : 'var(--border-color)'}` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <span>{barber.pay_frequency === 'weekly' ? `Semana ${periodLabel(settlement)}` : 'Como barbero'}</span>
                        <span>{isPaid ? '✅ Pagado' : 'Pendiente'}</span>
                      </div>
                      {barber.pay_frequency === 'weekly' && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          {settlement.cuts} cortes · comisión {money(settlement.commission)} · propinas {money(settlement.tips)} · adelantos -{money(settlement.advances)}
                        </div>
                      )}
                      {Number(settlement.paid) > 0 && <Row label="− Ya pagado" value={`-${money(settlement.paid)}`} color="#fb7185" />}
                      <Row label="Saldo a pagar" value={money(settlement.balance)} color={Number(settlement.balance) >= 0 ? '#38bdf8' : '#f43f5e'} strong />
                      {isAdmin && Number(settlement.balance) > 0 && settlement.period_end <= today && (
                        <button onClick={() => setPaying({ barber, settlement, amount: settlement.balance })} className="btn btn-primary btn-sm" style={{ marginTop: '8px', width: '100%' }}>
                          <Banknote size={14} /> Registrar pago
                        </button>
                      )}
                    </div>
                  );
                })}

                {partner && (
                  <div style={{ marginTop: '12px', padding: '10px', borderRadius: '6px', background: 'rgba(167, 139, 250, 0.08)', border: '1px solid rgba(167, 139, 250, 0.35)' }}>
                    <div style={{ fontSize: '0.82rem', color: '#c4b5fd', marginBottom: '4px' }}>Como socio</div>
                    <Row label="Mitad de la ganancia de la sociedad" value={money(partner.share)} />
                    <Row label="− Gastos personales" value={`-${money(partner.personal_expenses)}`} color="#fb7185" />
                    <Row label="Subtotal socio" value={money(partner.partner_net)} color="#c4b5fd" />
                    {Number(month.paid) > 0 && <Row label="− Ya pagado" value={`-${money(month.paid)}`} color="#fb7185" />}
                    <Row
                      label={`Saldo a pagar a ${barber.name}${Number(month.paid) > 0 && Number(partner.total) <= 0 ? ' ✅' : ''}`}
                      value={money(partner.total)}
                      color={Number(partner.total) >= 0 ? '#38bdf8' : '#f43f5e'}
                      strong
                    />
                    {isAdmin && Number(partner.total) > 0 && report.month_end <= today && (
                      <button onClick={() => setPaying({ barber, settlement: month, amount: partner.total })} className="btn btn-primary btn-sm" style={{ marginTop: '8px', width: '100%' }}>
                        <Banknote size={14} /> Registrar pago
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {payments.length > 0 && (
          <div style={{ marginTop: '22px' }}>
            <h4 style={{ color: 'var(--text-main)', marginBottom: '10px' }}>Pagos de sueldo registrados este mes</h4>
            <div className="custom-table-container">
              <table className="custom-table">
                <thead>
                  <tr><th>Fecha</th><th>Barbero</th><th>Período</th><th>Monto</th><th>Registró</th>{isAdmin && <th>Acción</th>}</tr>
                </thead>
                <tbody>
                  {payments.map(payment => (
                    <tr key={payment.id} style={payment.voided ? { opacity: 0.5, textDecoration: 'line-through' } : {}}>
                      <td>{formatDate(payment.movement_date)}</td>
                      <td style={{ fontWeight: 700 }}>{store.barberName(payment.barber_id)}</td>
                      <td>{periodLabel(payment)}</td>
                      <td style={{ fontWeight: 700 }}>{money(payment.amount)} <small style={{ color: 'var(--text-muted)' }}>{payment.payment_method === 'efectivo' ? 'caja' : 'banco'}</small></td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{store.userName(payment.created_by)}</td>
                      {isAdmin && (
                        <td>
                          {!payment.voided && !isClosed && (
                            <button onClick={() => handleVoidPayment(payment)} className="btn btn-danger btn-sm" style={{ padding: '6px' }} title="Anular pago">
                              <Ban size={14} />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Sociedad */}
      {society && (
        <SocietySection
          society={society}
          month={selectedMonth}
          isAdmin={isAdmin}
          isClosed={isClosed}
          runAction={runAction}
        />
      )}

      {/* Conciliación */}
      {report.money && (
        <ReconciliationSection report={report} isClosed={isClosed} runAction={runAction} />
      )}

      {/* Detalle por día */}
      <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px' }}>
        <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-gold)', marginBottom: '16px' }}>Detalle por día y barbero</h3>
        {report.daily.length > 0 ? (
          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr><th>Fecha</th><th>Barbero</th><th>Cortes</th><th>Facturación</th><th>Comisión 50%</th><th>Propinas</th><th>Adelantos</th></tr>
              </thead>
              <tbody>
                {report.daily.map(item => (
                  <tr key={`${item.date}-${item.barber_id}`}>
                    <td>{formatDate(item.date)}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.name}</td>
                    <td>{item.cuts}</td>
                    <td>{money(item.services)}</td>
                    <td style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>{money(item.commission)}</td>
                    <td style={{ color: '#34d399', fontWeight: 700 }}>+{money(item.tips)}</td>
                    <td style={{ color: '#fb7185', fontWeight: 700 }}>-{money(item.advances)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', padding: '20px 0' }}>No hay ventas cargadas en este mes.</div>
        )}
      </div>

      {/* Gráficos */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BarChart2 size={20} style={{ color: 'var(--accent-gold)' }} /> Rendimiento por barbero
          </h3>
          <div style={{ height: '260px' }}>
            {chartsReady && Bar ? (
              <Bar data={barData} options={{
                responsive: true, maintainAspectRatio: false,
                plugins: { legend: { labels: { color: '#94a3b8' } } },
                scales: {
                  x: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                  y: { ticks: { color: '#94a3b8' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                }
              }} />
            ) : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Cargando gráficos…</div>}
          </div>
        </div>
        <div className="glass-panel" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PieChart size={20} style={{ color: '#06b6d4' }} /> Efectivo vs transferencia
          </h3>
          <div style={{ height: '260px', display: 'flex', justifyContent: 'center' }}>
            {chartsReady && Pie ? (
              <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#94a3b8' } } } }} />
            ) : <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--text-muted)' }}>Cargando gráficos…</div>}
          </div>
        </div>
      </div>

      {paying && (
        <PaymentModal
          paying={paying}
          onClose={() => setPaying(null)}
          onSaved={() => { setPaying(null); loadReport(); }}
        />
      )}
    </div>
  );
}

function SocietySection({ society, month, isAdmin, isClosed, runAction }) {
  const [newName, setNewName] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newMethod, setNewMethod] = useState('banco');
  const canEdit = isAdmin && !isClosed;

  const handleAdd = (event) => {
    event.preventDefault();
    if (!newName.trim() || newAmount === '' || Number(newAmount) < 0) return;
    void runAction(async () => {
      await store.addFixedExpense({ movement_date: `${month}-01`, name: newName.trim(), amount: Number(newAmount), payment_method: newMethod });
      setNewName('');
      setNewAmount('');
    });
  };

  const handleEdit = (item) => {
    const value = window.prompt(`Nuevo monto para ${item.name}:`, item.amount);
    if (value === null || value === '' || Number(value) < 0) return;
    void runAction(() => store.updateFixedExpense(item.id, { amount: Number(value) }, 'Actualización de monto'));
  };

  const handleDelete = (item) => {
    if (!window.confirm(`¿Quitar ${item.name} de los gastos fijos de este mes? Queda registrado en el historial.`)) return;
    void runAction(() => store.deleteFixedExpense(item.id));
  };

  const handleCopy = () => {
    void runAction(async () => {
      const count = await store.copyFixedExpenses(month);
      alert(count > 0 ? `Se copiaron ${count} gastos fijos del mes anterior.` : 'No había gastos fijos nuevos para copiar.');
    });
  };

  return (
    <div className="glass-panel" style={{ padding: '24px', marginBottom: '28px', borderTop: '4px solid #a78bfa' }}>
      <h3 style={{ fontSize: '1.2rem', color: '#c4b5fd', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <Handshake size={22} /> Sociedad
      </h3>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Lo ven solo los socios. La parte de la casa es el 50% de todas las ventas que no va a los barberos.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
        <div>
          <Row label="Parte de la casa (50% de las ventas)" value={money(society.house_share)} color="var(--accent-gold)" />
          <Row label="− Gastos de la sociedad del mes" value={`-${money(society.society_expenses)}`} color="#fb7185" />
          <Row label="− Gastos fijos" value={`-${money(society.fixed_expenses)}`} color="#fb7185" />
          <Row label="= Ganancia de la sociedad" value={money(society.profit)} color={Number(society.profit) >= 0 ? '#34d399' : '#f43f5e'} strong />
          {society.partners.map(partner => (
            <Row key={partner.barber_id} label={`Le corresponde a ${partner.name}`} value={money(partner.share)} color="#c4b5fd" />
          ))}
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px', flexWrap: 'wrap' }}>
            <strong style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}><Home size={16} /> Gastos fijos del mes</strong>
            {canEdit && (
              <button onClick={handleCopy} className="btn btn-secondary btn-sm"><Copy size={13} /> Copiar del mes anterior</button>
            )}
          </div>
          {society.fixed_items.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hay gastos fijos cargados en este mes.</p>}
          {society.fixed_items.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ color: 'var(--text-main)' }}>{item.name} <small style={{ color: 'var(--text-muted)' }}>({item.payment_method === 'efectivo' ? 'caja' : 'banco'})</small></span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <strong style={{ color: '#fbbf24' }}>{money(item.amount)}</strong>
                {canEdit && (
                  <>
                    <button onClick={() => handleEdit(item)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px' }} title="Modificar monto"><Edit3 size={13} /></button>
                    <button onClick={() => handleDelete(item)} className="btn btn-secondary btn-sm" style={{ padding: '4px 8px', color: '#fb7185' }} title="Quitar"><Trash2 size={13} /></button>
                  </>
                )}
              </span>
            </div>
          ))}
          {canEdit && (
            <form onSubmit={handleAdd} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '8px', marginTop: '12px' }}>
              <input type="text" value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Ej. Alquiler" className="form-input" style={{ flex: '1 1 140px' }} />
              <input type="number" min="0" step="any" value={newAmount} onChange={(event) => setNewAmount(event.target.value)} placeholder="Monto" className="form-input" style={{ flex: '1 1 100px' }} />
              <select value={newMethod} onChange={(event) => setNewMethod(event.target.value)} className="form-select" style={{ flex: '1 1 100px' }}>
                <option value="banco">Banco</option>
                <option value="efectivo">Caja</option>
              </select>
              <button type="submit" className="btn btn-primary btn-sm"><PlusCircle size={14} /> Agregar</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ReconciliationSection({ report, isClosed, runAction }) {
  const defaultDate = report.month_end < report.today ? report.month_end : report.today;
  const [kind, setKind] = useState('caja');
  const [date, setDate] = useState(defaultDate);
  const [actual, setActual] = useState('');
  const [note, setNote] = useState('');
  const { money: flows } = report;

  const handleSubmit = (event) => {
    event.preventDefault();
    if (actual === '') return;
    void runAction(async () => {
      const saved = await store.addReconciliation({ kind, date, actual: Number(actual), note: note.trim() });
      setActual('');
      setNote('');
      const difference = Number(saved.difference);
      alert(difference === 0
        ? '✅ Coincide exactamente con lo esperado.'
        : `Diferencia de ${money(difference)} (${difference > 0 ? 'sobra' : 'falta'} dinero). Quedó registrada.`);
    });
  };

  return (
    <div style={{ marginBottom: '28px' }}>
      <h3 style={{ fontSize: '1.2rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <Scale size={22} style={{ color: 'var(--accent-gold)' }} /> Conciliación de caja chica y banco
      </h3>
      <div className="accounting-grid" style={{ marginBottom: '18px' }}>
        <MoneyCard title="Caja chica (efectivo)" icon={Wallet} color="#34d399" data={flows.caja} expected={flows.expected_caja} />
        <MoneyCard title="Cuenta bancaria" icon={CreditCard} color="#38bdf8" data={flows.banco} expected={flows.expected_banco} />
      </div>

      <div className="glass-panel" style={{ padding: '20px' }}>
        {!isClosed && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '10px', marginBottom: '16px' }}>
            <label style={{ flex: '1 1 140px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Qué conciliás
              <select value={kind} onChange={(event) => setKind(event.target.value)} className="form-select" style={{ marginTop: '5px' }}>
                <option value="caja">💵 Contar la caja</option>
                <option value="banco">💳 Saldo del banco</option>
              </select>
            </label>
            <label style={{ flex: '1 1 140px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Al día
              <input type="date" value={date} max={defaultDate} min={report.month_start} onChange={(event) => setDate(event.target.value)} className="form-input" style={{ marginTop: '5px' }} />
            </label>
            <label style={{ flex: '1 1 140px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {kind === 'caja' ? 'Efectivo contado ($)' : 'Saldo real del banco ($)'}
              <input type="number" step="any" value={actual} onChange={(event) => setActual(event.target.value)} className="form-input" style={{ marginTop: '5px' }} required />
            </label>
            <label style={{ flex: '2 1 200px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Nota (opcional)
              <input type="text" value={note} onChange={(event) => setNote(event.target.value)} className="form-input" style={{ marginTop: '5px' }} />
            </label>
            <button type="submit" className="btn btn-primary"><Scale size={16} /> Conciliar</button>
          </form>
        )}

        {flows.reconciliations.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Todavía no hay conciliaciones en este mes.</p>
        ) : (
          <div className="custom-table-container">
            <table className="custom-table">
              <thead><tr><th>Fecha</th><th>Tipo</th><th>Esperado</th><th>Real</th><th>Diferencia</th><th>Nota</th></tr></thead>
              <tbody>
                {flows.reconciliations.map(item => (
                  <tr key={item.id}>
                    <td>{formatDate(item.movement_date)}</td>
                    <td>{item.kind === 'caja' ? '💵 Caja' : '💳 Banco'}</td>
                    <td>{money(item.expected)}</td>
                    <td>{money(item.actual)}</td>
                    <td style={{ fontWeight: 800, color: Number(item.difference) === 0 ? '#34d399' : '#f43f5e' }}>{money(item.difference)}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{item.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MoneyCard({ title, icon: Icon, color, data, expected }) {
  return (
    <div className="glass-panel" style={{ padding: '20px', borderTop: `4px solid ${color}` }}>
      <h4 style={{ color, display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}><Icon size={18} /> {title}</h4>
      <Row label="+ Cobrado en el mes" value={money(data.sales_in)} color="#34d399" />
      <Row label="− Gastos" value={`-${money(data.expenses_out)}`} color="#fb7185" />
      <Row label="− Adelantos" value={`-${money(data.advances_out)}`} color="#fb7185" />
      <Row label="− Pagos de sueldo" value={`-${money(data.payments_out)}`} color="#fb7185" />
      <Row label="− Gastos fijos" value={`-${money(data.fixed_out)}`} color="#fb7185" />
      <Row label="Movimiento neto del mes" value={money(data.net)} strong />
      <div style={{ marginTop: '10px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        {expected.opening_date
          ? `Desde la última conciliación (${formatDate(expected.opening_date)}: ${money(expected.opening)}) debería haber`
          : 'Sin conciliaciones anteriores, debería haber'}
        {' '}al {formatDate(expected.as_of)}:
      </div>
      <div style={{ fontSize: '1.3rem', fontWeight: 800, color, marginTop: '4px' }}>{money(expected.expected)}</div>
    </div>
  );
}

function PaymentModal({ paying, onClose, onSaved }) {
  const { barber, settlement } = paying;
  const [amount, setAmount] = useState(String(paying.amount));
  const [method, setMethod] = useState('efectivo');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    setIsSaving(true);
    setError('');
    try {
      await store.addPayment({
        movement_date: todayISO(),
        barber_id: barber.barber_id,
        period_start: settlement.period_start,
        period_end: settlement.period_end,
        amount: Number(amount),
        payment_method: method,
        note: note.trim()
      });
      onSaved();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px' }}>
      <form onSubmit={handleSubmit} className="glass-panel animate-scale-up" style={{ maxWidth: '440px', width: '100%', padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--accent-gold)' }}>
        <h3 style={{ color: 'var(--accent-gold)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Banknote size={20} /> Pago a {barber.name}
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
          Período {periodLabel(settlement)}. Se descuenta de la caja o del banco y queda registrado.
        </p>
        <div className="form-group">
          <label className="form-label">Monto pagado ($)</label>
          <input type="number" min="1" step="any" value={amount} onChange={(event) => setAmount(event.target.value)} className="form-input" style={{ fontSize: '1.1rem', fontWeight: 700 }} required />
        </div>
        <div className="form-group">
          <label className="form-label">Sale de</label>
          <select value={method} onChange={(event) => setMethod(event.target.value)} className="form-select">
            <option value="efectivo">💵 Caja chica (efectivo)</option>
            <option value="banco">💳 Cuenta bancaria</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Nota (opcional)</label>
          <input type="text" value={note} onChange={(event) => setNote(event.target.value)} className="form-input" />
        </div>
        {error && <p role="alert" style={{ color: '#fb7185', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={onClose} className="btn btn-outline">Cancelar</button>
          <button type="submit" disabled={isSaving} className="btn btn-primary">{isSaving ? 'Guardando…' : 'Registrar pago'}</button>
        </div>
      </form>
    </div>
  );
}
