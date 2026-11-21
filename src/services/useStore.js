import { useEffect, useSyncExternalStore } from 'react';
import { store } from './store.js';

// Vuelve a dibujar el componente cada vez que cambian los datos (propios o de otro celular).
export const useStoreVersion = () => useSyncExternalStore(store.subscribe, store.getVersion);

// Ejecuta `callback` cuando cambia alguna de las tablas indicadas (con una pequeña espera
// para agrupar varios cambios seguidos).
export const useDataChange = (tables, callback) => {
  useEffect(() => {
    let timer;
    const unsubscribe = store.onDataChange((table) => {
      if (table !== 'all' && !tables.includes(table)) return;
      clearTimeout(timer);
      timer = setTimeout(callback, 300);
    });
    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [tables, callback]);
};
