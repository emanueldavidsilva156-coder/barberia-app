import { useCallback, useEffect, useState } from 'react';
import { store } from '../services/store.js';
import { useStoreVersion } from '../services/useStore.js';
import { formatDate, formatDateTime, todayISO } from '../services/dates.js';
import { money } from '../services/finance.js';
import { Settings, Download, Plus, Edit3, Save, ClipboardList, ShieldCheck, AlertTriangle } from 'lucide-react';

const TABLE_LABELS = {
  sales: 'Venta',
  expenses: 'Gasto',
  salary_advances: 'Adelanto',
  barber_payments: 'Pago de sueldo',
  fixed_expenses: 'Gasto fijo',
  customers: 'Cliente',
  barbers: 'Barbero',
  services: 'Catálogo',
  reconciliations: 'Conciliación',
  month_closings: 'Cierre de mes',
  profiles: 'Usuario'
};

const ACTION_LABELS = { INSERT: 'cargó', UPDATE: 'corrigió', VOID: 'anuló', DELETE: 'quitó' };

const FIELD_LABELS = {
  amount: 'Monto',
  tip: 'Propina',
  payment_method: 'Medio de pago',
  barber_id: 'Barbero',
  service_name: 'Servicio',
  client_name: 'Cliente',
  client_phone: 'Celular',
  description: 'Detalle',
  note: 'Nota',
  charged_to_barber_id: 'Corresponde a',
  name: 'Nombre',
  price: 'Precio',
  birthdate: 'Cumpleaños',
  phone: 'Celular',
  active: 'Activo',
  pay_frequency: 'Frecuencia de pago'
};

const formatField = (field, value) => {
  if (value === null || value === undefined || value === '') return '—';
  if (field === 'barber_id') return store.barberName(value);
  if (field === 'charged_to_barber_id') return value ? `Solo ${store.barberName(value)}` : 'Sociedad';
  if (field === 'amount' || field === 'tip' || field === 'price') return money(value);
  if (field === 'active') return value ? 'sí' : 'no';
  return String(value);
};

const describeChanges = (entry) => {
  if (entry.action !== 'UPDATE' || !entry.old_data || !entry.new_data) return [];
  return Object.keys(FIELD_LABELS)
    .filter(field => field in entry.new_data && String(entry.old_data[field] ?? '') !== String(entry.new_data[field] ?? ''))
    .map(field => `${FIELD_LABELS[field]}: ${formatField(field, entry.old_data[field])} → ${formatField(field, entry.new_data[field])}`);
};

const describeRecord = (entry) => {
  const data = entry.new_data || entry.old_data || {};
  const date = data.movement_date ? `${formatDate(data.movement_date)} · ` : '';
  switch (entry.table_name) {
    case 'sales': return `${date}${data.client_name} · ${data.service_name} · ${money(Number(data.amount) + Number(data.tip || 0))} · ${store.barberName(data.barber_id)}`;
    case 'expenses': return `${date}${data.description} · ${money(data.amount)}`;
    case 'salary_advances': return `${date}${store.barberName(data.barber_id)} · ${money(data.amount)}`;
    case 'barber_payments': return `${date}${store.barberName(data.barber_id)} · ${money(data.amount)}`;
    case 'fixed_expenses': return `${date}${data.name} · ${money(data.amount)}`;
    case 'month_closings': return `Mes ${String(entry.record_id).slice(0, 7)}`;
    default: return data.name || data.display_name || '';
  }
};

