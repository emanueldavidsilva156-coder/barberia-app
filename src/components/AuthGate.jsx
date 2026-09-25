import React, { useEffect, useState } from 'react';
import App from '../App.jsx';
import AuthScreen from './AuthScreen.jsx';
import { storageService } from '../services/storageService';

const AUTH_KEY = 'barberflow_local_auth';

export default function AuthGate() {
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem(AUTH_KEY) === 'true');

  const handleLogin = () => {
    localStorage.setItem(AUTH_KEY, 'true');
    setIsLoggedIn(true);
  };

  const handleSignOut = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsLoggedIn(false);
  };

  useEffect(() => {
    if (!isLoggedIn) return undefined;

    void storageService.initializeSharedData().catch((error) => {
      console.error('No se pudo sincronizar la información compartida:', error);
    });
  }, [isLoggedIn]);

  if (!isLoggedIn) return <AuthScreen onLogin={handleLogin} />;
  return <App onSignOut={handleSignOut} />;
}