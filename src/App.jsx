import { useState, useEffect, Suspense, lazy } from 'react';
import Navbar from './components/Navbar';
import { storageService } from './services/storageService';

const DailyCashRegister = lazy(() => import('./components/DailyCashRegister'));
const CustomerDatabase = lazy(() => import('./components/CustomerDatabase'));
const MonthlySummary = lazy(() => import('./components/MonthlySummary'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));

export default function App({ onSignOut, userRole }) {
  const [activeTab, setActiveTab] = useState('caja'); // 'caja' | 'clientes' | 'resumen'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => storageService.onSyncStatus(({ status, error }) => {
    setSyncError(status === 'error' ? error : '');
    setIsSyncing(status === 'syncing');
  }), []);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Navigation Header with Role Protection */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        userRole={userRole}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSignOut={onSignOut}
      />

      {isSyncing && !syncError && (
        <div role="status" style={{ padding: '8px 16px', background: '#78350f', color: '#fff', textAlign: 'center' }}>
          Guardando cambios en Supabase… Esperá a que termine la sincronización.
        </div>
      )}

      {syncError && (
        <div role="alert" style={{ padding: '10px 16px', background: '#7f1d1d', color: '#fff', textAlign: 'center' }}>
          No se pudo guardar en Supabase: {syncError}
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginLeft: '12px' }}
            onClick={() => storageService.syncPendingChanges().catch(() => {})}
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Main View Content */}
      <main className="main-content" style={{ flex: 1, padding: '10px 0' }}>
        <Suspense fallback={<div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>}>
          {activeTab === 'caja' && <DailyCashRegister isAdmin={userRole === 'admin'} />}
          {activeTab === 'clientes' && <CustomerDatabase isAdmin={userRole === 'admin'} />}
          {userRole === 'admin' && activeTab === 'resumen' && <MonthlySummary />}
        </Suspense>
      </main>

      {/* Modal Settings */}
      <Suspense fallback={null}>
        {userRole === 'admin' && (
          <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
          />
        )}
      </Suspense>

      {/* Desktop Footer */}
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
