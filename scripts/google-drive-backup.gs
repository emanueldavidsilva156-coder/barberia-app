// Backup diario de Barbería Radikal en el Google Drive de barber.radikal@gmail.com
//
// Se instala UNA vez desde script.google.com con la cuenta de la barbería
// (ver README, "Backup en Google Drive"). Todas las noches a las 3 AM (hora de
// Córdoba) guarda una copia de todas las tablas en la carpeta
// "Barberia - Backups Supabase". Las copias se guardan comprimidas (.json.gz)
// y no se borran nunca. Si el Drive se está llenando, manda un aviso por mail.
//
// Propiedades del script que hay que cargar (Configuración del proyecto >
// Propiedades del script):
//   SUPABASE_URL               https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY  la clave service_role (secreta: solo acá)

const BACKUP_FOLDER_NAME = 'Barberia - Backups Supabase';
const DAILY_BACKUP_FUNCTION = 'createSupabaseDriveBackup';
const BACKUP_TIME_ZONE = 'America/Argentina/Cordoba';
const DRIVE_WARNING_RATIO = 0.8;

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
  createSupabaseDriveBackup();

  ScriptApp.getProjectTriggers()
    .filter(trigger => trigger.getHandlerFunction() === DAILY_BACKUP_FUNCTION)
    .forEach(trigger => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(DAILY_BACKUP_FUNCTION)
    .timeBased()
    .everyDays(1)
    .atHour(3)
    .inTimezone(BACKUP_TIME_ZONE)
    .create();
}

function createSupabaseDriveBackup() {
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
    const response = UrlFetchApp.fetch(`${baseUrl}/rest/v1/${table}?select=*&order=${orderColumn}.asc`, {
      method: 'get',
      headers: { ...headers, 'Range-Unit': 'items', Range: `${start}-${start + pageSize - 1}` },
      muteHttpExceptions: true
    });
    const status = response.getResponseCode();
    if (status < 200 || status >= 300) {
      throw new Error(`No se pudo respaldar la tabla ${table}. Supabase respondió HTTP ${status}: ${response.getContentText().slice(0, 300)}`);
    }
    const page = JSON.parse(response.getContentText());
    if (!Array.isArray(page)) {
      throw new Error(`La respuesta de ${table} no tiene el formato esperado; no se guardó el backup.`);
    }
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

function getConfig_() {
  const properties = PropertiesService.getScriptProperties();
  const supabaseUrl = properties.getProperty('SUPABASE_URL');
  const serviceRoleKey = properties.getProperty('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Configurá SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en las propiedades del script.');
  }
  return {
    baseUrl: supabaseUrl.replace(/\/+$/, ''),
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Accept: 'application/json'
    }
  };
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
