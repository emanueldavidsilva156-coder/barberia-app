import { useEffect, useMemo, useState } from 'react';
import { store } from '../services/store.js';
import { useStoreVersion } from '../services/useStore.js';
import { daySummary, byBarber, money } from '../services/finance.js';
import { formatTime, isBirthdayOn, monthOf, todayISO } from '../services/dates.js';
import {
  UserPlus, DollarSign, CreditCard, Wallet, Calendar, PlusCircle,
  Ban, Scissors, ArrowDownCircle, CheckCircle2, Gift, Edit2, Cake, Search, MessageSquare, Sparkles, Lock
} from 'lucide-react';

const EXPENSE_CATEGORIES = {
  insumos: '🧴 Insumos (navajas, champú, etc.)',
  agua: '🚰 Bidón de agua / bebidas',
  limpieza: '🧹 Limpieza',
  varios: '📦 Gastos varios',
  adelanto: '💸 Adelanto de sueldo'
};

const whatsappPhone = (phone) => {
  let clean = (phone || '').replace(/[^0-9]/g, '');
  if (clean.length === 10 && !clean.startsWith('54')) clean = '549' + clean;
  return clean;
};

const loadedBy = (row) => {
  const parts = [`Cargó ${store.userName(row.created_by)} ${formatTime(row.created_at)}`];
  if (row.updated_by) parts.push(`corrigió ${store.userName(row.updated_by)} ${formatTime(row.updated_at)}`);
  return parts.join(' · ');
};

