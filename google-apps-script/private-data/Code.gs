/**
 * BuyAd private data backend.
 * Spreadsheet row 2: A=bot token, B=BanForever, C=BlockCreateAds,
 * D=BlockedUsersTelegramID, E=BlockedUsersIPadresses, F=UserWarnings.
 * G2 stores the private admin registry JSON.
 */
const SPREADSHEET_ID = '1UpHiiY8EiEApSFfxdE0VWlgoGk4M4Vh2-lMBhIiVibI';
const DATA_ROW = 2;
const COLS = {
  BanForever: 2,
  BlockCreateAds: 3,
  BlockedUsersTelegramID: 4,
  BlockedUsersIPadresses: 5,
  UserWarnings: 6
};
const ADMIN_REGISTRY_COL = 7; // G2; never publish this cell.

function doGet(e) {
  const p = (e && e.parameter) || {};
  const callback = /^[A-Za-z_$][0-9A-Za-z_$\.]{0,80}$/.test(p.callback || '') ? p.callback : '';
  let result;
  try {
    const initData = String(p.initData || '');
    const user = verifyTelegramInitData_(initData);
    const action = String(p.action || '');
    if (action === 'getMyRestrictions') {
      result = { ok: true, data: getMyRestrictions_(user, String(p.userToken || ''), String(p.userIp || '')) };
    } else if (action === 'getAdminData') {
      const admin = requireAdmin_(user);
      result = { ok: true, admin: publicAdmin_(admin), data: readAllData_() };
    } else if (action === 'updatePunishment' || action === 'removePunishment') {
      const admin = requireAdmin_(user);
      const payload = JSON.parse(String(p.payload || '{}'));
      result = { ok: true, result: mutatePunishment_(admin, action, payload) };
    } else if (action === 'sendAdNotification') {
      const payload = JSON.parse(String(p.payload || '{}'));
      result = sendAdNotification_(user, payload);
    } else if (action === 'createInvoiceLink') {
      const payload = JSON.parse(String(p.payload || '{}'));
      result = createInvoiceLink_(user, payload);
    } else {
      throw new Error('Неизвестное действие сервера.');
    }
  } catch (err) {
    result = { ok: false, error: String(err && err.message || err) };
  }
  const json = JSON.stringify(result).replace(/</g, '\\u003c');
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function verifyTelegramInitData_(initData) {
  if (!initData) throw new Error('Отсутствуют данные авторизации Telegram.');
  const params = {};
  initData.split('&').forEach(part => {
    const i = part.indexOf('=');
    if (i < 0) return;
    params[decodeURIComponent(part.slice(0, i).replace(/\+/g, ' '))] =
      decodeURIComponent(part.slice(i + 1).replace(/\+/g, ' '));
  });
  const hash = String(params.hash || '');
  if (!hash) throw new Error('Подпись Telegram отсутствует.');
  delete params.hash;
  const check = Object.keys(params).sort().map(k => k + '=' + params[k]).join('\n');
  const sheet = getSheet_();
  const botToken = String(sheet.getRange(DATA_ROW, 1).getDisplayValue() || '').trim();
  if (!botToken) throw new Error('В ячейке A2 не задан токен бота.');
  const secret = Utilities.computeHmacSha256Signature(botToken, 'WebAppData');
  const checkBytes = Utilities.newBlob(check, 'text/plain').getBytes();
  const calculated = bytesToHex_(Utilities.computeHmacSha256Signature(checkBytes, secret));
  if (!constantTimeEqual_(calculated, hash.toLowerCase())) throw new Error('Неверная подпись Telegram.');
  const authDate = Number(params.auth_date || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > 3600 || authDate - now > 60) throw new Error('Срок авторизации Telegram истёк.');
  let user;
  try { user = JSON.parse(params.user || '{}'); } catch (_) { user = {}; }
  if (!user.id) throw new Error('Telegram не передал ID пользователя.');
  return { id: String(user.id), username: String(user.username || '') };
}

function getMyRestrictions_(user, userToken, userIp) {
  const all = readAllData_();
  const match = (entry, listName) => {
    if (!entry || typeof entry !== 'object') {
      const value = entryValue_(entry);
      return !!value && ((userToken && value === userToken) || value === user.id ||
        (listName === 'BlockedUsersIPadresses' && userIp && value === userIp));
    }
    return !!(
      (userToken && (String(entry.token || '') === userToken || String(entry.value || '') === userToken)) ||
      String(entry.telegramId || '') === user.id ||
      String(entry.value || '') === user.id ||
      (listName === 'BlockedUsersIPadresses' && userIp &&
        (String(entry.ip || '') === userIp || String(entry.value || '') === userIp))
    );
  };
  const result = {};
  Object.keys(COLS).forEach(name => {
    result[name] = (all[name] || []).filter(entry => match(entry, name));
  });
  return result;
}

function readAllData_() {
  const sheet = getSheet_();
  const out = {};
  Object.keys(COLS).forEach(name => {
    const raw = sheet.getRange(DATA_ROW, COLS[name]).getValue();
    out[name] = parseJsonArray_(raw, name);
  });
  return out;
}

function parseJsonArray_(raw, name) {
  if (Array.isArray(raw)) return raw;
  const text = String(raw == null ? '' : raw).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) throw new Error();
    return parsed;
  } catch (_) {
    throw new Error('В ячейке ' + name + ' находится некорректный JSON-массив.');
  }
}

