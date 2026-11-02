import { useState } from 'react';
import { LockKeyhole, Mail, Scissors, LogIn } from 'lucide-react';

export default function AuthScreen({ onLogin, isConfigured, error: initialError = '' }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(initialError);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await onLogin(email.trim(), password);
    } catch (loginError) {
      setError(loginError.message || 'No se pudo iniciar sesión.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
      <section className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '56px', height: '56px', margin: '0 auto 14px', display: 'grid', placeItems: 'center', borderRadius: '14px', background: 'linear-gradient(135deg, var(--primary), #f59e0b)', color: '#fff' }}>
            <Scissors size={28} />
          </div>
          <h1 style={{ color: 'var(--text-main)', marginBottom: '6px' }}>RADIKAL</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Ingresá para acceder a la barbería
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {!isConfigured && (
            <p style={{ color: '#fbbf24', fontSize: '0.85rem', marginBottom: '14px' }}>
              Falta configurar Supabase para habilitar el inicio de sesión.
            </p>
          )}
          <div className="form-group">
            <label className="form-label"><Mail size={14} /> Email</label>
            <input className="form-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="username" />
          </div>

          <div className="form-group">
            <label className="form-label"><LockKeyhole size={14} /> Contraseña</label>
            <input className="form-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" />
          </div>

          {error && <p style={{ color: '#fb7185', fontSize: '0.85rem', marginBottom: '14px' }}>{error}</p>}

          <button className="btn btn-primary btn-lg" type="submit" style={{ width: '100%' }} disabled={!isConfigured || isSubmitting}>
            <LogIn size={18} /> Ingresar
          </button>
        </form>
      </section>
    </main>
  );
}