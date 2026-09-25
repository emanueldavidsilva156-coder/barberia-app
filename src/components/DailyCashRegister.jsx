import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { 
  UserPlus, DollarSign, CreditCard, Wallet, Calendar, PlusCircle, 
  Trash2, Phone, Scissors, ArrowDownCircle, ArrowUpCircle, CheckCircle2, Gift, Edit2, ShoppingBag, Cake, Search, MessageSquare, Sparkles 
} from 'lucide-react';

export default function DailyCashRegister() {
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(todayStr);

  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [customersList, setCustomersList] = useState([]);
  const [dailySummary, setDailySummary] = useState(null);

  // Form states for Service Entry
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientBirthdate, setClientBirthdate] = useState(''); // "MM-DD" or "YYYY-MM-DD"
  const [selectedService, setSelectedService] = useState('');
  const [amount, setAmount] = useState('');
  const [tipAmount, setTipAmount] = useState(''); // Propina $
  const [paymentMethod, setPaymentMethod] = useState('transferencia');
  const [selectedBarber, setSelectedBarber] = useState('');
  const [showSuccessToast, setShowSuccessToast] = useState(false);

  // Customer Autocomplete & Stats State
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedCustomerStats, setSelectedCustomerStats] = useState(null);

  // Form states for Expense Entry
  const [expenseCategory, setExpenseCategory] = useState('insumos');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expensePaymentMethod, setExpensePaymentMethod] = useState('caja_efectivo');
  const [expenseBarberId, setExpenseBarberId] = useState('');

  // Active subtab: 'ingresos' | 'egresos'
  const [activeSubTab, setActiveSubTab] = useState('ingresos');

  // Edit Transaction Modal State
  const [editingTx, setEditingTx] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editTip, setEditTip] = useState('');
  const [editService, setEditService] = useState('');
  const [editPaymentMethod, setEditPaymentMethod] = useState('transferencia');
  const [editBarberId, setEditBarberId] = useState('');
  const [editedBy, setEditedBy] = useState('');
  const [editReason, setEditReason] = useState('');

  useEffect(() => {
    loadData();
  }, [selectedDate]);

  const loadData = () => {
    const loadedBarbers = storageService.getBarbers();
    const loadedServices = storageService.getServices();
    const loadedCustomers = storageService.getCustomers();

    setBarbers(loadedBarbers);
    setServices(loadedServices);
    setCustomersList(loadedCustomers);

    if (loadedBarbers.length > 0 && !selectedBarber) {
      setSelectedBarber(loadedBarbers[0].id);
    }
    if (loadedServices.length > 0 && !selectedService) {
      setSelectedService(loadedServices[0].name);
      setAmount(loadedServices[0].price);
    }

    const summary = storageService.getDailySummary(selectedDate);
    setDailySummary(summary);
  };

  // Handle Client Name Input & Autocomplete Search
  const handleClientNameChange = (val) => {
    setClientName(val);
    if (val.trim().length >= 1) {
      const matches = customersList.filter(c => 
        c.name.toLowerCase().includes(val.toLowerCase()) ||
        c.phone.includes(val)
      );
      setFilteredSuggestions(matches);
      setShowSuggestions(true);
    } else {
      setFilteredSuggestions([]);
      setShowSuggestions(false);
      setSelectedCustomerStats(null);
    }
  };

  // Select Customer from Suggestions
  const handleSelectCustomer = (cust) => {
    setClientName(cust.name);
    setClientPhone(cust.phone || '');
    setClientBirthdate(cust.birthdate || '');
    setShowSuggestions(false);

    // Calculate visits in month of selected date
    const selectedMonth = selectedDate.substring(0, 7);
    const monthlyVisits = storageService.getClientVisitsInMonth(cust.phone || cust.name, selectedMonth);

    setSelectedCustomerStats({
      totalVisits: cust.visitCount,
      monthlyVisits,
      birthdate: cust.birthdate,
      isBirthdayToday: storageService.isBirthdayToday(cust.birthdate, selectedDate)
    });
  };

  const handleServiceSelect = (e) => {
    const serviceName = e.target.value;
    setSelectedService(serviceName);
    const found = services.find(s => s.name === serviceName);
    if (found) {
      setAmount(found.price);
    }
  };

  const handleAddTransaction = (e) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;

    storageService.addTransaction({
      date: selectedDate,
      clientName: clientName.trim() || 'Cliente Ocasional',
      clientPhone: clientPhone.trim(),
      birthdate: clientBirthdate.trim(),
      service: selectedService || 'Servicio Barbería',
      amount: Number(amount),
      tip: Number(tipAmount) || 0,
      paymentMethod,
      barberId: selectedBarber
    });

    // Reset fields
    setClientName('');
    setClientPhone('');
    setClientBirthdate('');
    setTipAmount('');
    setSelectedCustomerStats(null);
    loadData();

    setShowSuccessToast(true);
    setTimeout(() => setShowSuccessToast(false), 2500);
  };

  const handleSendBirthdayWhatsApp = () => {
    if (!clientPhone) {
      alert('Por favor ingresá el número de celular del cliente.');
      return;
    }
    let cleanPhone = clientPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10 && !cleanPhone.startsWith('54')) {
      cleanPhone = '549' + cleanPhone;
    }

    const msg = `¡Hola ${clientName || 'estimado/a'}! 🥳🎂 En la barbería queremos desearte un muy ¡Feliz Cumpleaños! Hoy tenés un beneficio/regalo especial en tu corte. Respondé este mensaje para agendar. ¡Te esperamos! ✂️💈`;
    const encoded = encodeURIComponent(msg);
    window.open(`https://wa.me/${cleanPhone}?text=${encoded}`, '_blank');
  };

  const handleAddExpense = (e) => {
    e.preventDefault();
    if (!expenseAmount || Number(expenseAmount) <= 0) return;

    let desc = expenseDesc.trim();
    if (expenseCategory === 'agua' && !desc) desc = 'Bidón de Agua';
    if (expenseCategory === 'adelanto') {
      const b = barbers.find(x => x.id === expenseBarberId);
      desc = `Adelanto de Sueldo - ${b ? b.name : 'Barbero'}`;
    }
    if (!desc) desc = 'Gasto Varios';

    storageService.addExpense({
      date: selectedDate,
      category: expenseCategory,
      description: desc,
      amount: Number(expenseAmount),
      paymentMethod: expensePaymentMethod,
      barberId: expenseCategory === 'adelanto' ? expenseBarberId : null
    });

    setExpenseDesc('');
    setExpenseAmount('');
    loadData();
  };

  const handleOpenEditModal = (tx) => {
    setEditingTx(tx);
    setEditAmount(tx.amount || 0);
    setEditTip(tx.tip || 0);
    setEditService(tx.service || '');
    setEditPaymentMethod(tx.paymentMethod || 'transferencia');
    setEditBarberId(tx.barberId || (barbers[0] ? barbers[0].id : ''));
    setEditedBy('');
    setEditReason('');
  };

  const handleSaveEdit = (e) => {
    e.preventDefault();
    if (!editedBy.trim()) {
      alert('Por favor decinos quién realiza la modificación.');
      return;
    }
    if (!editReason.trim()) {
      alert('Por favor ingresá el motivo de la modificación.');
      return;
    }
    if (!editAmount || Number(editAmount) <= 0) {
      alert('El monto debe ser un número válido mayor a 0.');
      return;
    }

    storageService.updateTransaction(
      editingTx.id,
      {
        amount: Number(editAmount),
        tip: Number(editTip) || 0,
        service: editService,
        paymentMethod: editPaymentMethod,
        barberId: editBarberId
      },
      {
        editedBy: editedBy.trim(),
        editReason: editReason.trim()
      }
    );

    setEditingTx(null);
    loadData();
  };

  const handleDeleteTx = (id) => {
    if (window.confirm('¿Eliminar este registro de venta?')) {
      storageService.deleteTransaction(id);
      loadData();
    }
  };

  const handleDeleteEx = (id) => {
    if (window.confirm('¿Eliminar este egreso?')) {
      storageService.deleteExpense(id);
      loadData();
    }
  };

  if (!dailySummary) return null;

  const serviceItems = services.filter(s => (s.type || 'servicio') === 'servicio');
  const productItems = services.filter(s => s.type === 'producto');

  const isCurrentClientBirthday = storageService.isBirthdayToday(clientBirthdate, selectedDate);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      
      {/* Toast Notification */}
      {showSuccessToast && (
        <div style={{
          position: 'fixed',
          top: '80px',
          right: '20px',
          background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: 'var(--radius-sm)',
          boxShadow: '0 10px 25px rgba(16, 185, 129, 0.4)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600
        }}>
          <CheckCircle2 size={20} />
          ¡Registrado en caja correctamente!
        </div>
      )}

      {/* Header & Date Picker bar */}
      <div className="glass-panel" style={{ padding: '16px 20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Calendar style={{ color: 'var(--accent-gold)' }} />
            Planilla de Caja Diaria
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Buscador de clientes, control de visitas mensuales, alertas de cumpleaños y propinas
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Fecha:</label>
          <input 
            type="date" 
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="form-input"
            style={{ width: 'auto', padding: '8px 12px', background: 'var(--bg-card)', color: 'var(--accent-gold)', fontWeight: 700 }}
          />
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="stats-grid" style={{ marginBottom: '24px' }}>
        
        {/* Total Facturado */}
        <div className="stat-card">
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Total Cobrado Hoy</span>
            <h3 style={{ fontSize: '1.6rem', color: 'var(--accent-gold)', marginTop: '4px' }}>
              ${dailySummary.totalFacturadoTotal.toLocaleString('es-AR')}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Servicios: ${dailySummary.totalFacturadoServicios.toLocaleString('es-AR')} | Propinas: ${dailySummary.totalPropinas.toLocaleString('es-AR')}
            </span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-gold)' }}>
            <DollarSign size={24} />
          </div>
        </div>

        {/* Total Contado / Efectivo */}
        <div className="stat-card">
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Efectivo en Caja</span>
            <h3 style={{ fontSize: '1.6rem', color: '#34d399', marginTop: '4px' }}>
              ${dailySummary.totalContado.toLocaleString('es-AR')}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Caja Chica Físicos</span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
            <Wallet size={24} />
          </div>
        </div>

        {/* Total Transferencias */}
        <div className="stat-card">
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Transferencias</span>
            <h3 style={{ fontSize: '1.6rem', color: '#38bdf8', marginTop: '4px' }}>
              ${dailySummary.totalTransferencia.toLocaleString('es-AR')}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cuenta Bancaria</span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)', color: '#38bdf8' }}>
            <CreditCard size={24} />
          </div>
        </div>

        {/* Total Egresos */}
        <div className="stat-card">
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Egresos del Día</span>
            <h3 style={{ fontSize: '1.6rem', color: '#fb7185', marginTop: '4px' }}>
              ${dailySummary.totalEgresos.toLocaleString('es-AR')}
            </h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gastos + Adelantos</span>
          </div>
          <div className="stat-icon" style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#fb7185' }}>
            <ArrowDownCircle size={24} />
          </div>
        </div>

      </div>

      {/* Main Grid: Entry Forms & Lists */}
      <div className="daily-layout" style={{ gap: '24px' }}>
        
        {/* Toggle between Ingresos (Ventas) y Egresos */}
        <div className="toggle-group" style={{ maxWidth: '400px', margin: '0 auto 12px auto' }}>
          <button 
            className={`toggle-btn ${activeSubTab === 'ingresos' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('ingresos')}
          >
            + Cargar Venta / Servicio
          </button>
          <button 
            className={`toggle-btn ${activeSubTab === 'egresos' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('egresos')}
            style={activeSubTab === 'egresos' ? { background: '#f43f5e' } : {}}
          >
            - Anotar Egreso / Adelanto
          </button>
        </div>

        {/* SUBTAB INGRESOS */}
        {activeSubTab === 'ingresos' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            
            {/* Formulario Carga de Cliente */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '18px', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} />
                Nuevo Trabajo / Venta de Producto
              </h3>

              <form onSubmit={handleAddTransaction}>
                
                {/* Barbero a cargo */}
                <div className="form-group">
                  <label className="form-label">Barbero a cargo</label>
                  <select 
                    value={selectedBarber} 
                    onChange={(e) => setSelectedBarber(e.target.value)}
                    className="form-select"
                    required
                  >
                    {barbers.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* BUSCADOR DE CLIENTE CON AUTOCOMPLETADO */}
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Nombre Cliente (Buscador)</span>
                    <Search size={14} style={{ color: 'var(--accent-gold)' }} />
                  </label>
                  <input 
                    type="text"
                    placeholder="Escribí para buscar cliente en la base..."
                    value={clientName}
                    onChange={(e) => handleClientNameChange(e.target.value)}
                    onFocus={() => { if (filteredSuggestions.length > 0) setShowSuggestions(true); }}
                    className="form-input"
                  />

                  {/* Dropdown de sugerencias de clientes */}
                  {showSuggestions && filteredSuggestions.length > 0 && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0, right: 0,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius-sm)',
                      boxShadow: 'var(--shadow-card)',
                      zIndex: 100,
                      maxHeight: '180px',
                      overflowY: 'auto'
                    }}>
                      {filteredSuggestions.map(cust => (
                        <div 
                          key={cust.id}
                          onClick={() => handleSelectCustomer(cust)}
                          style={{
                            padding: '10px 14px',
                            cursor: 'pointer',
                            borderBottom: '1px solid rgba(255,255,255,0.05)',
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center'
                          }}
                          onMouseDown={(e) => e.preventDefault()}
                        >
                          <div>
                            <strong style={{ color: 'var(--text-main)', fontSize: '0.9rem' }}>{cust.name}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{cust.phone || 'Sin tel'}</div>
                          </div>
                          <span className="badge badge-gold" style={{ fontSize: '0.72rem' }}>
                            {cust.visitCount} visitas
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* REPORTE DE VISITAS Y ALERTA CUMPLEAÑOS */}
                {selectedCustomerStats && (
                  <div style={{
                    background: 'rgba(217, 119, 6, 0.1)',
                    border: '1px solid rgba(217, 119, 6, 0.3)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                    marginBottom: '14px',
                    fontSize: '0.85rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontWeight: 600 }}>
                      <span>📊 Visitas este mes: <strong style={{ color: 'var(--accent-gold)' }}>{selectedCustomerStats.monthlyVisits}</strong></span>
                      <span>Total histórico: <strong style={{ color: '#38bdf8' }}>{selectedCustomerStats.totalVisits}</strong></span>
                    </div>
                  </div>
                )}

                {/* ALERTA CUMPLEAÑOS DEL CLIENTE */}
                {isCurrentClientBirthday && (
                  <div style={{
                    background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.2) 0%, rgba(219, 39, 119, 0.2) 100%)',
                    border: '1px solid rgba(236, 72, 153, 0.5)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '14px',
                    marginBottom: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f472b6', fontWeight: 700, fontSize: '0.95rem' }}>
                      <Cake size={20} />
                      ¡HOY ES EL CUMPLEAÑOS DE {clientName.toUpperCase()}! 🎂
                    </div>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-main)', margin: 0 }}>
                      🎉 El cliente tiene un <strong>beneficio/descuento especial</strong> de regalo por su cumpleaños.
                    </p>
                    <button 
                      type="button"
                      onClick={handleSendBirthdayWhatsApp}
                      className="btn btn-whatsapp btn-sm"
                      style={{ alignSelf: 'flex-start' }}
                    >
                      <MessageSquare size={14} /> Enviar Saludo y Beneficio por WhatsApp
                    </button>
                  </div>
                )}

                {/* Datos Celular y Cumpleaños */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Celular Cliente</label>
                    <input 
                      type="tel"
                      placeholder="ej. 1123456789"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Cake size={13} style={{ color: '#f472b6' }} /> Cumpleaños (MM-DD)
                    </label>
                    <input 
                      type="text"
                      placeholder="ej. 09-13 (Mes-Día)"
                      value={clientBirthdate}
                      onChange={(e) => setClientBirthdate(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                {/* Selector Agrupado de Servicios y Productos */}
                <div className="form-group">
                  <label className="form-label">Servicio o Producto Realizado</label>
                  <select 
                    value={selectedService} 
                    onChange={handleServiceSelect}
                    className="form-select"
                  >
                    <optgroup label="✂️ SERVICIOS DE BARBERÍA">
                      {serviceItems.map(s => (
                        <option key={s.id} value={s.name}>
                          {s.name} (${s.price.toLocaleString('es-AR')})
                        </option>
                      ))}
                    </optgroup>
                    {productItems.length > 0 && (
                      <optgroup label="🧴 PRODUCTOS A LA VENTA">
                        {productItems.map(p => (
                          <option key={p.id} value={p.name}>
                            {p.name} (${p.price.toLocaleString('es-AR')})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Monto Servicio & Propina (100% Barbero) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Precio Item ($)</label>
                    <input 
                      type="number"
                      placeholder="Monto"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-gold)' }}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Gift size={13} /> Propina ($) (100% Barbero)
                    </label>
                    <input 
                      type="number"
                      placeholder="ej. 500"
                      value={tipAmount}
                      onChange={(e) => setTipAmount(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                    />
                  </div>
                </div>

                {/* Forma de Pago */}
                <div className="form-group">
                  <label className="form-label">Forma de Pago</label>
                  <select 
                    value={paymentMethod} 
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="form-select"
                    style={{ fontWeight: 600 }}
                  >
                    <option value="transferencia">💳 Transferencia Bancaria</option>
                    <option value="contado">💵 Contado / Efectivo</option>
                  </select>
                </div>

                <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%', marginTop: '8px' }}>
                  <PlusCircle size={20} />
                  Guardar en Caja Diaria
                </button>
              </form>
            </div>

            {/* Listado de Servicios del Día */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Registro de Hoy ({dailySummary.transactions.length})</span>
                <span className="badge badge-gold">${dailySummary.totalFacturadoTotal.toLocaleString('es-AR')}</span>
              </h3>

              {dailySummary.transactions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
                  <Scissors size={40} style={{ opacity: 0.3, marginBottom: '10px' }} />
                  <p>No hay registros para esta fecha.</p>
                </div>
              ) : (
                <div className="custom-table-container">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>Barbero</th>
                        <th>Item</th>
                        <th>Propina</th>
                        <th>Total</th>
                        <th>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dailySummary.transactions.map(tx => {
                        const barber = barbers.find(b => b.id === tx.barberId);
                        const totalTx = (Number(tx.amount) || 0) + (Number(tx.tip) || 0);
                        const isBirthday = storageService.isBirthdayToday(tx.birthdate, selectedDate);

                        return (
                          <tr key={tx.id}>
                            <td>
                              <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                {tx.clientName}
                                {isBirthday && <Cake size={14} style={{ color: '#f472b6' }} title="¡Cumpleaños hoy!" />}
                              </div>
                              {tx.clientPhone && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx.clientPhone}</div>
                              )}
                            </td>
                            <td>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent-gold)' }}>
                                {barber ? barber.name : 'Barbero'}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.85rem' }}>
                              <div>{tx.service} (${Number(tx.amount).toLocaleString('es-AR')})</div>
                              {tx.edited && tx.editHistory && tx.editHistory.length > 0 && (
                                <div style={{
                                  fontSize: '0.72rem',
                                  color: '#fbbf24',
                                  marginTop: '4px',
                                  background: 'rgba(245, 158, 11, 0.15)',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  borderLeft: '3px solid #f59e0b'
                                }}>
                                  ✏️ Editado por <strong>{tx.editHistory[0].editedBy}</strong>: "{tx.editHistory[0].editReason}"
                                </div>
                              )}
                            </td>
                            <td>
                              {tx.tip > 0 ? (
                                <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                                  +${Number(tx.tip).toLocaleString('es-AR')}
                                </span>
                              ) : (
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>-</span>
                              )}
                            </td>
                            <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                              ${totalTx.toLocaleString('es-AR')}
                              <div style={{ fontSize: '0.7rem', color: tx.paymentMethod === 'contado' ? '#34d399' : '#38bdf8' }}>
                                {tx.paymentMethod === 'contado' ? 'Efectivo' : 'Transf.'}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '6px' }}>
                                <button 
                                  onClick={() => handleOpenEditModal(tx)}
                                  className="btn btn-outline btn-sm"
                                  style={{ borderColor: 'var(--accent-gold)', color: 'var(--accent-gold)', padding: '6px' }}
                                  title="Editar registro de venta"
                                >
                                  <Edit2 size={14} />
                                </button>
                                <button 
                                  onClick={() => handleDeleteTx(tx.id)}
                                  className="btn btn-danger btn-sm"
                                  style={{ padding: '6px' }}
                                  title="Eliminar"
                                >
                                  <Trash2 size={14} />
                                </button>
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

        {/* SUBTAB EGRESOS Y ADELANTOS */}
        {activeSubTab === 'egresos' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            
            {/* Formulario Egreso */}
            <div className="glass-panel" style={{ padding: '24px', borderTop: '4px solid #f43f5e' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '18px', color: '#fb7185', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ArrowDownCircle size={20} />
                Anotar Salida de Dinero / Adelanto
              </h3>

              <form onSubmit={handleAddExpense}>
                
                {/* Categoría */}
                <div className="form-group">
                  <label className="form-label">Tipo de Egreso</label>
                  <select 
                    value={expenseCategory} 
                    onChange={(e) => setExpenseCategory(e.target.value)}
                    className="form-select"
                  >
                    <option value="insumos">🧴 Insumos Barbería (Navajas, champú, etc.)</option>
                    <option value="agua">🚰 Bidón de Agua / Bebidas</option>
                    <option value="adelanto">💸 Adelanto de Sueldo (Ema, Diego o Barbero)</option>
                    <option value="varios">🧹 Gastos Varios / Limpieza</option>
                  </select>
                </div>

                {/* Si es adelanto, seleccionar barbero */}
                {expenseCategory === 'adelanto' && (
                  <div className="form-group">
                    <label className="form-label">Barbero que recibe el adelanto</label>
                    <select 
                      value={expenseBarberId} 
                      onChange={(e) => setExpenseBarberId(e.target.value)}
                      className="form-select"
                      required
                    >
                      <option value="">-- Seleccionar Barbero --</option>
                      {barbers.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Descripción */}
                <div className="form-group">
                  <label className="form-label">Detalle / Concepto</label>
                  <input 
                    type="text"
                    placeholder={expenseCategory === 'adelanto' ? 'ej. Adelanto para almuerzo / transporte' : 'ej. 2 Bidones de agua Villavicencio'}
                    value={expenseDesc}
                    onChange={(e) => setExpenseDesc(e.target.value)}
                    className="form-input"
                  />
                </div>

                {/* Medio de Salida y Monto */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div className="form-group">
                    <label className="form-label">Monto ($)</label>
                    <input 
                      type="number"
                      placeholder="Monto"
                      value={expenseAmount}
                      onChange={(e) => setExpenseAmount(e.target.value)}
                      className="form-input"
                      style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fb7185' }}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Origen del Dinero</label>
                    <select 
                      value={expensePaymentMethod} 
                      onChange={(e) => setExpensePaymentMethod(e.target.value)}
                      className="form-select"
                    >
                      <option value="caja_efectivo">💵 Caja Chica (Efectivo)</option>
                      <option value="banco_transferencia">💳 Cuenta Bancaria</option>
                    </select>
                  </div>
                </div>

                <button type="submit" className="btn btn-danger btn-lg" style={{ width: '100%', marginTop: '8px' }}>
                  <ArrowDownCircle size={20} />
                  Guardar Egreso
                </button>
              </form>
            </div>

            {/* Listado de Egresos del Día */}
            <div className="glass-panel" style={{ padding: '24px' }}>
              <h3 style={{ fontSize: '1.15rem', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>Egresos de Hoy ({dailySummary.expenses.length})</span>
                <span className="badge badge-egreso">${dailySummary.totalEgresos.toLocaleString('es-AR')}</span>
              </h3>

              {dailySummary.expenses.length === 0 ? (
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
                      {dailySummary.expenses.map(ex => (
                        <tr key={ex.id}>
                          <td>
                            <div style={{ fontWeight: 600, color: '#fb7185' }}>{ex.description}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                              Categoría: {ex.category}
                            </div>
                          </td>
                          <td>
                            <span className={`badge ${ex.paymentMethod === 'caja_efectivo' ? 'badge-contado' : 'badge-transferencia'}`}>
                              {ex.paymentMethod === 'caja_efectivo' ? '💵 Caja Efectivo' : '💳 Banco'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 700, color: '#f43f5e' }}>
                            -${Number(ex.amount).toLocaleString('es-AR')}
                          </td>
                          <td>
                            <button 
                              onClick={() => handleDeleteEx(ex.id)}
                              className="btn btn-danger btn-sm"
                              title="Eliminar"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* MODAL PARA EDITAR VENTA CON AUDITORÍA (QUIÉN EDITÓ Y MOTIVO) */}
      {editingTx && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          padding: '20px'
        }}>
          <div className="glass-panel animate-scale-up" style={{
            maxWidth: '520px',
            width: '100%',
            padding: '24px',
            background: 'var(--bg-card)',
            border: '1px solid var(--accent-gold)'
          }}>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--accent-gold)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Edit2 size={20} />
              Editar Movimiento de Venta ({editingTx.clientName})
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '18px' }}>
              Modificá el monto o servicio registrado. Se guardará quién realizó el cambio y el motivo.
            </p>

            <form onSubmit={handleSaveEdit}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Monto Servicio ($)</label>
                  <input 
                    type="number"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--accent-gold)' }}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Propina ($)</label>
                  <input 
                    type="number"
                    value={editTip}
                    onChange={(e) => setEditTip(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '1.1rem', fontWeight: 700, color: '#34d399' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Servicio / Producto</label>
                <input 
                  type="text"
                  value={editService}
                  onChange={(e) => setEditService(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Barbero</label>
                  <select 
                    value={editBarberId}
                    onChange={(e) => setEditBarberId(e.target.value)}
                    className="form-select"
                  >
                    {barbers.map(b => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Forma de Pago</label>
                  <select 
                    value={editPaymentMethod}
                    onChange={(e) => setEditPaymentMethod(e.target.value)}
                    className="form-select"
                  >
                    <option value="transferencia">💳 Transferencia</option>
                    <option value="contado">💵 Efectivo</option>
                  </select>
                </div>
              </div>

              {/* AUDIT FIELDS (MANDATORY) */}
              <div style={{ background: 'rgba(245, 158, 11, 0.08)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(245, 158, 11, 0.3)', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--accent-gold)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={16} /> Registro de Auditoría (Obligatorio)
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ color: 'var(--text-main)' }}>¿Quién realiza la edición?</label>
                  <input 
                    type="text"
                    placeholder="ej. Ema, Diego, Barbero"
                    value={editedBy}
                    onChange={(e) => setEditedBy(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ color: 'var(--text-main)' }}>Motivo del cambio</label>
                  <input 
                    type="text"
                    placeholder="ej. Cobro mal ingresado, descuento aplicado..."
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    className="form-input"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => setEditingTx(null)}
                  className="btn btn-outline"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                >
                  Guardar Cambios con Auditoría
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
