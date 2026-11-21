// Fechas siempre en hora de Córdoba, sin depender de la zona del celular.
export const TIME_ZONE = 'America/Argentina/Cordoba';

const isoDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});

export const todayISO = (now = new Date()) => isoDateFormatter.format(now);

export const monthOf = (isoDate) => isoDate.slice(0, 7);

export const currentMonth = (now = new Date()) => monthOf(todayISO(now));

export const monthStart = (month) => `${month}-01`;

export const monthEnd = (month) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  return `${month}-${String(lastDay).padStart(2, '0')}`;
};

export const formatDate = (isoDate) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

export const formatTime = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleTimeString('es-AR', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatDateTime = (timestamp) => {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleString('es-AR', {
    timeZone: TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const formatMonthName = (month) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 15)).toLocaleDateString('es-AR', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric'
  });
};

export const isBirthdayOn = (birthdate, isoDate) => {
  if (!birthdate || !isoDate) return false;
  const parts = birthdate.replace(/\//g, '-').trim().split('-').map(part => Number.parseInt(part, 10));
  const target = { month: Number(isoDate.slice(5, 7)), day: Number(isoDate.slice(8, 10)) };
  if (parts.length === 3) return parts[1] === target.month && parts[2] === target.day;
  if (parts.length !== 2 || parts.some(Number.isNaN)) return false;
  const [first, second] = parts;
  // Se acepta MM-DD (formato de carga) y DD/MM (formato habitual).
  return (first === target.month && second === target.day)
    || (first === target.day && second === target.month);
};
