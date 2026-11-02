import { Users, TrendingUp, Settings, Scissors, DollarSign, ShieldCheck, LogOut } from 'lucide-react';

export default function Navbar({ activeTab, setActiveTab, userRole, onOpenSettings, onSignOut }) {
  const isAdmin = userRole === 'admin';

  const handleTabClick = (tabId) => {
    if (tabId === 'resumen' && !isAdmin) return;
    setActiveTab(tabId);
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
            {isAdmin && <button
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
            </button>}
          </nav>

          {/* Role Switcher Badge & Settings */}
          <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="badge" style={{ background: isAdmin ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)', color: isAdmin ? '#34d399' : 'var(--text-muted)', border: '1px solid var(--border-color)', padding: '6px 12px' }}>
              <ShieldCheck size={14} /> {isAdmin ? 'Administración' : 'Empleado'}
            </span>

            {isAdmin && <button
              onClick={onOpenSettings}
              className="btn btn-secondary btn-sm"
              title="Configuración"
            >
              <Settings size={18} />
            </button>}
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

        {isAdmin && <button
          onClick={() => handleTabClick('resumen')}
          className={`mobile-nav-item ${activeTab === 'resumen' ? 'active' : ''}`}
        >
          <TrendingUp size={20} />
          <span>Resumen</span>
        </button>}
      </nav>
    </>
  );
}
