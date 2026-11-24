// Backup diario de Barbería Radikal en el Google Drive de barber.radikal@gmail.com
//
// Se instala UNA vez desde script.google.com con la cuenta de la barbería
// (ver README, "Backup en Google Drive"). Todas las noches a las 3 AM (hora de
// Córdoba) guarda una copia de todas las tablas en la carpeta
// "Barberia - Backups Supabase". Las copias se guardan comprimidas (.json.gz)
// y no se borran nunca. Si el Drive se está llenando, manda un aviso por mail.
//
// Si Supabase no responde (errores 5xx como 522, 429 o cortes de red), cada
// consulta se reintenta sola unas veces. Si aun así falla, el backup completo se
// vuelve a probar cada 1 hora, hasta 3 veces; el mail de error de Google llega
// solo si fallan todos los intentos.
//
// Propiedades del script que hay que cargar (Configuración del proyecto >
// Propiedades del script):
//   SUPABASE_URL               https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  la clave secreta (sb_secret_... o la service_role vieja): solo acá

const BACKUP_FOLDER_NAME = 'Barberia - Backups Supabase';
const DAILY_BACKUP_FUNCTION = 'createSupabaseDriveBackup';
const BACKUP_TIME_ZONE = 'America/Argentina/Cordoba';
const DRIVE_WARNING_RATIO = 0.8;
const RETRY_FUNCTION = 'retrySupabaseDriveBackup';
// Esperas entre intentos de una misma consulta, en segundos (Apps Script corta a los 6 minutos).
const FETCH_RETRY_WAITS = [5, 20, 40];
const LATER_RETRY_MINUTES = 60;
const MAX_LATER_RETRIES = 3;

// Tabla -> columna para ordenar (necesario para leer por páginas sin saltear filas).
const TABLES = {
  barbers: 'id',
  profiles: 'user_id',
  services: 'id',
  customers: 'id',
  sales: 'id',
  expenses: 'id',
  salary_advances: 'id',
  barber_payments: 'id',
  fixed_expenses: 'id',
  reconciliations: 'id',
  month_closings: 'month',
  audit_log: 'id'
};

function installDailyBackup() {
  getConfig_();
  runBackup_();

  deleteTriggers_(DAILY_BACKUP_FUNCTION);
  ScriptApp.newTrigger(DAILY_BACKUP_FUNCTION)
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .inTimezone(BACKUP_TIME_ZONE)
    .create();
}

// Corre todas las noches a las 3 AM.
function createSupabaseDriveBackup() {
  PropertiesService.getScriptProperties().setProperty('LATER_RETRIES', '0');
  attemptBackup_();
}

// Reintento programado cuando el backup de la noche no pudo terminar.
function retrySupabaseDriveBackup() {
  attemptBackup_();
}

function attemptBackup_() {
  deleteTriggers_(RETRY_FUNCTION);
  try {
    runBackup_();
  } catch (error) {
    const properties = PropertiesService.getScriptProperties();
    const retries = Number(properties.getProperty('LATER_RETRIES') || 0);
    // Errores que no se arreglan solos (clave mal cargada, tabla inexistente) se avisan enseguida.
    if (error.permanent || retries >= MAX_LATER_RETRIES) throw error;
    properties.setProperty('LATER_RETRIES', String(retries + 1));
    ScriptApp.newTrigger(RETRY_FUNCTION).timeBased().after(LATER_RETRY_MINUTES * 60 * 1000).create();
    console.warn(`El backup falló (${error.message}). Reintento ${retries + 1} de ${MAX_LATER_RETRIES} en ${LATER_RETRY_MINUTES} minutos.`);
  }
}

function deleteTriggers_(handlerFunction) {
  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === handlerFunction)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));
}

