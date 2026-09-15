import React, { useState } from 'react';
import { LockKeyhole, Save } from 'lucide-react';
import { authService } from '../services/storageService';

export default function PasswordSetup() {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    const { error: updateError } = await authService.updatePassword(password);
    if (updateError) {
      setError('No se pudo guardar la contraseña. Volvé a solicitar el correo.');
      return;
    }
    setSaved(true);
  };

  if (saved) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
        <section className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '32px', textAlign: 'center' }}>
          <h2 style={{ color: '#34d399', marginBottom: '10px' }}>Contraseña actualizada</h2>
          <p style={{ color: 'var(--text-muted)' }}>Ya podés cerrar esta ventana y entrar con tu email y contraseña nueva.</p>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '24px' }}>
      <section className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '32px' }}>
        <h2 style={{ color: 'var(--text-main)', marginBottom: '8px' }}><LockKeyhole size={22} /> Crear contraseña</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '20px' }}>Elegí la contraseña para tu cuenta de BarberFlow.</p>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Nueva contraseña</label>
            <input className="form-input" type="password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="new-password" />
          </div>
          <div className="form-group">
            <label className="form-label">Repetir contraseña</label>
            <input className="form-input" type="password" minLength={6} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required autoComplete="new-password" />
          </div>
          {error && <p style={{ color: '#fb7185', fontSize: '0.85rem', marginBottom: '14px' }}>{error}</p>}
          <button className="btn btn-primary btn-lg" type="submit" style={{ width: '100%' }}><Save size={18} /> Guardar contraseña</button>
        </form>
      </section>
    </main>
  );
}