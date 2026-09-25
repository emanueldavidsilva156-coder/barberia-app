import React, { useState, Suspense, lazy } from 'react';
import Navbar from './components/Navbar';
import { storageService } from './services/storageService';

const DailyCashRegister = lazy(() => import('./components/DailyCashRegister'));
const CustomerDatabase = lazy(() => import('./components/CustomerDatabase'));
const MonthlySummary = lazy(() => import('./components/MonthlySummary'));
const SettingsModal = lazy(() => import('./components/SettingsModal'));

export default function App({ onSignOut }) {
  const [activeTab, setActiveTab] = useState('caja'); // 'caja' | 'clientes' | 'resumen'
  const [userRole, setUserRole] = useState(storageService.getUserRole()); // 'admin' | 'barber'
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Navigation Header with Role Protection */}
      <Navbar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab}
        userRole={userRole}
        setUserRole={setUserRole}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onSignOut={onSignOut}
      />

      {/* Main View Content */}
      <main className="main-content" style={{ flex: 1, padding: '10px 0' }}>
        <Suspense fallback={<div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Cargando...</div>}>
          {activeTab === 'caja' && <DailyCashRegister />}
          {activeTab === 'clientes' && <CustomerDatabase />}
          {activeTab === 'resumen' && <MonthlySummary />}
        </Suspense>
      </main>

      {/* Modal Settings */}
      <Suspense fallback={null}>
        <SettingsModal 
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
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