function runBackup_() {
  const { baseUrl, headers } = getConfig_();
  const timestamp = new Date();
  const tables = {};
  const counts = {};

  Object.keys(TABLES).forEach(table => {
    tables[table] = fetchTable_(baseUrl, table, TABLES[table], headers);
    counts[table] = tables[table].length;
  });

  const backup = {
    createdAt: timestamp.toISOString(),
    source: 'Supabase',
    counts,
    tables
  };

  const name = `backup_barberia_${Utilities.formatDate(timestamp, BACKUP_TIME_ZONE, 'yyyy-MM-dd_HH-mm')}.json`;
  const blob = Utilities.newBlob(JSON.stringify(backup), 'application/json', name);
  const folder = getBackupFolder_();
  folder.createFile(Utilities.gzip(blob, `${name}.gz`));

  warnIfDriveIsFilling_();
}

function fetchTable_(baseUrl, table, orderColumn, headers) {
  const rows = [];
  const pageSize = 1000;

  for (let start = 0; ; start += pageSize) {
    const text = fetchWithRetry_(table, `${baseUrl}/rest/v1/${table}?select=*&order=${orderColumn}.asc`, {
      method: 'get',
      headers: { ...headers, 'Range-Unit': 'items', Range: `${start}-${start + pageSize - 1}` },
      muteHttpExceptions: true
    });
    const page = JSON.parse(text);
    if (!Array.isArray(page)) {
      throw new Error(`La respuesta de ${table} no tiene el formato esperado; no se guardó el backup.`);
    }
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function fetchWithRetry_(table, url, options) {
  for (let attempt = 0; ; attempt++) {
    let status;
    let text;
    try {
      const response = UrlFetchApp.fetch(url, options);
      status = response.getResponseCode();
      text = response.getContentText();
    } catch (error) {
      // Sin respuesta: tiempo de espera agotado o corte de red.
      status = 0;
      text = error.message;
    }
    if (status >= 200 && status < 300) return text;

    const transient = status === 0 || status === 429 || status >= 500;
    if (!transient || attempt >= FETCH_RETRY_WAITS.length) {
      const error = new Error(`No se pudo respaldar la tabla ${table}. Supabase respondió ` +
        `${status ? `HTTP ${status}` : 'sin conexión'} (intento ${attempt + 1}): ${text.slice(0, 300)}`);
      error.permanent = !transient;
      throw error;
    }
    Utilities.sleep(FETCH_RETRY_WAITS[attempt] * 1000);
  }
}

function getConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const supabaseUrl = properties.getProperty('SUPABASE_URL');
  const serviceRoleKey = (properties.getProperty('SUPABASE_SERVICE_ROLE_KEY') || '').trim();
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configurá SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en las propiedades del script.');
  }
  const headers = { apikey: serviceRoleKey, Accept: 'application/json' };
  // Las claves nuevas (sb_secret_...) van solo en "apikey"; la service_role vieja (JWT) también como Bearer.
  if (serviceRoleKey.startsWith('eyJ')) headers.Authorization = `Bearer ${serviceRoleKey}`;
  return { baseUrl: supabaseUrl.trim().replace(/\/+$/, ''), headers };
}

function getBackupFolder_() {
  const properties = PropertiesService.getScriptProperties();
  const folderId = properties.getProperty('DRIVE_FOLDER_ID');
  if (folderId) return DriveApp.getFolderById(folderId);

  const existing = DriveApp.getFoldersByName(BACKUP_FOLDER_NAME);
  const folder = existing.hasNext() ? existing.next() : DriveApp.createFolder(BACKUP_FOLDER_NAME);
  properties.setProperty('DRIVE_FOLDER_ID', folder.getId());
  return folder;
}

function warnIfDriveIsFilling_() {
  const limit = DriveApp.getStorageLimit();
  const used = DriveApp.getStorageUsed();
  if (!limit || used / limit < DRIVE_WARNING_RATIO) return;
  const percent = Math.round((used / limit) * 100);
  MailApp.sendEmail(
    Session.getEffectiveUser().getEmail(),
    'Barbería: el Google Drive está casi lleno',
    `El Drive de la barbería está al ${percent}%. Los backups siguen funcionando, pero conviene liberar espacio ` +
    `(por ejemplo, borrar archivos que no sean backups) antes de que se llene.`
  );
}