function requireAdmin_(user) {
  const sheet = getSheet_();
  const raw = String(sheet.getRange(DATA_ROW, ADMIN_REGISTRY_COL).getDisplayValue() || '').trim();
  if (!raw) throw new Error('Реестр администраторов не настроен: заполните G2.');
  let registry;
  try { registry = JSON.parse(raw); } catch (_) { throw new Error('Некорректный JSON реестра администраторов в G2.'); }
  const admins = Array.isArray(registry.admins) ? registry.admins : [];
  const admin = admins.find(x => String(x.telegram_id || '') === user.id);
  if (!admin) throw new Error('Доступ запрещён.');
  return admin;
}

function publicAdmin_(admin) {
  return {
    telegram_id: String(admin.telegram_id),
    admin_name: String(admin.admin_name || ''),
    admin_level: Number(admin.admin_level || 0),
    permissions: admin.permissions || {}
  };
}

function mutatePunishment_(admin, action, payload) {
  const name = String(payload.list || '');
  if (!Object.prototype.hasOwnProperty.call(COLS, name)) throw new Error('Недопустимый список наказаний.');
  if (name === 'UserWarnings') {
    requirePermission_(admin, 'manageWarnings', 2);
  } else {
    const required = {
      BanForever: ['banToken', 2],
      BlockCreateAds: ['restrictAds', 2],
      BlockedUsersTelegramID: ['banTelegramId', 3],
      BlockedUsersIPadresses: ['banIp', 4]
    }[name];
    requirePermission_(admin, required[0], required[1]);
  }
  const value = payload.entry && typeof payload.entry === 'object'
    ? payload.entry
    : { value: String(payload.value || '').trim() };
  const key = name === 'UserWarnings' ? String(value.id || value.warningId || '').trim() : entryValue_(value);
  if (!key) throw new Error('Не указана цель наказания.');
  const targetTelegramId = String(payload.targetTelegramId || (name === 'BlockedUsersTelegramID' ? key : (value && value.telegramId || '')));
  if (targetTelegramId && targetTelegramId === String(admin.telegram_id)) throw new Error('Нельзя применить действие к самому себе.');
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sheet = getSheet_();
    const cell = sheet.getRange(DATA_ROW, COLS[name]);
    const rows = parseJsonArray_(cell.getValue(), name);
    const requestedType = String(value && value.type || '');
    const index = rows.findIndex(row => {
      if (name === 'UserWarnings') return String(row && (row.id || row.warningId) || '') === key;
      return entryValue_(row) === key &&
        (name !== 'BlockCreateAds' || !requestedType || String(row && row.type || '') === requestedType);
    });
    if (action === 'updatePunishment') {
      if (index >= 0) rows[index] = value;
      else rows.push(value);
    } else {
      if (index >= 0) rows.splice(index, 1);
    }
    cell.setValue(JSON.stringify(rows));
    return { list: name, count: rows.length };
  } finally {
    lock.releaseLock();
  }
}

function requirePermission_(admin, permission, minimumLevel) {
  const level = Number(admin.admin_level || 0);
  const permissions = admin.permissions || {};
  if (permissions[permission] === false || (!Object.prototype.hasOwnProperty.call(permissions, permission) && level < minimumLevel)) {
    throw new Error('Недостаточно прав для этой операции.');
  }
}

function entryValue_(entry) {
  if (entry && typeof entry === 'object') {
    return String(entry.value || entry.token || entry.ip || entry.telegramId || '').trim();
  }
  return String(entry || '').trim();
}

function getSheet_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheets()[0];
  if (!sheet) throw new Error('В таблице не найден лист.');
  return sheet;
}

function bytesToHex_(bytes) {
  return bytes.map(b => ('0' + ((b + 256) % 256).toString(16)).slice(-2)).join('');
}

function constantTimeEqual_(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}


function getBotToken_() {
  const token = String(getSheet_().getRange(DATA_ROW, 1).getDisplayValue() || '').trim();
  if (!token) throw new Error('В ячейке A2 не задан токен бота.');
  return token;
}

function telegramBotRequest_(method, payload) {
  const response = UrlFetchApp.fetch('https://api.telegram.org/bot' + getBotToken_() + '/' + method, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true
  });
  let data;
  try { data = JSON.parse(response.getContentText()); }
  catch (_) { throw new Error('Telegram вернул некорректный ответ.'); }
  if (!data.ok) throw new Error(String(data.description || 'Ошибка Telegram Bot API.'));
  return data.result;
}

function sendAdNotification_(user, payload) {
  const chatId = String(PropertiesService.getScriptProperties().getProperty('BUYAD_NOTIFICATION_CHAT_ID') || '').trim();
  if (!chatId) throw new Error('Не задано свойство BUYAD_NOTIFICATION_CHAT_ID в настройках GAS.');
  const adName = String(payload.adName || '').slice(0, 120);
  const userIp = String(payload.userIp || 'unknown').slice(0, 80);
  const message = [
    '🆕 Новая реклама!',
    'Название рекламы: ' + adName,
    'Telegram ID создателя: ' + user.id,
    'IP-адрес создателя: ' + userIp
  ].join('\\n');
  telegramBotRequest_('sendMessage', { chat_id: chatId, text: message });
  return { ok: true };
}

function createInvoiceLink_(user, payload) {
  const amount = Number(payload.amount);
  const stars = Number(payload.stars);
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000 ||
      !Number.isSafeInteger(stars) || stars < 1 || stars > 1000000) {
    throw new Error('Некорректная сумма платежа.');
  }
  const result = telegramBotRequest_('createInvoiceLink', {
    title: String(payload.title || (amount + ' Crystals')).slice(0, 32),
    description: String(payload.description || '').slice(0, 255),
    payload: String(payload.payload || (user.id + ':' + amount)).slice(0, 128),
    currency: 'XTR',
    prices: [{ label: 'Crystals', amount: stars }]
  });
  return { ok: true, invoiceLink: String(result || '') };
}
