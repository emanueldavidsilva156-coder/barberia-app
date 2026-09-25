import React, { useState } from 'react';
import { storageService } from '../services/storageService';
import { Calendar, Users, TrendingUp, Settings, Scissors, DollarSign, Lock, ShieldCheck, LogOut } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, userRole, setUserRole, onOpenSettings, onSignOut }) {
  const [showPinModal, setShowPinModal] = useState(false);
  const [inputPin, setInputPin] = useState('');
  const [pinError, setPinError] = useState(false);
  const [targetTabAfterPin, setTargetTabAfterPin] = useState(null);

  const handleTabClick = (tabId) => {
    if (tabId === 'resumen' && userRole !== 'admin') {
      setTargetTabAfterPin('resumen');
      setShowPinModal(true);
      return;
    }
    setActiveTab(tabId);
  };

  const handleOpenSettingsClick = () => {
    if (userRole !== 'admin') {
      setTargetTabAfterPin('settings');
      setShowPinModal(true);
      return;
    }
    onOpenSettings();
  };

  const handleVerifyPin = (e) => {
    e.preventDefault();
    const isValid = storageService.verifyAdminPIN(inputPin);
    if (isValid) {
      storageService.setUserRole('admin');
      setUserRole('admin');
      setShowPinModal(false);
      setInputPin('');
      setPinError(false);

      if (targetTabAfterPin === 'resumen') {
        setActiveTab('resumen');
      } else if (targetTabAfterPin === 'settings') {
        onOpenSettings();
      }
      setTargetTabAfterPin(null);
    } else {
      setPinError(true);
    }
  };

  const handleSwitchToBarberRole = () => {
    storageService.setUserRole('barber');
    setUserRole('barber');
    if (activeTab === 'resumen') {
      setActiveTab('caja');
    }
  };

  return (
    <>
      {/* Desktop & Tablet Header */}
      <header className="desktop-header" style={{
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-color)',
        position: 'sticky',
        top: 0,
        zIndex: 90,
        padding: '12px 24px'
      }}>
        <div className="header-row" style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Logo */}
          <div className="header-brand" style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }} onClick={() => handleTabClick('caja')}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, var(--primary) 0%, #f59e0b 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              boxShadow: 'var(--shadow-glow)'
            }}>
              <Scissors size={22} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', color: 'var(--text-main)', margin: 0, lineHeight: 1.1 }}>
                BARBERIA <span style={{ color: 'var(--accent-gold)' }}>RADIKAL</span>
              </h1>
            </div>
          </div>

          {/* Nav Tabs */}
          <nav className="desktop-nav-menu" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Caja Diaria: Accessible to all */}
            <button
              onClick={() => handleTabClick('caja')}
              className="btn"
              style={{
                background: activeTab === 'caja' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'caja' ? 'var(--accent-gold)' : 'var(--text-muted)',
                border: activeTab === 'caja' ? '1px solid var(--border-focus)' : '1px solid transparent',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <DollarSign size={18} />
              <span>Caja Diaria</span>
            </button>

            {/* Clientes & WhatsApp */}
            <button
              onClick={() => handleTabClick('clientes')}
              className="btn"
              style={{
                background: activeTab === 'clientes' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'clientes' ? 'var(--accent-gold)' : 'var(--text-muted)',
                border: activeTab === 'clientes' ? '1px solid var(--border-focus)' : '1px solid transparent',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <Users size={18} />
              <span>Clientes & WA</span>
            </button>

            {/* Resumen Mensual Contable (Protected for Admin Ema) */}
            <button
              onClick={() => handleTabClick('resumen')}
              className="btn"
              style={{
                background: activeTab === 'resumen' ? 'var(--primary-light)' : 'transparent',
                color: activeTab === 'resumen' ? 'var(--accent-gold)' : 'var(--text-muted)',
                border: activeTab === 'resumen' ? '1px solid var(--border-focus)' : '1px solid transparent',
                padding: '8px 16px',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              <TrendingUp size={18} />
              <span>Resumen Mensual</span>
              {userRole !== 'admin' && <Lock size={13} style={{ marginLeft: '4px', opacity: 0.7 }} />}
            </button>
          </nav>

          {/* Role Switcher Badge & Settings */}
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {userRole === 'admin' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 12px' }}>
                  <ShieldCheck size={14} /> Modo Admin (Ema)
                </span>
                <button 
                  onClick={handleSwitchToBarberRole} 
                  className="btn btn-secondary btn-sm"
                  title="Cambiar a Modo Barbero"
                >
                  Bloquear
                </button>
              </div>
            ) : (
              <button 
                onClick={() => { setTargetTabAfterPin(null); setShowPinModal(true); }}
                className="btn btn-secondary btn-sm"
                style={{ color: 'var(--accent-gold)' }}
              >
                <Lock size={14} />
                <span>Ingreso Admin</span>
              </button>
            )}

            <button
              onClick={handleOpenSettingsClick}
              className="btn btn-secondary btn-sm"
              title="Configuración"
            >
              <Settings size={18} />
            </button>
            <button
              onClick={onSignOut}
              className="btn btn-secondary btn-sm"
              title="Cerrar sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-nav">
        <button
          onClick={() => handleTabClick('caja')}
          className={`mobile-nav-item ${activeTab === 'caja' ? 'active' : ''}`}
        >
          <DollarSign size={20} />
          <span>Caja</span>
        </button>

        <button
          onClick={() => handleTabClick('clientes')}
          className={`mobile-nav-item ${activeTab === 'clientes' ? 'active' : ''}`}
        >
          <Users size={20} />
          <span>Clientes</span>
        </button>

        <button
          onClick={() => handleTabClick('resumen')}
          className={`mobile-nav-item ${activeTab === 'resumen' ? 'active' : ''}`}
        >
          <TrendingUp size={20} />
          <span>Resumen</span>
        </button>
      </nav>

      {/* PIN VERIFICATION MODAL FOR ADMIN ACCESS */}
      {showPinModal && (
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
          <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '24px', background: 'var(--bg-card)' }}>
            
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '56px', height: '56px', borderRadius: '50%',
                background: 'rgba(217, 119, 6, 0.15)', color: 'var(--accent-gold)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px auto'
              }}>
                <Lock size={28} />
              </div>
              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>Acceso Restringido</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Ingresá la clave PIN de Administrador (Ema) para ver la contabilidad y ajustes
              </p>
            </div>

            <form onSubmit={handleVerifyPin}>
              <div className="form-group" style={{ marginBottom: '20px' }}>
                <input 
                  type="password"
                  placeholder="PIN (ej. 1234)"
                  value={inputPin}
                  onChange={(e) => setInputPin(e.target.value)}
                  className="form-input"
                  style={{
                    fontSize: '1.4rem',
                    textAlign: 'center',
                    letterSpacing: '0.3em',
                    fontWeight: 800,
                    color: 'var(--accent-gold)'
                  }}
                  autoFocus
                  required
                />
                {pinError && (
                  <span style={{ fontSize: '0.8rem', color: '#f43f5e', textAlign: 'center', marginTop: '6px', display: 'block' }}>
                    PIN incorrecto. Intentá nuevamente.
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  type="button" 
                  onClick={() => { setShowPinModal(false); setInputPin(''); setPinError(false); }}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  Ingresar
                </button>
              </div>
            </form>

            <div style={{ marginTop: '16px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-dark)' }}>
              PIN por defecto: <code>1234</code> (Editable en Ajustes)
            </div>

          </div>
        </div>
      )}
    </>
  );
}
