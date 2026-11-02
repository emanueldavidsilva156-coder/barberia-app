import { useCallback, useEffect, useState } from 'react';
import App from '../App.jsx';
import AuthScreen from './AuthScreen.jsx';
import { authService, storageService } from '../services/storageService';

export default function AuthGate() {
  const [status, setStatus] = useState('checking');
  const [error, setError] = useState('');
  const [userRole, setUserRole] = useState(null);

  const initializeApp = useCallback(async (session) => {
    setStatus('loading');
    setError('');
    try {
      storageService.setAuthenticatedUser(session.role, session.user.id);
      setUserRole(session.role);
      await storageService.initializeSharedData();
      setStatus('ready');
    } catch (syncError) {
      setError(syncError.message || 'No se pudo conectar con la base de datos.');
      setStatus('error');
    }
  }, []);

  const restoreSession = useCallback(async () => {
    try {
      const session = await authService.getSession();
      if (!session) {
        setStatus('login');
        return;
      }
      await initializeApp(session);
    } catch (sessionError) {
      setError(sessionError.message || 'No se pudo validar la sesión.');
      setStatus('error');
    }
  }, [initializeApp]);

  useEffect(() => {
    void restoreSession();
  }, [restoreSession]);

  const handleLogin = async (username, password) => {
    setError('');
    try {
      const session = await authService.signIn(username, password);
      await initializeApp(session);
    } catch (loginError) {
      setError(loginError.message || 'No se pudo iniciar sesión.');
      setStatus('login');
      throw loginError;
    }
  };

  const handleSignOut = async () => {
    try {
      await authService.signOut();
    } catch (signOutError) {
      setError(signOutError.message || 'No se pudo cerrar la sesión en el servidor.');
    } finally {
      storageService.clearSensitiveLocalData();
      setUserRole(null);
      setStatus('login');
    }
  };

  if (status === 'checking' || status === 'loading') {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text-muted)' }}>
        {status === 'checking' ? 'Verificando sesión...' : 'Conectando con Supabase...'}
      </main>
    );
  }
  if (status === 'login') {
    return <AuthScreen onLogin={handleLogin} error={error} isConfigured={authService.isConfigured()} />;
  }
  if (status === 'error') {
    return (
      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '14px', color: 'var(--text-muted)' }}>
        <p>{error}</p>
        <button className="btn btn-primary" onClick={() => void restoreSession()}>Reintentar conexión</button>
        <button className="btn btn-secondary" onClick={() => void handleSignOut()}>Volver al inicio de sesión</button>
      </main>
    );
  }
  return <App userRole={userRole} onSignOut={handleSignOut} />;
}