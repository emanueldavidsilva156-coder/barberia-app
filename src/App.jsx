import { useState, Suspense, lazy } from 'react';
import Navbar from './components/Navbar';
import { store } from './services/store.js';
import { useStoreVersion } from './services/useStore.js';

const DailyCashRegister = lazy(() => import('./components/DailyCashRegister'));
const CustomerDatabase = lazy(() => import('./components/CustomerDatabase'));
const MonthlySummary = lazy(() => import('./components/MonthlySummary'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));

export default function App({ onSignOut, profile }) {
  useStoreVersion();
  const [activeTab, setActiveTab] = useState('caja'); // 'caja' | 'clientes' | 'resumen'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const isAdmin = profile.role === 'admin';

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        profile={profile}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSignOut={onSignOut}
      />

      {store.connection !== 'online' && (
        <div role="status" style={{ padding: '8px 16px', background: '#78350f', color: '#fff', textAlign: 'center', fontSize: '0.9rem' }}>
          Conectando en tiempo real… Si no tenés internet, lo que cargues no se va a guardar hasta que vuelva la conexión.
        </div>
      )}

      {store.error && (
        <div role="alert" style={{ padding: '10px 16px', background: '#7f1d1d', color: '#fff', textAlign: 'center' }}>
          {store.error}
          <button className="btn btn-secondary btn-sm" style={{ marginLeft: '12px' }} onClick={store.clearError}>
            Cerrar
          </button>
        </div>
      )}

      <main className="main-content" style={{ flex: 1, padding: '10px 0' }}>
        <Suspense fallback={<div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>}>
          {activeTab === 'caja' && <DailyCashRegister />}
          {activeTab === 'clientes' && <CustomerDatabase />}
          {activeTab === 'resumen' && <MonthlySummary />}
        </Suspense>
      </main>

      <Suspense fallback={null}>
        {isAdmin && isSettingsOpen && (
          <SettingsModal onClose={() => setIsSettingsOpen(false)} />
        )}
      </Suspense>

      <footer style={{
        textAlign: 'center',
        padding: '16px 20px',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border-color)',
        background: 'rgba(15, 23, 42, 0.6)'
      }}>
        RADIKAL &copy; {new Date().getFullYear()} - Sistema de Gestión, Caja Diaria y Finanzas para la barbería.
      </footer>
    </div>
  );
}