export default function SettingsModal({ onClose }) {
  useStoreVersion();
  const [activeTab, setActiveTab] = useState('cambios');
  const [status, setStatus] = useState('');

  const tabs = [
    ['cambios', '🕓 Cambios recientes'],
    ['barberos', '👥 Barberos'],
    ['servicios', '✂️ Precios y catálogo'],
    ['backup', '🔐 Copia de seguridad']
  ];

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
    }}>
      <div className="glass-panel animate-fade-in" style={{
        width: '100%', maxWidth: '820px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        background: 'var(--bg-card)', overflow: 'hidden'
      }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(15, 23, 42, 0.8)' }}>
          <h3 style={{ fontSize: '1.25rem', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Settings size={22} />
            Configuración
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.6rem', cursor: 'pointer' }}>
            &times;
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.5)' }}>
          {tabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => { setActiveTab(id); setStatus(''); }}
              className="toggle-btn"
              style={{ borderRadius: 0, padding: '12px 16px', color: activeTab === id ? 'var(--accent-gold)' : 'var(--text-muted)', borderBottom: activeTab === id ? '2px solid var(--accent-gold)' : 'none' }}
            >
              {label}
            </button>
          ))}
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {status && <p role="status" style={{ color: '#fbbf24', fontSize: '0.88rem', marginBottom: '14px' }}>{status}</p>}
          {activeTab === 'cambios' && <AuditTab />}
          {activeTab === 'barberos' && <BarbersTab setStatus={setStatus} />}
          {activeTab === 'servicios' && <ServicesTab setStatus={setStatus} />}
          {activeTab === 'backup' && <BackupTab setStatus={setStatus} />}
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', background: 'rgba(15, 23, 42, 0.8)', display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={onClose} className="btn btn-primary">Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function AuditTab() {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState('');
  const [onlyOthers, setOnlyOthers] = useState(false);

  const load = useCallback(() => {
    store.auditLog(300).then(setEntries).catch(loadError => setError(loadError.message));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (error) return <p style={{ color: '#fb7185' }}>No se pudo cargar el historial: {error}</p>;
  if (!entries) return <p style={{ color: 'var(--text-muted)' }}>Cargando…</p>;

  const isOtherPersonChange = (entry) => entry.action !== 'INSERT'
    && entry.old_data?.created_by && entry.changed_by && entry.old_data.created_by !== entry.changed_by;
  const visible = entries.filter(entry => !onlyOthers || isOtherPersonChange(entry));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
        <h4 style={{ color: '#fb7185', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
          <ClipboardList size={20} /> Historial de cambios
        </h4>
        <div style={{ display: 'flex', gap: '8px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: 'var(--text-main)' }}>
            <input type="checkbox" checked={onlyOthers} onChange={(event) => setOnlyOthers(event.target.checked)} />
            Solo correcciones de lo cargado por otra persona
          </label>
          <button onClick={load} className="btn btn-secondary btn-sm">Actualizar</button>
        </div>
      </div>
      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
        Todo lo que se carga, corrige o anula queda acá con quién, cuándo y por qué. Nadie puede borrar este historial.
      </p>

      {visible.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-sm)' }}>
          No hay cambios para mostrar.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visible.map(entry => {
            const flagged = isOtherPersonChange(entry);
            const changes = describeChanges(entry);
            return (
              <div key={entry.id} style={{
                padding: '12px 14px', background: 'rgba(15, 23, 42, 0.65)', border: '1px solid var(--border-color)',
                borderLeft: `3px solid ${flagged ? '#f59e0b' : entry.action === 'VOID' ? '#f43f5e' : entry.action === 'INSERT' ? '#10b981' : '#38bdf8'}`,
                borderRadius: 'var(--radius-sm)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <strong style={{ color: 'var(--text-main)' }}>
                    {entry.changed_by_name} {ACTION_LABELS[entry.action]} · {TABLE_LABELS[entry.table_name] || entry.table_name}
                  </strong>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{formatDateTime(entry.changed_at)}</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{describeRecord(entry)}</div>
                {flagged && (
                  <div style={{ color: '#fbbf24', fontSize: '0.8rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <AlertTriangle size={13} /> Lo había cargado {store.userName(entry.old_data.created_by)}
                  </div>
                )}
                {changes.map(change => <div key={change} style={{ color: 'var(--text-main)', fontSize: '0.83rem', marginTop: '3px' }}>• {change}</div>)}
                {entry.reason && <div style={{ color: 'var(--text-main)', fontSize: '0.83rem', marginTop: '4px' }}>Motivo: “{entry.reason}”</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BarbersTab({ setStatus }) {
  const barbers = store.barbers({ includeInactive: true });
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');

  const save = async (barber, values) => {
    try {
      await store.updateBarber(barber.id, values);
      setStatus('Cambios guardados.');
      setEditingId(null);
    } catch (error) {
      setStatus(`No se guardó: ${error.message}`);
    }
  };

  return (
    <div>
      <h4 style={{ marginBottom: '14px', color: 'var(--text-main)' }}>Barberos</h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
        {barbers.map(barber => (
          <div key={barber.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
            padding: '12px 16px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
            opacity: barber.active ? 1 : 0.6
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {editingId === barber.id ? (
                <>
                  <input value={name} onChange={(event) => setName(event.target.value)} className="form-input" style={{ width: '160px', padding: '6px 8px' }} />
                  <button onClick={() => name.trim() && save(barber, { name: name.trim() })} className="btn btn-primary btn-sm"><Save size={14} /></button>
                  <button onClick={() => setEditingId(null)} className="btn btn-secondary btn-sm">Cancelar</button>
                </>
              ) : (
                <>
                  <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>{barber.name}</span>
                  {barber.is_partner && <span className="badge" style={{ background: 'rgba(167, 139, 250, 0.15)', color: '#c4b5fd' }}>Socio</span>}
                  {!barber.active && <span className="badge">Desactivado</span>}
                  <button onClick={() => { setEditingId(barber.id); setName(barber.name); }} className="btn btn-secondary btn-sm" title="Cambiar nombre"><Edit3 size={13} /></button>
                </>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span>Comisión <strong style={{ color: '#34d399' }}>{Math.round(barber.commission_rate * 100)}%</strong> + 100% propinas</span>
              <select
                value={barber.pay_frequency}
                onChange={(event) => save(barber, { pay_frequency: event.target.value })}
                className="form-select"
                style={{ width: 'auto', padding: '6px 8px' }}
              >
                <option value="weekly">Cobra los sábados</option>
                <option value="monthly">Cobra a fin de mes</option>
              </select>
              <button onClick={() => save(barber, { active: !barber.active })} className="btn btn-secondary btn-sm">
                {barber.active ? 'Desactivar' : 'Activar'}
              </button>
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
        Para que un barbero nuevo pueda entrar a la app hay que activar su usuario en Supabase (ver README, sección
        “Sumar un barbero nuevo”). Un barbero desactivado deja de aparecer para cargar ventas, pero su historial se conserva.
      </div>
    </div>
  );
}

function ServicesTab({ setStatus }) {
  const services = store.services({ includeInactive: true });
  const [filter, setFilter] = useState('todos');
  const [editingId, setEditingId] = useState(null);
  const [price, setPrice] = useState('');
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState('servicio');
  const [newPrice, setNewPrice] = useState('');

  const run = async (action, message) => {
    try {
      await action();
      setStatus(message);
    } catch (error) {
      setStatus(`No se guardó: ${error.message}`);
    }
  };

  const handleAdd = (event) => {
    event.preventDefault();
    if (!newName.trim() || newPrice === '') return;
    void run(async () => {
      await store.addService({ name: newName.trim(), type: newType, price: Number(newPrice), sort_order: services.length + 1 });
      setNewName('');
      setNewPrice('');
    }, 'Agregado al catálogo.');
  };

  const visible = services.filter(item => filter === 'todos' || item.type === filter);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <h4 style={{ color: 'var(--text-main)', margin: 0 }}>Catálogo de servicios y productos</h4>
        <div className="toggle-group" style={{ margin: 0 }}>
          {[['todos', `Todos (${services.length})`], ['servicio', 'Servicios ✂️'], ['producto', 'Productos 🧴']].map(([id, label]) => (
            <button key={id} className={`toggle-btn ${filter === id ? 'active' : ''}`} onClick={() => setFilter(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
        {visible.map(item => (
          <div key={item.id} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px',
            padding: '12px 16px', background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)',
            opacity: item.active ? 1 : 0.55
          }}>
            <div>
              <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.name}</span>
              <span className={`badge ${item.type === 'producto' ? 'badge-transferencia' : 'badge-gold'}`} style={{ marginLeft: '10px', textTransform: 'capitalize' }}>{item.type}</span>
              {!item.active && <span className="badge" style={{ marginLeft: '6px' }}>Oculto</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {editingId === item.id ? (
                <>
                  <span style={{ color: 'var(--accent-gold)', fontWeight: 700 }}>$</span>
                  <input type="number" min="0" step="any" value={price} onChange={(event) => setPrice(event.target.value)} className="form-input" style={{ width: '110px', padding: '4px 8px' }} autoFocus />
                  <button onClick={() => price !== '' && run(async () => { await store.updateService(item.id, { price: Number(price) }); setEditingId(null); }, 'Precio actualizado.')} className="btn btn-primary btn-sm" style={{ background: '#10b981' }}>
                    <Save size={14} /> Guardar
                  </button>
                </>
              ) : (
                <>
                  <span style={{ fontWeight: 800, color: 'var(--accent-gold)', fontSize: '1.1rem' }}>{money(item.price)}</span>
                  <button onClick={() => { setEditingId(item.id); setPrice(String(item.price)); }} className="btn btn-secondary btn-sm"><Edit3 size={14} /> Precio</button>
                  <button onClick={() => run(() => store.updateService(item.id, { active: !item.active }), item.active ? 'Ocultado del catálogo.' : 'Visible en el catálogo.')} className="btn btn-secondary btn-sm">
                    {item.active ? 'Ocultar' : 'Mostrar'}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleAdd} style={{ background: 'rgba(255,255,255,0.03)', padding: '18px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
        <h5 style={{ marginBottom: '14px', color: 'var(--accent-gold)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Plus size={18} /> Agregar servicio o producto
        </h5>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
          <input type="text" placeholder="Nombre" value={newName} onChange={(event) => setNewName(event.target.value)} className="form-input" required />
          <select value={newType} onChange={(event) => setNewType(event.target.value)} className="form-select">
            <option value="servicio">✂️ Servicio</option>
            <option value="producto">🧴 Producto</option>
          </select>
          <input type="number" min="0" step="any" placeholder="Precio $" value={newPrice} onChange={(event) => setNewPrice(event.target.value)} className="form-input" required />
          <button type="submit" className="btn btn-primary"><Plus size={16} /> Agregar</button>
        </div>
      </form>
    </div>
  );
}

function BackupTab({ setStatus }) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    setStatus('Preparando la copia desde Supabase…');
    try {
      const json = await store.exportBackup();
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_barberia_${todayISO()}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('Copia descargada. Guardala en un lugar privado: tiene datos de clientes.');
    } catch (error) {
      setStatus(`No se pudo descargar la copia: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div>
      <h4 style={{ marginBottom: '14px', color: '#a78bfa', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <ShieldCheck size={20} /> Copias de seguridad
      </h4>
      <ul style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginBottom: '20px', paddingLeft: '18px', display: 'grid', gap: '6px' }}>
        <li>Todas las noches se guarda automáticamente una copia completa en el Google Drive de la barbería y otra en GitHub.</li>
        <li>Nada se borra: las correcciones y anulaciones quedan en el historial de cambios.</li>
        <li>Con este botón podés bajar además una copia en este momento (por ejemplo, antes de cerrar un mes).</li>
      </ul>
      <button onClick={handleExport} disabled={isExporting} className="btn btn-secondary" style={{ width: '100%', maxWidth: '360px' }}>
        <Download size={16} /> {isExporting ? 'Preparando…' : 'Descargar copia completa ahora (JSON)'}
      </button>
    </div>
  );
}
