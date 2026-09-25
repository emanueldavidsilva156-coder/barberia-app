import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { Settings, Users, Scissors, Download, Upload, Github, Globe, Plus, Trash2, CheckCircle2, Key, Edit3, Save, ShoppingBag, Tag, ClipboardList } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('barberos');

  const [barbers, setBarbers] = useState([]);
  const [services, setServices] = useState([]);
  const [adminPin, setAdminPin] = useState('1234');
  const [pinStatusMsg, setPinStatusMsg] = useState('');

  // Form states for Barber Add
  const [newBarberName, setNewBarberName] = useState('');
  const [newBarberComm, setNewBarberComm] = useState('40');

  // Form states for Catalog Add
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState('servicio'); // 'servicio' | 'producto'
  const [newItemPrice, setNewItemPrice] = useState('');

  // Inline Price Edit State
  const [editingItemId, setEditingItemId] = useState(null);
  const [editPriceValue, setEditPriceValue] = useState('');

  const [catalogFilter, setCatalogFilter] = useState('todos');
  const [importStatus, setImportStatus] = useState('');
  const [auditLog, setAuditLog] = useState([]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const loadData = () => {
    setBarbers(storageService.getBarbers());
    setServices(storageService.getServices());
    setAdminPin(storageService.getAdminPIN());
    setAuditLog(storageService.getTransactionAuditLog());
  };

  const handleSavePin = (e) => {
    e.preventDefault();
    if (!adminPin.trim()) return;
    storageService.setAdminPIN(adminPin.trim());
    setPinStatusMsg('¡PIN de administrador actualizado!');
    setTimeout(() => setPinStatusMsg(''), 2500);
  };

  const handleStartEditItem = (item) => {
    setEditingItemId(item.id);
    setEditPriceValue(item.price);
  };

  const handleSaveItemPrice = (itemId) => {
    if (!editPriceValue || Number(editPriceValue) <= 0) return;
    const updated = storageService.updateServicePrice(itemId, editPriceValue);
    setServices(updated);
    setEditingItemId(null);
  };

  const handleAddCatalogItem = (e) => {
    e.preventDefault();
    if (!newItemName.trim() || !newItemPrice) return;

    const updated = storageService.addCatalogItem({
      name: newItemName.trim(),
      type: newItemType,
      price: newItemPrice
    });

    setServices(updated);
    setNewItemName('');
    setNewItemPrice('');
  };

  const handleDeleteItem = (id) => {
    if (services.length <= 1) {
      alert('Debe quedar al menos un ítem registrado.');
      return;
    }
    if (window.confirm('¿Eliminar del catálogo?')) {
      const updated = storageService.deleteCatalogItem(id);
      setServices(updated);
    }
  };

  const handleAddBarber = (e) => {
    e.preventDefault();
    if (!newBarberName.trim()) return;

    const updated = storageService.addBarber({
      name: newBarberName.trim(),
      commissionRate: newBarberComm
    });

    setBarbers(updated);
    setNewBarberName('');
    setNewBarberComm('40');
  };

  const handleDeleteBarber = (id) => {
    if (barbers.length <= 1) {
      alert('Debe quedar al menos un barbero en la lista.');
      return;
    }
    if (window.confirm('¿Eliminar barbero de la lista?')) {
      const updated = storageService.deleteBarber(id);
      setBarbers(updated);
    }
  };

  const handleExportData = () => {
    const jsonStr = storageService.exportJSONData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_barberia_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImportFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target.result;
      const success = storageService.importJSONData(content);
      if (success) {
        setImportStatus('¡Datos importados con éxito!');
        loadData();
        setTimeout(() => setImportStatus(''), 3000);
      } else {
        alert('Error al leer el archivo de copia de seguridad.');
      }
    };
    reader.readAsText(file);
  };

  const filteredItems = services.filter(item => {
    if (catalogFilter === 'todos') return true;
    return (item.type || 'servicio') === catalogFilter;
  });

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%',
        maxWidth: '780px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-card)',
        overflow: 'hidden'
      }}>
        
        {/* Header */}
        <div style={{
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(15, 23, 42, 0.8)'
        }}>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={22} />
            Configuración del Equipo y Precios
          </h3>
          <button 
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.6rem', cursor: 'pointer' }}
          >
            &times;
          </button>
        </div>

        {/* Tabs Bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.5)' }}>
          <button 
            onClick={() => setActiveTab('barberos')}
            className="toggle-btn"
            style={{ borderRadius: 0, padding: '12px 16px', color: activeTab === 'barberos' ? 'var(--accent-gold)' : 'var(--text-muted)', borderBottom: activeTab === 'barberos' ? '2px solid var(--accent-gold)' : 'none' }}
          >
            👥 Barberos ({barbers.length})
          </button>
          <button 
            onClick={() => setActiveTab('servicios')}
            className="toggle-btn"
            style={{ borderRadius: 0, padding: '12px 16px', color: activeTab === 'servicios' ? 'var(--accent-gold)' : 'var(--text-muted)', borderBottom: activeTab === 'servicios' ? '2px solid var(--accent-gold)' : 'none' }}
          >
            ✂️ Precios & Catálogo
          </button>
          <button 
            onClick={() => setActiveTab('seguridad')}
            className="toggle-btn"
            style={{ borderRadius: 0, padding: '12px 16px', color: activeTab === 'seguridad' ? '#a78bfa' : 'var(--text-muted)', borderBottom: activeTab === 'seguridad' ? '2px solid #a78bfa' : 'none' }}
          >
            🔑 Clave PIN Admin
          </button>
          <button
            onClick={() => setActiveTab('auditoria')}
            className="toggle-btn"
            style={{ borderRadius: 0, padding: '12px 16px', color: activeTab === 'auditoria' ? '#fb7185' : 'var(--text-muted)', borderBottom: activeTab === 'auditoria' ? '2px solid #fb7185' : 'none' }}
          >
            <ClipboardList size={14} /> Auditoría ({auditLog.length})
          </button>
          <button 
            onClick={() => setActiveTab('github')}
            className="toggle-btn"
            style={{ borderRadius: 0, padding: '12px 16px', color: activeTab === 'github' ? '#38bdf8' : 'var(--text-muted)', borderBottom: activeTab === 'github' ? '2px solid #38bdf8' : 'none' }}
          >
            🚀 Enlace Celulares / GitHub
          </button>
        </div>

        {/* Content Area */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          
          {/* TAB BARBEROS */}
          {activeTab === 'barberos' && (
            <div>
              <h4 style={{ marginBottom: '14px', color: 'var(--text-main)' }}>Lista de Barberos</h4>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {barbers.map(b => (
                  <div key={b.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)'
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>{b.name}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Comisión Servicios: <strong style={{ color: '#34d399' }}>{((b.commissionRate || 0.40) * 100)}%</strong> + 100% Propinas
                      </span>
                      <button onClick={() => handleDeleteBarber(b.id)} className="btn btn-danger btn-sm">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Formulario de Agregar Nuevo Barbero */}
              <form onSubmit={handleAddBarber} style={{ background: 'rgba(255,255,255,0.03)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <h5 style={{ marginBottom: '12px', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={18} /> Agregar Nuevo Barbero
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '10px' }}>
                  <input 
                    type="text"
                    placeholder="Nombre del Barbero (ej. Franco)"
                    value={newBarberName}
                    onChange={(e) => setNewBarberName(e.target.value)}
                    className="form-input"
                    required
                  />
                  <input 
                    type="number"
                    placeholder="Comisión % (ej. 40)"
                    value={newBarberComm}
                    onChange={(e) => setNewBarberComm(e.target.value)}
                    className="form-input"
                    required
                  />
                  <button type="submit" className="btn btn-primary">
                    <Plus size={16} /> Guardar Barbero
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB SERVICIOS Y PRODUCTOS (CAMBIO DE PRECIOS) */}
          {activeTab === 'servicios' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
                <h4 style={{ color: 'var(--text-main)', margin: 0 }}>Catálogo de Servicios y Productos</h4>
                
                <div className="toggle-group" style={{ margin: 0 }}>
                  <button 
                    className={`toggle-btn ${catalogFilter === 'todos' ? 'active' : ''}`}
                    onClick={() => setCatalogFilter('todos')}
                  >
                    Todos ({services.length})
                  </button>
                  <button 
                    className={`toggle-btn ${catalogFilter === 'servicio' ? 'active' : ''}`}
                    onClick={() => setCatalogFilter('servicio')}
                  >
                    Servicios ✂️
                  </button>
                  <button 
                    className={`toggle-btn ${catalogFilter === 'producto' ? 'active' : ''}`}
                    onClick={() => setCatalogFilter('producto')}
                  >
                    Productos 🧴
                  </button>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                {filteredItems.map(item => (
                  <div key={item.id} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 16px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)'
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.name}</span>
                      <span className={`badge ${item.type === 'producto' ? 'badge-transferencia' : 'badge-gold'}`} style={{ marginLeft: '10px', textTransform: 'capitalize' }}>
                        {item.type || 'servicio'}
                      </span>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      {editingItemId === item.id ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>$</span>
                          <input 
                            type="number"
                            value={editPriceValue}
                            onChange={(e) => setEditPriceValue(e.target.value)}
                            className="form-input"
                            style={{ width: '110px', padding: '4px 8px', color: 'var(--accent-gold)', fontWeight: 700 }}
                            autoFocus
                          />
                          <button 
                            onClick={() => handleSaveItemPrice(item.id)}
                            className="btn btn-primary btn-sm"
                            style={{ background: '#10b981' }}
                          >
                            <Save size={14} /> Guardar
                          </button>
                        </div>
                      ) : (
                        <>
                          <span style={{ fontWeight: 800, color: 'var(--accent-gold)', fontSize: '1.1rem' }}>
                            ${item.price.toLocaleString('es-AR')}
                          </span>
                          <button 
                            onClick={() => handleStartEditItem(item)}
                            className="btn btn-secondary btn-sm"
                            title="Modificar precio"
                          >
                            <Edit3 size={14} /> Modificar Precio
                          </button>
                          <button onClick={() => handleDeleteItem(item.id)} className="btn btn-danger btn-sm">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <form onSubmit={handleAddCatalogItem} style={{ background: 'rgba(255,255,255,0.03)', padding: '18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <h5 style={{ marginBottom: '14px', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Plus size={18} /> Agregar Nuevo Servicio o Producto
                </h5>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '10px' }}>
                  <input 
                    type="text"
                    placeholder="Nombre (ej. Cera Mate / Alisado)"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="form-input"
                    required
                  />
                  <select 
                    value={newItemType}
                    onChange={(e) => setNewItemType(e.target.value)}
                    className="form-select"
                  >
                    <option value="servicio">✂️ Servicio</option>
                    <option value="producto">🧴 Producto</option>
                  </select>
                  <input 
                    type="number"
                    placeholder="Precio $"
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="form-input"
                    required
                  />
                  <button type="submit" className="btn btn-primary">
                    <Plus size={16} /> Agregar
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB SEGURIDAD PIN ADMIN */}
          {activeTab === 'seguridad' && (
            <div>
              <h4 style={{ marginBottom: '14px', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={20} />
                Clave PIN para Administrador (Modo Ema)
              </h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Esta clave evita que los barberos o personas no autorizadas puedan acceder al resumen contable mensual, conciliación bancaria y edición de precios.
              </p>

              <form onSubmit={handleSavePin} style={{ maxWidth: '400px', background: 'rgba(15, 23, 42, 0.6)', padding: '20px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
                <div className="form-group">
                  <label className="form-label">PIN de Seguridad (4 dígitos)</label>
                  <input 
                    type="text"
                    value={adminPin}
                    onChange={(e) => setAdminPin(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '1.2rem', letterSpacing: '0.2em', fontWeight: 800, textAlign: 'center', color: '#a78bfa' }}
                    maxLength={8}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%', background: '#8b5cf6' }}>
                  Guardar Nuevo PIN
                </button>
                {pinStatusMsg && <div style={{ fontSize: '0.82rem', color: '#34d399', marginTop: '10px', textAlign: 'center' }}>{pinStatusMsg}</div>}
              </form>
            </div>
          )}

          {activeTab === 'auditoria' && (
            <div>
              <h4 style={{ marginBottom: '8px', color: '#fb7185', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ClipboardList size={20} /> Historial de modificaciones
              </h4>
              <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '20px' }}>
                Registro de cambios realizados sobre importes, propinas, servicios, barberos y medios de cobro.
              </p>

              {auditLog.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
                  Todavía no hay movimientos modificados.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {auditLog.map((entry, index) => (
                    <div key={`${entry.transactionId}-${entry.editedAt}-${index}`} style={{ padding: '16px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid var(--border-color)', borderLeft: '3px solid #fb7185', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '8px' }}>
                        <strong style={{ color: 'var(--text-main)' }}>{entry.clientName}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{entry.editedAt}</span>
                      </div>
                      <div style={{ display: 'grid', gap: '5px', color: 'var(--text-muted)', fontSize: '0.86rem' }}>
                        <span>Movimiento: {entry.transactionDate} | {entry.transactionId}</span>
                        <span>Modificó: <strong style={{ color: '#fbbf24' }}>{entry.editedBy}</strong></span>
                        <span>Motivo: {entry.editReason}</span>
                        {(entry.oldAmount !== entry.newAmount || entry.oldTip !== entry.newTip) && (
                          <span>Monto / propina: ${Number(entry.oldAmount || 0).toLocaleString('es-AR')} + ${Number(entry.oldTip || 0).toLocaleString('es-AR')} → ${Number(entry.newAmount || 0).toLocaleString('es-AR')} + ${Number(entry.newTip || 0).toLocaleString('es-AR')}</span>
                        )}
                        {entry.oldPaymentMethod !== entry.newPaymentMethod && (
                          <span>Medio de cobro: <strong style={{ color: '#fb7185' }}>{entry.oldPaymentMethod || 'sin informar'}</strong> → <strong style={{ color: '#34d399' }}>{entry.newPaymentMethod || 'sin informar'}</strong></span>
                        )}
                        {entry.oldService !== entry.newService && <span>Servicio: {entry.oldService || 'sin informar'} → {entry.newService || 'sin informar'}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB GITHUB & ENLACE CELULARES */}
          {activeTab === 'github' && (
            <div>
              <div style={{ padding: '16px', background: 'rgba(6, 182, 212, 0.1)', border: '1px solid rgba(6, 182, 212, 0.3)', borderRadius: 'var(--radius-sm)', marginBottom: '20px' }}>
                <h4 style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Github size={20} />
                  Cómo Guardar en GitHub y Enviar el Link al Celular de los Barberos
                </h4>
                <p style={{ fontSize: '0.88rem', color: 'var(--text-main)', lineHeight: 1.5 }}>
                  Ema: Para que los barberos entren desde sus celulares en Modo Barbero sin ver la contabilidad:
                </p>
              </div>

              <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '0.9rem', color: 'var(--text-main)' }}>
                <li>
                  <strong>Crear Repositorio en GitHub:</strong> Ingresá a GitHub y creá un repositorio llamado <code>barberia-app</code>.
                </li>
                <li>
                  <strong>Subir el Proyecto:</strong> En la terminal ejecutá:
                  <pre style={{ background: '#0f172a', padding: '10px', borderRadius: '6px', color: '#38bdf8', marginTop: '6px', overflowX: 'auto' }}>
                    git init{"\n"}
                    git add .{"\n"}
                    git commit -m "Sistema Barberia Ema"{"\n"}
                    git remote add origin https://github.com/TU_USUARIO/barberia-app.git{"\n"}
                    git push -u origin main
                  </pre>
                </li>
                <li>
                  <strong>Obtener el Link Web Gratuito (Vercel):</strong> Conectá tu GitHub en <a href="https://vercel.com" target="_blank" rel="noreferrer" style={{ color: 'var(--accent-gold)' }}>Vercel.com</a> (gratis). Te dará el enlace web para los celulares.
                </li>
              </ol>
            </div>
          )}

        </div>

        {/* Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(15, 23, 42, 0.8)',
          display: 'flex',
          justify: 'flex-end'
        }}>
          <button onClick={onClose} className="btn btn-primary">
            Aceptar y Cerrar
          </button>
        </div>

      </div>
    </div>
  );
}
