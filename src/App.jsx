import React, { useState } from 'react';
import Navbar from './components/Navbar';
import DailyCashRegister from './components/DailyCashRegister';
import CustomerDatabase from './components/CustomerDatabase';
import MonthlySummary from './components/MonthlySummary';
import SettingsModal from './components/SettingsModal';
import { storageService } from './services/storageService';

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
        {activeTab === 'caja' && <DailyCashRegister />}
        {activeTab === 'clientes' && <CustomerDatabase />}
        {activeTab === 'resumen' && <MonthlySummary />}
      </main>

      {/* Modal Settings */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Desktop Footer */}
      <footer style={{
        textAlign: 'center',
        padding: '16px 20px',
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        borderTop: '1px solid var(--border-color)',
        background: 'rgba(15, 23, 42, 0.6)'
      }}>
        BarberFlow Pro &copy; {new Date().getFullYear()} - Sistema de Gestión, Caja Diaria y Finanzas para Ema y Diego Barbería.
      </footer>

    </div>
  );
}
