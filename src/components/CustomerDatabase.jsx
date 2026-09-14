import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { Users, Search, MessageSquare, Phone, Calendar, DollarSign, Send, Scissors, Edit3, Cake, Sparkles, Filter } from 'lucide-react';

export default function CustomerDatabase() {
  const [customers, setCustomers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [birthdayFilter, setBirthdayFilter] = useState('todos'); // 'todos' | 'hoy' | 'mes'
  const [specificDateFilter, setSpecificDateFilter] = useState(''); // e.g. "13/09" or "13-09"

  // Modal for sending custom WhatsApp message
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('recordatorio');
  const [customText, setCustomText] = useState('');

  // Editable birthdate state
  const [editingBirthdateCustId, setEditingBirthdateCustId] = useState(null);
  const [birthdateInputValue, setBirthdateInputValue] = useState('');

  useEffect(() => {
    let mounted = true;
    storageService.getCustomersShared().then(list => {
      if (mounted) setCustomers(list);
    });
    return () => { mounted = false; };
  }, []);

  const loadCustomers = () => {
    const list = storageService.getCustomers();
    setCustomers(list);
  };

  const handleSaveBirthdate = (cust) => {
    const updated = storageService.updateCustomerBirthdate(cust.id, birthdateInputValue.trim());
    setCustomers(updated);
    setEditingBirthdateCustId(null);
  };

  const todayDateObj = new Date();
  const todayDay = todayDateObj.getDate().toString().padStart(2, '0');
  const todayMonth = (todayDateObj.getMonth() + 1).toString().padStart(2, '0');
  const todayStrDDMM = `${todayDay}/${todayMonth}`; // e.g. "13/09"
  const todayStrMMDD = `${todayMonth}-${todayDay}`; // e.g. "09-13"
  const todayYYYYMMDD = todayDateObj.toISOString().split('T')[0];

  // Helper to normalize birthdate string to { day, month }
  const parseBirthdateObj = (bStr) => {
    if (!bStr) return null;
    const clean = bStr.replace(/\//g, '-').trim();
    const parts = clean.split('-');
    
    if (parts.length === 2) {
      // Could be MM-DD or DD-MM.
      // If first part > 12, it's DD-MM
      const p1 = parseInt(parts[0], 10);
      const p2 = parseInt(parts[1], 10);
      if (p1 > 12) {
        return { day: p1.toString().padStart(2, '0'), month: p2.toString().padStart(2, '0') };
      } else if (p2 > 12) {
        return { day: p2.toString().padStart(2, '0'), month: p1.toString().padStart(2, '0') };
      }
      // If both <= 12, default p1=month, p2=day or p1=day, p2=month
      return { month: p1.toString().padStart(2, '0'), day: p2.toString().padStart(2, '0') };
    } else if (parts.length === 3) {
      // YYYY-MM-DD
      return { month: parts[1].padStart(2, '0'), day: parts[2].padStart(2, '0') };
    }
    return null;
  };

  // Filter customers by Search Term, Quick Birthday Buttons & Specific Date (e.g. "13/09")
  const filteredCustomers = customers.filter(c => {
    // 1. Text Search (Name, Phone or Birthdate matching)
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.phone.includes(searchTerm) ||
      (c.birthdate && c.birthdate.includes(searchTerm));

    if (!matchesSearch) return false;

    // 2. Birthday Preset Filter
    if (birthdayFilter === 'hoy') {
      return storageService.isBirthdayToday(c.birthdate, todayYYYYMMDD);
    }
    
    if (birthdayFilter === 'mes') {
      if (!c.birthdate) return false;
      const parsed = parseBirthdateObj(c.birthdate);
      return parsed ? parsed.month === todayMonth : false;
    }

    // 3. Specific Date Filter (e.g. "13/09" or "13-09")
    if (specificDateFilter.trim()) {
      if (!c.birthdate) return false;
      const targetClean = specificDateFilter.replace(/\//g, '-').trim();
      const targetParts = targetClean.split('-');
      const parsed = parseBirthdateObj(c.birthdate);
      if (!parsed) return false;

      if (targetParts.length >= 2) {
        const dTarget = targetParts[0].padStart(2, '0');
        const mTarget = targetParts[1].padStart(2, '0');
        
        // Check both DD/MM and MM/DD possibilities
        const matchDDMM = (parsed.day === dTarget && parsed.month === mTarget);
        const matchMMDD = (parsed.month === dTarget && parsed.day === mTarget);
        return matchDDMM || matchMMDD;
      }
      return c.birthdate.includes(targetClean);
    }

    return true;
  });

  const getTemplateText = (customerName, templateType) => {
    const name = customerName || 'estimado/a';
    switch (templateType) {
      case 'cumpleaños':
        return `¡Hola ${name}! 🥳🎂 Te escribimos de la barbería para desearte un ¡Feliz Cumpleaños! Queremos festejarlo con vos y tenés un regalo/beneficio especial esperándote. ¿Te reservamos un lugar para hoy o esta semana? ✂️💈`;
      case 'recordatorio':
        return `¡Hola ${name}! ✂️💈 Te escribimos de la barbería para avisarte que ya hace unos días de tu última visita. ¿Te gustaría agendar un turno para esta semana? Te esperamos.`;
      case 'promocion':
        return `¡Hola ${name}! 🔥 En la barbería tenemos un descuento especial para vos en tu próximo corte o barba. Respondé este mensaje para reservar tu lugar. ¡Nos vemos!`;
      case 'agradecimiento':
        return `¡Hola ${name}! Muchas gracias por haber venido hoy a la barbería ✂️. Esperamos que hayas quedado de 10. ¡Que tengas un excelente día!`;
      case 'personalizado':
        return customText;
      default:
        return `¡Hola ${name}! Te escribimos de la barbería.`;
    }
  };

  const handleOpenWAModal = (customer, templateHint = 'recordatorio') => {
    setSelectedCustomer(customer);
    setSelectedTemplate(templateHint);
    setCustomText('');
  };

  const handleSendWhatsApp = (e) => {
    e.preventDefault();
    if (!selectedCustomer || !selectedCustomer.phone) {
      alert('El cliente no tiene número de teléfono registrado.');
      return;
    }

    let cleanPhone = selectedCustomer.phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10 && !cleanPhone.startsWith('54')) {
      cleanPhone = '549' + cleanPhone;
    }

    const messageText = getTemplateText(selectedCustomer.name, selectedTemplate);
    const encodedMsg = encodeURIComponent(messageText);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodedMsg}`;

    window.open(waUrl, '_blank');
    setSelectedCustomer(null);
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      
      {/* Header */}
      <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users style={{ color: 'var(--accent-gold)' }} />
            Base de Datos de Clientes & WhatsApp Directo
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Filtros por fecha de cumpleaños (ej. 13/09), historial de visitas y envíos automatizados
          </p>
        </div>

        {/* Search Bar & Specific Date Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Specific Date Filter Input */}
          <div style={{ position: 'relative', width: '170px' }}>
            <Cake size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#f472b6' }} />
            <input 
              type="text"
              placeholder="Cumple ej. 13/09"
              value={specificDateFilter}
              onChange={(e) => { setSpecificDateFilter(e.target.value); setBirthdayFilter('todos'); }}
              className="form-input"
              style={{ paddingLeft: '32px', background: 'var(--bg-card)', fontSize: '0.88rem' }}
            />
          </div>

          {/* Text Search */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input 
              type="text"
              placeholder="Nombre o teléfono..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '32px', background: 'var(--bg-card)', fontSize: '0.88rem' }}
            />
          </div>

        </div>
      </div>

      {/* QUICK BIRTHDAY FILTER BUTTONS */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Filtros de Cumpleaños:</span>
        
        <button 
          onClick={() => { setBirthdayFilter('todos'); setSpecificDateFilter(''); }}
          className={`btn btn-sm ${birthdayFilter === 'todos' && !specificDateFilter ? 'btn-primary' : 'btn-secondary'}`}
        >
          Todos los Clientes ({customers.length})
        </button>

        <button 
          onClick={() => { setBirthdayFilter('hoy'); setSpecificDateFilter(''); }}
          className={`btn btn-sm ${birthdayFilter === 'hoy' ? 'btn-primary' : 'btn-secondary'}`}
          style={birthdayFilter === 'hoy' ? { background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', borderColor: '#f472b6' } : { color: '#f472b6' }}
        >
          🎂 Cumpleañeros de Hoy ({todayStrDDMM})
        </button>

        <button 
          onClick={() => { setBirthdayFilter('mes'); setSpecificDateFilter(''); }}
          className={`btn btn-sm ${birthdayFilter === 'mes' ? 'btn-primary' : 'btn-secondary'}`}
          style={birthdayFilter === 'mes' ? { background: 'rgba(236, 72, 153, 0.2)', color: '#f472b6', borderColor: 'rgba(236, 72, 153, 0.4)' } : {}}
        >
          🗓️ Cumpleañeros de este Mes
        </button>

        {specificDateFilter && (
          <span className="badge" style={{ background: 'rgba(236, 72, 153, 0.2)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.4)' }}>
            Filtrando fecha: {specificDateFilter}
            <button 
              onClick={() => setSpecificDateFilter('')}
              style={{ background: 'none', border: 'none', color: '#f472b6', marginLeft: '6px', cursor: 'pointer', fontWeight: 800 }}
            >
              ✕
            </button>
          </span>
        )}
      </div>

      {/* Customer List */}
      <div className="glass-panel" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)' }}>
            Clientes Encontrados ({filteredCustomers.length})
          </h3>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Podés enviar mensajes masivos o individuales por WhatsApp
          </span>
        </div>

        {filteredCustomers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
            <Cake size={48} style={{ opacity: 0.3, marginBottom: '12px', color: '#f472b6' }} />
            <p style={{ fontSize: '1rem', color: 'var(--text-main)' }}>No se encontraron clientes para esa fecha de cumpleaños ({specificDateFilter || searchTerm || 'filtro'}).</p>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Verificá haber ingresado la fecha en formato DD/MM (ej. 13/09).</span>
          </div>
        ) : (
          <div className="custom-table-container">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Teléfono</th>
                  <th>Fecha Cumpleaños</th>
                  <th>Visitas Este Mes</th>
                  <th>Total Gastado</th>
                  <th>Última Visita</th>
                  <th>Enviar WhatsApp</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map(cust => {
                  const isBirthday = storageService.isBirthdayToday(cust.birthdate, todayYYYYMMDD);
                  const isEditingBday = editingBirthdateCustId === cust.id;

                  return (
                    <tr key={cust.id} style={isBirthday ? { background: 'rgba(236, 72, 153, 0.12)' } : {}}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {cust.name}
                          {isBirthday && <Cake size={16} style={{ color: '#f472b6' }} title="¡Cumpleaños hoy!" />}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--accent-gold)' }}>
                          <Phone size={14} />
                          <span>{cust.phone || 'Sin registrar'}</span>
                        </div>
                      </td>
                      <td>
                        {isEditingBday ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input 
                              type="text"
                              placeholder="13/09"
                              value={birthdateInputValue}
                              onChange={(e) => setBirthdateInputValue(e.target.value)}
                              className="form-input"
                              style={{ width: '80px', padding: '4px 6px', fontSize: '0.8rem' }}
                              autoFocus
                            />
                            <button 
                              onClick={() => handleSaveBirthdate(cust)}
                              className="btn btn-primary btn-sm"
                              style={{ padding: '2px 6px', fontSize: '0.75rem' }}
                            >
                              OK
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ 
                              fontSize: '0.9rem', 
                              color: isBirthday ? '#f472b6' : 'var(--accent-gold)', 
                              fontWeight: 700,
                              background: 'rgba(255,255,255,0.04)',
                              padding: '2px 8px',
                              borderRadius: '4px'
                            }}>
                              {cust.birthdate || 'Sin cargar'}
                            </span>
                            <button 
                              onClick={() => { setEditingBirthdateCustId(cust.id); setBirthdateInputValue(cust.birthdate || ''); }}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '2px 6px' }}
                              title="Editar Fecha Cumpleaños"
                            >
                              <Edit3 size={12} />
                            </button>
                          </div>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-gold">
                          {cust.monthlyVisitsCount || 0} este mes ({cust.visitCount} tot.)
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: '#34d399' }}>
                        ${cust.totalSpent.toLocaleString('es-AR')}
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {cust.lastVisit}
                      </td>
                      <td>
                        {isBirthday ? (
                          <button 
                            onClick={() => handleOpenWAModal(cust, 'cumpleaños')}
                            className="btn btn-whatsapp btn-sm"
                            style={{ background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', boxShadow: '0 4px 12px rgba(236, 72, 153, 0.4)' }}
                          >
                            <Cake size={15} />
                            <span>Regalo Cumple</span>
                          </button>
                        ) : (
                          <button 
                            onClick={() => handleOpenWAModal(cust, 'recordatorio')}
                            className="btn btn-whatsapp btn-sm"
                            disabled={!cust.phone}
                          >
                            <MessageSquare size={15} />
                            <span>WhatsApp</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL ENVIAR WHATSAPP DIRECTO */}
      {selectedCustomer && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '500px', padding: '24px', background: 'var(--bg-card)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.2rem', color: '#25d366', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={22} />
                Enviar WhatsApp a {selectedCustomer.name}
              </h3>
              <button 
                onClick={() => setSelectedCustomer(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSendWhatsApp}>
              
              <div className="form-group">
                <label className="form-label">Teléfono de Destino</label>
                <input 
                  type="text" 
                  value={selectedCustomer.phone}
                  readOnly
                  className="form-input"
                  style={{ color: 'var(--accent-gold)', fontWeight: 700 }}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Seleccionar Plantilla de Mensaje</label>
                <select 
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="form-select"
                >
                  <option value="cumpleaños">🎂 Saludo de Cumpleaños & Beneficio Especial</option>
                  <option value="recordatorio">✂️ Recordatorio de Turno / Renovación</option>
                  <option value="promocion">🔥 Promoción y Descuento del Mes</option>
                  <option value="agradecimiento">⭐ Agradecimiento post-corte</option>
                  <option value="personalizado">✏️ Escribir Mensaje Personalizado</option>
                </select>
              </div>

              {selectedTemplate === 'personalizado' && (
                <div className="form-group">
                  <label className="form-label">Mensaje a Medida</label>
                  <textarea 
                    rows={4}
                    placeholder="Escribí tu mensaje aquí..."
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    className="form-textarea"
                    required
                  />
                </div>
              )}

              {/* Vista Previa del Mensaje */}
              <div style={{
                background: 'rgba(37, 211, 102, 0.08)',
                border: '1px solid rgba(37, 211, 102, 0.2)',
                borderRadius: 'var(--radius-sm)',
                padding: '14px',
                marginBottom: '20px'
              }}>
                <span style={{ fontSize: '0.75rem', color: '#25d366', fontWeight: 700, textTransform: 'uppercase' }}>
                  Vista previa del texto:
                </span>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-main)', marginTop: '6px', whiteSpace: 'pre-wrap' }}>
                  {getTemplateText(selectedCustomer.name, selectedTemplate)}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  onClick={() => setSelectedCustomer(null)}
                  className="btn btn-secondary"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-whatsapp btn-lg"
                >
                  <Send size={18} />
                  Abrir WhatsApp Directo
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}