export default function DailyCashRegister() {
  useStoreVersion();
  const profile = store.profile;
  const isAdmin = store.isAdmin;
  const today = todayISO();
  const [selectedDate, setSelectedDate] = useState(today);
  const selectedMonth = monthOf(selectedDate);
  const isClosed = store.isMonthClosed(selectedMonth);
  const isToday = selectedDate === today;
  const canLoad = !isClosed && (isAdmin || isToday);

  const barbers = store.barbers();
  const services = store.services();
  const customers = store.customers();
  const partners = store.partners();
  const day = store.day(selectedDate);
  const summary = daySummary(day);
  const barberTotals = byBarber(day.sales, store.barbers({ includeInactive: true }));

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState('ingresos');

  // Venta
  const [selectedBarber, setSelectedBarber] = useState(profile.barber_id || '');
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientBirthdate, setClientBirthdate] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [tipAmount, setTipAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('transferencia');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);

  // Egreso / adelanto
  const [expenseCategory, setExpenseCategory] = useState('insumos');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState('efectivo');
  const [expenseChargedTo, setExpenseChargedTo] = useState('');
  const [advanceBarberId, setAdvanceBarberId] = useState(profile.barber_id || '');

  // Corrección
  const [editing, setEditing] = useState(null); // { kind: 'sale' | 'expense' | 'advance', row }

  useEffect(() => {
    store.ensureMonth(selectedMonth).catch(store.reportError);
  }, [selectedMonth]);

  useEffect(() => {
    if (!selectedBarber && barbers.length > 0) setSelectedBarber(barbers[0].id);
    if (!advanceBarberId && barbers.length > 0) setAdvanceBarberId(barbers[0].id);
    if (!selectedServiceId && services.length > 0) {
      setSelectedServiceId(services[0].id);
      setAmount(String(services[0].price));
    }
  }, [barbers, services, selectedBarber, advanceBarberId, selectedServiceId]);

  const suggestions = useMemo(() => {
    const term = clientName.trim().toLowerCase();
    if (!term) return [];
    return customers
      .filter(customer => customer.name.toLowerCase().includes(term) || customer.phone.includes(term))
      .slice(0, 8);
  }, [clientName, customers]);

  const canEdit = (row) => !row.voided && !isClosed && (isAdmin || row.movement_date === today);

  const runSave = async (action) => {
    setIsSaving(true);
    setFormError('');
    try {
      await action();
      return true;
    } catch (error) {
      setFormError(error.message);
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectCustomer = (customer) => {
    setClientName(customer.name);
    setClientPhone(customer.phone || '');
    setClientBirthdate(customer.birthdate || '');
    setSelectedCustomer(customer);
    setShowSuggestions(false);
  };

  const handleServiceSelect = (serviceId) => {
    setSelectedServiceId(serviceId);
    const found = services.find(service => service.id === serviceId);
    if (found) setAmount(String(found.price));
  };

  const handleAddSale = async (event) => {
    event.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    const service = services.find(item => item.id === selectedServiceId);
    const saved = await runSave(() => store.addSale({
      movement_date: selectedDate,
      barber_id: selectedBarber,
      clientName: clientName.trim(),
      clientPhone: clientPhone.trim(),
      birthdate: clientBirthdate.trim(),
      service_id: service?.id || null,
      service_name: service?.name || 'Servicio Barbería',
      amount: Number(amount),
      tip: Number(tipAmount) || 0,
      payment_method: paymentMethod
    }));
    if (!saved) return;
    setClientName('');
    setClientPhone('');
    setClientBirthdate('');
    setTipAmount('');
    setSelectedCustomer(null);
    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2500);
  };

  const handleAddExpense = async (event) => {
    event.preventDefault();
    if (!expenseAmount || Number(expenseAmount) <= 0) return;
    const saved = await runSave(() => {
      if (expenseCategory === 'adelanto') {
        return store.addAdvance({
          movement_date: selectedDate,
          barber_id: isAdmin ? advanceBarberId : profile.barber_id,
          amount: Number(expenseAmount),
          payment_method: expensePaymentMethod,
          note: expenseDesc.trim()
        });
      }
      let description = expenseDesc.trim();
      if (!description) description = expenseCategory === 'agua' ? 'Bidón de agua' : 'Gasto varios';
      return store.addExpense({
        movement_date: selectedDate,
        category: expenseCategory,
        description,
        amount: Number(expenseAmount),
        payment_method: expensePaymentMethod,
        charged_to_barber_id: expenseChargedTo || null
      });
    });
    if (!saved) return;
    setExpenseDesc('');
    setExpenseAmount('');
    setExpenseChargedTo('');
  };

  const handleVoid = async (kind, row) => {
    const reason = window.prompt('Motivo de la anulación (queda registrado):');
    if (!reason || !reason.trim()) return;
    const action = { sale: store.voidSale, expense: store.voidExpense, advance: store.voidAdvance }[kind];
    await runSave(() => action(row.id, reason.trim()));
  };

  const handleSendBirthdayWhatsApp = () => {
    if (!clientPhone) {
      alert('Por favor ingresá el número de celular del cliente.');
      return;
    }
    const msg = `¡Hola ${clientName || 'estimado/a'}! 🥳🎂 En la barbería queremos desearte un muy ¡Feliz Cumpleaños! Hoy tenés un beneficio/regalo especial en tu corte. Respondé este mensaje para agendar. ¡Te esperamos! ✂️💈`;
    window.open(`https://wa.me/${whatsappPhone(clientPhone)}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const serviceItems = services.filter(service => service.type === 'servicio');
  const productItems = services.filter(service => service.type === 'producto');
  const isCurrentClientBirthday = isBirthdayOn(clientBirthdate, selectedDate);
  const outflows = [
    ...day.expenses.map(row => ({ kind: 'expense', row })),
    ...day.advances.map(row => ({ kind: 'advance', row }))
  ].sort((first, second) => second.row.created_at.localeCompare(first.row.created_at));
  const sortedSales = day.sales.slice().sort((first, second) => second.created_at.localeCompare(first.created_at));

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>

      {showSuccessToast && (
        <div style={{
          position: 'fixed', top: '80px', right: '20px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: '#fff',
          padding: '12px 20px', borderRadius: 'var(--radius-sm)', boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
          zIndex: 1000, display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600
        }}>
          <CheckCircle2 size={20} />
          ¡Guardado! Ya lo ven todos los celulares.
        </div>
      )}

      {/* Encabezado y fecha */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar style={{ color: 'var(--accent-gold)' }} />
            Planilla de Caja Diaria
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Todo lo que se carga acá lo ve el equipo al instante
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Fecha:</label>
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(event) => event.target.value && setSelectedDate(event.target.value)}
            disabled={!isAdmin}
            className="form-input"
            style={{ width: 'auto', padding: '8px 12px', background: 'var(--bg-card)', color: 'var(--accent-gold)', fontWeight: 700 }}
          />
        </div>
      </div>

      {isClosed && (
        <div className="glass-panel" style={{ padding: '12px 18px', marginBottom: '20px', borderLeft: '4px solid #a78bfa', display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-main)' }}>
          <Lock size={18} style={{ color: '#a78bfa' }} />
          Este mes está cerrado: se puede consultar pero no modificar.
        </div>
      )}

      {formError && (
        <div role="alert" className="glass-panel" style={{ padding: '12px 18px', marginBottom: '20px', borderLeft: '4px solid #f43f5e', color: '#fecdd3' }}>
          No se guardó: {formError}
        </div>
      )}

      {/* Totales del día */}
      <div className="stats-grid" style={{ marginBottom: '16px' }}>
        <div className="stat-card">
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Cobrado</span>
            <h3 style={{ fontSize: '1.6rem', color: 'var(--accent-gold)', marginTop: '4px' }}>{money(summary.total)}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Servicios: {money(summary.services)} | Propinas: {money(summary.tips)}
            </span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-gold)' }}>
            <DollarSign size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Efectivo Cobrado</span>
            <h3 style={{ fontSize: '1.6rem', color: '#34d399', marginTop: '4px' }}>{money(summary.cashIn)}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Neto en caja hoy: {money(summary.cashNet)}</span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <Wallet size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Transferencias</span>
            <h3 style={{ fontSize: '1.6rem', color: '#38bdf8', marginTop: '4px' }}>{money(summary.transferIn)}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cuenta bancaria</span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8' }}>
            <CreditCard size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Egresos del Día</span>
            <h3 style={{ fontSize: '1.6rem', color: '#fb7185', marginTop: '4px' }}>{money(summary.outTotal)}</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Gastos: {money(summary.expensesTotal)} | Adelantos: {money(summary.advancesTotal)}
            </span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185' }}>
            <ArrowDownCircle size={24} />
          </div>
        </div>
      </div>

      {barberTotals.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '24px' }}>
          {barberTotals.map(item => (
            <span key={item.barberId} className="badge badge-gold" style={{ fontSize: '0.85rem', padding: '6px 12px' }}>
              ✂️ {item.name}: {item.count} {item.count === 1 ? 'trabajo' : 'trabajos'} · {money(item.total)}
            </span>
          ))}
        </div>
      )}

      <div className="daily-layout" style={{ gap: '24px' }}>
        <div className="toggle-group" style={{ maxWidth: '400px', margin: '0 auto 12px auto' }}>
          <button className={`toggle-btn ${activeSubTab === 'ingresos' ? 'active' : ''}`} onClick={() => setActiveSubTab('ingresos')}>
            + Ventas ({summary.count})
          </button>
          <button
            className={`toggle-btn ${activeSubTab === 'egresos' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('egresos')}
            style={activeSubTab === 'egresos' ? { background: '#f43f5e' } : {}}
          >
            - Egresos / Adelantos ({outflows.length})
          </button>
        </div>

        {activeSubTab === 'ingresos' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>

            {canLoad && (
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '18px', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <UserPlus size={20} />
                  Nuevo Trabajo / Venta de Producto
                </h3>

                <form onSubmit={handleAddSale}>
                  <div className="form-group">
                    <label className="form-label">Barbero a cargo</label>
                    <select value={selectedBarber} onChange={(event) => setSelectedBarber(event.target.value)} className="form-select" required>
                      {barbers.map(barber => <option key={barber.id} value={barber.id}>{barber.name}</option>)}
                    </select>
                  </div>

                  <div className="form-group" style={{ position: 'relative' }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Nombre Cliente (Buscador)</span>
                      <Search size={14} style={{ color: 'var(--accent-gold)' }} />
                    </label>
                    <input
                      type="text"
                      placeholder="Escribí para buscar cliente en la base..."
                      value={clientName}
                      onChange={(event) => { setClientName(event.target.value); setSelectedCustomer(null); setShowSuggestions(true); }}
                      onFocus={() => setShowSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      className="form-input"
                    />
                    {showSuggestions && suggestions.length > 0 && (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-card)',
                        border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow-card)',
                        zIndex: 100, maxHeight: '200px', overflowY: 'auto'
                      }}>
                        {suggestions.map(customer => (
                          <div
                            key={customer.id}
                            onMouseDown={(event) => { event.preventDefault(); handleSelectCustomer(customer); }}
                            style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                          >
                            <div>
                              <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>{customer.name}</strong>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{customer.phone || 'Sin tel'}</div>
                            </div>
                            <span className="badge badge-gold" style={{ fontSize: '0.72rem' }}>{customer.visit_count} visitas</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {selectedCustomer && (
                    <div style={{ background: 'rgba(217, 119, 6, 0.1)', border: '1px solid rgba(217, 119, 6, 0.3)', borderRadius: 'var(--radius-sm)', padding: '12px', marginBottom: '14px', fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontWeight: 600, flexWrap: 'wrap', gap: '6px' }}>
                        <span>📊 Visitas este mes: <strong style={{ color: 'var(--accent-gold)' }}>{store.monthSalesForCustomer(selectedCustomer.id, selectedMonth)}</strong></span>
                        <span>Total histórico: <strong style={{ color: '#38bdf8' }}>{selectedCustomer.visit_count}</strong></span>
                      </div>
                    </div>
                  )}

                  {isCurrentClientBirthday && (
                    <div style={{
                      background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(219, 39, 119, 0.2) 100%)',
                      border: '1px solid rgba(236, 72, 153, 0.5)', borderRadius: 'var(--radius-sm)', padding: '14px',
                      marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '10px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f472b6', fontWeight: 700, fontSize: '0.95rem' }}>
                        <Cake size={20} />
                        ¡HOY ES EL CUMPLEAÑOS DE {clientName.toUpperCase()}! 🎂
                      </div>
                      <button type="button" onClick={handleSendBirthdayWhatsApp} className="btn btn-whatsapp btn-sm" style={{ alignSelf: 'flex-start' }}>
                        <MessageSquare size={14} /> Enviar Saludo y Beneficio por WhatsApp
                      </button>
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Celular Cliente</label>
                      <input type="tel" placeholder="ej. 3511234567" value={clientPhone} onChange={(event) => setClientPhone(event.target.value)} className="form-input" />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Cake size={13} style={{ color: '#f472b6' }} /> Cumpleaños (MM-DD)
                      </label>
                      <input type="text" placeholder="ej. 09-13 (Mes-Día)" value={clientBirthdate} onChange={(event) => setClientBirthdate(event.target.value)} className="form-input" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Servicio o Producto Realizado</label>
                    <select value={selectedServiceId} onChange={(event) => handleServiceSelect(event.target.value)} className="form-select">
                      <optgroup label="✂️ SERVICIOS DE BARBERÍA">
                        {serviceItems.map(service => (
                          <option key={service.id} value={service.id}>{service.name} ({money(service.price)})</option>
                        ))}
                      </optgroup>
                      {productItems.length > 0 && (
                        <optgroup label="🧴 PRODUCTOS A LA VENTA">
                          {productItems.map(product => (
                            <option key={product.id} value={product.id}>{product.name} ({money(product.price)})</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Precio ($)</label>
                      <input type="number" min="1" step="any" placeholder="Monto" value={amount} onChange={(event) => setAmount(event.target.value)} className="form-input" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-gold)' }} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Gift size={13} /> Propina ($) (100% Barbero)
                      </label>
                      <input type="number" min="0" step="any" placeholder="ej. 500" value={tipAmount} onChange={(event) => setTipAmount(event.target.value)} className="form-input" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Forma de Pago</label>
                    <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="form-select" style={{ fontWeight: 600 }}>
                      <option value="transferencia">💳 Transferencia Bancaria</option>
                      <option value="efectivo">💵 Efectivo</option>
                    </select>
                  </div>

                  <button type="submit" disabled={isSaving} className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '8px' }}>
                    <PlusCircle size={20} />
                    {isSaving ? 'Guardando…' : 'Guardar en Caja Diaria'}
                  </button>
                </form>
              </div>
            )}

            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Ventas del día ({summary.count})</span>
                <span className="badge badge-gold">{money(summary.total)}</span>
              </h3>

              {sortedSales.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <Scissors size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p>No hay ventas para esta fecha.</p>
                </div>
              ) : (
                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Barbero</th>
                        <th>Item</th>
                        <th>Total</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSales.map(sale => {
                        const total = Number(sale.amount) + Number(sale.tip);
                        const voidedStyle = sale.voided ? { opacity: 0.5, textDecoration: 'line-through' } : {};
                        return (
                          <tr key={sale.id}>
                            <td style={voidedStyle}>
                              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {sale.client_name}
                                {isBirthdayOn(customers.find(c => c.id === sale.customer_id)?.birthdate, selectedDate) && <Cake size={14} style={{ color: '#f472b6' }} />}
                              </div>
                              {sale.client_phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{sale.client_phone}</div>}
                            </td>
                            <td style={voidedStyle}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-gold)' }}>{store.barberName(sale.barber_id)}</span>
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>
                              <div style={voidedStyle}>{sale.service_name} ({money(sale.amount)}){Number(sale.tip) > 0 && <span style={{ color: '#34d399' }}> +{money(sale.tip)}</span>}</div>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>{loadedBy(sale)}</div>
                              {sale.voided && (
                                <div style={{ fontSize: '0.72rem', color: '#fb7185', marginTop: '3px' }}>
                                  Anulada por {store.userName(sale.voided_by)}: “{sale.void_reason}”
                                </div>
                              )}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--text-main)', ...voidedStyle }}>
                              {money(total)}
                              <div style={{ fontSize: '0.7rem', color: sale.payment_method === 'efectivo' ? '#34d399' : '#38bdf8' }}>
                                {sale.payment_method === 'efectivo' ? 'Efectivo' : 'Transf.'}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {canEdit(sale) && (
                                  <button onClick={() => setEditing({ kind: 'sale', row: sale })} className="btn btn-outline btn-sm" style={{ borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)', padding: '6px' }} title="Corregir">
                                    <Edit2 size={14} />
                                  </button>
                                )}
                                {isAdmin && !sale.voided && !isClosed && (
                                  <button onClick={() => handleVoid('sale', sale)} className="btn btn-danger btn-sm" style={{ padding: '6px' }} title="Anular">
                                    <Ban size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {activeSubTab === 'egresos' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>

            {canLoad && (
              <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid #f43f5e' }}>
                <h3 style={{ fontSize: '1.15rem', marginBottom: '18px', color: '#fb7185', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ArrowDownCircle size={20} />
                  Anotar Salida de Dinero / Adelanto
                </h3>

                <form onSubmit={handleAddExpense}>
                  <div className="form-group">
                    <label className="form-label">Tipo de Egreso</label>
                    <select value={expenseCategory} onChange={(event) => setExpenseCategory(event.target.value)} className="form-select">
                      {Object.entries(EXPENSE_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>

                  {expenseCategory === 'adelanto' ? (
                    <div className="form-group">
                      <label className="form-label">Barbero que recibe el adelanto</label>
                      <select
                        value={isAdmin ? advanceBarberId : profile.barber_id}
                        onChange={(event) => setAdvanceBarberId(event.target.value)}
                        className="form-select"
                        disabled={!isAdmin}
                        required
                      >
                        {barbers.map(barber => <option key={barber.id} value={barber.id}>{barber.name}</option>)}
                      </select>
                      {!isAdmin && <small style={{ color: 'var(--text-muted)' }}>Cada barbero carga solo sus propios adelantos.</small>}
                    </div>
                  ) : (
                    <div className="form-group">
                      <label className="form-label">¿A quién corresponde?</label>
                      <select value={expenseChargedTo} onChange={(event) => setExpenseChargedTo(event.target.value)} className="form-select">
                        <option value="">🤝 Sociedad (se divide en partes iguales entre {partners.map(partner => partner.name).join(' y ')})</option>
                        {partners.map(partner => <option key={partner.id} value={partner.id}>👤 Solo {partner.name}</option>)}
                      </select>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label">Detalle / Concepto</label>
                    <input
                      type="text"
                      placeholder={expenseCategory === 'adelanto' ? 'ej. Adelanto para transporte' : 'ej. 2 bidones de agua'}
                      value={expenseDesc}
                      onChange={(event) => setExpenseDesc(event.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Monto ($)</label>
                      <input type="number" min="1" step="any" placeholder="Monto" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} className="form-input" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fb7185' }} required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sale de</label>
                      <select value={expensePaymentMethod} onChange={(event) => setExpensePaymentMethod(event.target.value)} className="form-select">
                        <option value="efectivo">💵 Caja chica (efectivo)</option>
                        <option value="banco">💳 Cuenta bancaria</option>
                      </select>
                    </div>
                  </div>

                  <button type="submit" disabled={isSaving} className="btn btn-danger btn-lg" style={{ width: '100%', marginTop: '8px' }}>
                    <ArrowDownCircle size={20} />
                    {isSaving ? 'Guardando…' : 'Guardar Egreso'}
                  </button>
                </form>
              </div>
            )}

            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Egresos del día ({outflows.length})</span>
                <span className="badge badge-egreso">{money(summary.outTotal)}</span>
              </h3>

              {outflows.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <ArrowDownCircle size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p>No hay egresos anotados en esta fecha.</p>
                </div>
              ) : (
                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Concepto</th>
                        <th>Origen</th>
                        <th>Monto</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outflows.map(({ kind, row }) => {
                        const voidedStyle = row.voided ? { opacity: 0.5, textDecoration: 'line-through' } : {};
                        const title = kind === 'advance'
                          ? `Adelanto de sueldo - ${store.barberName(row.barber_id)}`
                          : row.description;
                        const detail = kind === 'advance'
                          ? row.note
                          : `${EXPENSE_CATEGORIES[row.category] || row.category} · ${row.charged_to_barber_id ? `Solo ${store.barberName(row.charged_to_barber_id)}` : 'Sociedad'}`;
                        return (
                          <tr key={row.id}>
                            <td>
                              <div style={{ fontWeight: 600, color: '#fb7185', ...voidedStyle }}>{title}</div>
                              {detail && <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', ...voidedStyle }}>{detail}</div>}
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '3px' }}>{loadedBy(row)}</div>
                              {row.voided && (
                                <div style={{ fontSize: '0.72rem', color: '#fb7185', marginTop: '3px' }}>
                                  Anulado por {store.userName(row.voided_by)}: “{row.void_reason}”
                                </div>
                              )}
                            </td>
                            <td>
                              <span className={`badge ${row.payment_method === 'efectivo' ? 'badge-contado' : 'badge-transferencia'}`}>
                                {row.payment_method === 'efectivo' ? '💵 Caja' : '💳 Banco'}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, color: '#f43f5e', ...voidedStyle }}>-{money(row.amount)}</td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                {canEdit(row) && (
                                  <button onClick={() => setEditing({ kind, row })} className="btn btn-outline btn-sm" style={{ borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)', padding: '6px' }} title="Corregir">
                                    <Edit2 size={14} />
                                  </button>
                                )}
                                {isAdmin && !row.voided && !isClosed && (
                                  <button onClick={() => handleVoid(kind, row)} className="btn btn-danger btn-sm" style={{ padding: '6px' }} title="Anular">
                                    <Ban size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {editing && (
        <EditModal
          editing={editing}
          isAdmin={isAdmin}
          barbers={barbers}
          partners={partners}
          services={services}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EditModal({ editing, isAdmin, barbers, partners, services, onClose }) {
  const { kind, row } = editing;
  const [values, setValues] = useState(() => ({
    amount: row.amount,
    tip: row.tip ?? 0,
    service_name: row.service_name ?? '',
    payment_method: row.payment_method,
    barber_id: row.barber_id ?? '',
    clientName: row.client_name ?? '',
    clientPhone: row.client_phone ?? '',
    description: row.description ?? '',
    note: row.note ?? '',
    charged_to_barber_id: row.charged_to_barber_id ?? ''
  }));
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const set = (field) => (event) => setValues(current => ({ ...current, [field]: event.target.value }));

  const titles = { sale: `Corregir venta (${row.client_name})`, expense: 'Corregir gasto', advance: 'Corregir adelanto' };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!reason.trim()) {
      setError('Indicá el motivo de la corrección.');
      return;
    }
    if (!values.amount || Number(values.amount) <= 0) {
      setError('El monto debe ser mayor a 0.');
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      if (kind === 'sale') {
        const changes = {
          amount: Number(values.amount),
          tip: Number(values.tip) || 0,
          service_name: values.service_name.trim() || row.service_name,
          payment_method: values.payment_method
        };
        if (isAdmin) changes.barber_id = values.barber_id;
        if (values.clientName.trim() !== row.client_name || values.clientPhone.trim() !== row.client_phone) {
          changes.clientName = values.clientName.trim();
          changes.clientPhone = values.clientPhone.trim();
        }
        await store.updateSale(row.id, changes, reason.trim());
      } else if (kind === 'expense') {
        await store.updateExpense(row.id, {
          amount: Number(values.amount),
          description: values.description.trim() || row.description,
          payment_method: values.payment_method,
          charged_to_barber_id: values.charged_to_barber_id || null
        }, reason.trim());
      } else {
        const changes = {
          amount: Number(values.amount),
          note: values.note.trim(),
          payment_method: values.payment_method
        };
        if (isAdmin) changes.barber_id = values.barber_id;
        await store.updateAdvance(row.id, changes, reason.trim());
      }
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.75)',
      backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px'
    }}>
      <div className="glass-panel animate-scale-up" style={{ maxWidth: '520px', width: '100%', maxHeight: '90vh', overflowY: 'auto', padding: '24px', background: 'var(--bg-card)', border: '1px solid var(--accent-gold)' }}>
        <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-gold)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Edit2 size={20} />
          {titles[kind]}
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
          El valor anterior, quién corrigió, cuándo y el motivo quedan guardados en el historial.
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: kind === 'sale' ? '1fr 1fr' : '1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Monto ($)</label>
              <input type="number" min="1" step="any" value={values.amount} onChange={set('amount')} className="form-input" style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-gold)' }} required />
            </div>
            {kind === 'sale' && (
              <div className="form-group">
                <label className="form-label">Propina ($)</label>
                <input type="number" min="0" step="any" value={values.tip} onChange={set('tip')} className="form-input" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }} />
              </div>
            )}
          </div>

          {kind === 'sale' && (
            <>
              <div className="form-group">
                <label className="form-label">Servicio / Producto</label>
                <input type="text" list="service-names" value={values.service_name} onChange={set('service_name')} className="form-input" required />
                <datalist id="service-names">
                  {services.map(service => <option key={service.id} value={service.name} />)}
                </datalist>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Cliente</label>
                  <input type="text" value={values.clientName} onChange={set('clientName')} className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Celular</label>
                  <input type="tel" value={values.clientPhone} onChange={set('clientPhone')} className="form-input" />
                </div>
              </div>
            </>
          )}

          {kind === 'expense' && (
            <>
              <div className="form-group">
                <label className="form-label">Detalle</label>
                <input type="text" value={values.description} onChange={set('description')} className="form-input" required />
              </div>
              <div className="form-group">
                <label className="form-label">¿A quién corresponde?</label>
                <select value={values.charged_to_barber_id} onChange={set('charged_to_barber_id')} className="form-select">
                  <option value="">🤝 Sociedad</option>
                  {partners.map(partner => <option key={partner.id} value={partner.id}>👤 Solo {partner.name}</option>)}
                </select>
              </div>
            </>
          )}

          {kind === 'advance' && (
            <div className="form-group">
              <label className="form-label">Detalle</label>
              <input type="text" value={values.note} onChange={set('note')} className="form-input" />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: kind === 'expense' ? '1fr' : '1fr 1fr', gap: '12px' }}>
            {kind !== 'expense' && (
              <div className="form-group">
                <label className="form-label">Barbero</label>
                <select value={values.barber_id} onChange={set('barber_id')} className="form-select" disabled={!isAdmin}>
                  {barbers.map(barber => <option key={barber.id} value={barber.id}>{barber.name}</option>)}
                </select>
                {!isAdmin && <small style={{ color: 'var(--text-muted)' }}>Solo la administración cambia el barbero.</small>}
              </div>
            )}
            <div className="form-group">
              <label className="form-label">{kind === 'sale' ? 'Forma de pago' : 'Sale de'}</label>
              <select value={values.payment_method} onChange={set('payment_method')} className="form-select">
                {kind === 'sale' ? (
                  <>
                    <option value="transferencia">💳 Transferencia</option>
                    <option value="efectivo">💵 Efectivo</option>
                  </>
                ) : (
                  <>
                    <option value="efectivo">💵 Caja chica</option>
                    <option value="banco">💳 Banco</option>
                  </>
                )}
              </select>
            </div>
          </div>

          <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: '16px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} /> Corrige: {store.profile.display_name}
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ color: 'var(--text-main)' }}>Motivo de la corrección (obligatorio)</label>
              <input type="text" placeholder="ej. Cobro mal ingresado, descuento aplicado..." value={reason} onChange={(event) => setReason(event.target.value)} className="form-input" required />
            </div>
          </div>

          {error && <p role="alert" style={{ color: '#fb7185', fontSize: '0.85rem', marginBottom: '12px' }}>{error}</p>}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-outline">Cancelar</button>
            <button type="submit" disabled={isSaving} className="btn btn-primary">
              {isSaving ? 'Guardando…' : 'Guardar corrección'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
