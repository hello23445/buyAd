/*
 * BuyAd persistent kick service.
 * Deploy as a separate Google Apps Script Web App.
 * Required Script Property: TELEGRAM_BOT_TOKEN.
 * The endpoint verifies Telegram initData and the admin token-to-Telegram-ID
 * binding stored in data/user-statistics.json before writing to Google Sheets.
 */
const BUYAD_KICK_SPREADSHEET_ID = '1pNPa_d4XwUiZzrLVNl4YENBezSAOOUsKQpmpyQIEZIo';
const BUYAD_KICK_SHEET_NAME = 'KickedUsers';
const BUYAD_KICK_ADMIN_URL = 'https://raw.githubusercontent.com/hello23445/buyAd/main/admin.js';
const BUYAD_KICK_ARCHIVE_URL = 'https://raw.githubusercontent.com/hello23445/buyAd/main/data/user-statistics.json';

function doGet(e) {
  const query = (e && e.parameter) || {};
  const callback = String(query.callback || '');
  let result;
  try {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) throw new Error('Invalid callback.');
    const action = String(query.action || '');
    const payload = query.payload ? JSON.parse(query.payload) : {};
    const identity = verifyTelegramInitData_(String(query.initData || ''), String(payload.userToken || ''));
    if (action === 'checkKick') {
      result = checkKick_(identity);
    } else if (action === 'kick') {
      result = kickUser_(identity, payload);
    } else {
      throw new Error('Unknown kick action.');
    }
    result = Object.assign({ success: true }, result || {});
  } catch (error) {
    result = { success: false, error: String(error && error.message || error || 'Kick request failed.').slice(0, 300) };
  }
  const safeCallback = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback) ? callback : 'invalidCallback';
  return ContentService
    .createTextOutput(safeCallback + '(' + JSON.stringify(result) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function verifyTelegramInitData_(initData, userToken) {
  const botToken = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!botToken) throw new Error('Kick service is not configured: add TELEGRAM_BOT_TOKEN in Script Properties.');
  if (!initData) throw new Error('Telegram authorization is missing or invalid.');
  const values = {};
  initData.split('&').forEach(function(part) {
    if (!part) return;
    const index = part.indexOf('=');
    const key = index >= 0 ? part.slice(0, index) : part;
    const value = index >= 0 ? part.slice(index + 1) : '';
    values[decodeURIComponent(key.replace(/\+/g, ' '))] = decodeURIComponent(value.replace(/\+/g, ' '));
  });
  const receivedHash = String(values.hash || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(receivedHash)) throw new Error('Telegram authorization is missing or invalid.');
  const checkString = Object.keys(values).filter(key => key !== 'hash').sort()
    .map(key => key + '=' + values[key]).join('\n');
  const secretKey = Utilities.computeHmacSha256Signature(botToken, 'WebAppData');
  const calculatedHash = bytesToHex_(Utilities.computeHmacSha256Signature(Utilities.newBlob(checkString).getBytes(), secretKey));
  if (!constantTimeEquals_(receivedHash, calculatedHash)) throw new Error('Telegram authorization is missing or invalid.');
  const authDate = Number(values.auth_date || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > 86400 || authDate > now + 300) throw new Error('Telegram authorization has expired. Reopen the app.');
  let user;
  try { user = JSON.parse(values.user || '{}'); } catch (_) { user = null; }
  const telegramId = String(user && user.id || '');
  if (!/^\d+$/.test(telegramId)) throw new Error('Telegram authorization is missing or invalid.');
  return { telegramId: telegramId, userToken: String(userToken || '').slice(0, 120) };
}

function bytesToHex_(bytes) {
  return bytes.map(byte => ('0' + ((byte + 256) % 256).toString(16)).slice(-2)).join('');
}

function constantTimeEquals_(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function spreadsheet_() {
  return SpreadsheetApp.openById(BUYAD_KICK_SPREADSHEET_ID);
}

function kickSheet_() {
  const book = spreadsheet_();
  let sheet = book.getSheetByName(BUYAD_KICK_SHEET_NAME);
  if (!sheet) sheet = book.insertSheet(BUYAD_KICK_SHEET_NAME);
  const headers = ['telegram_id', 'user_tokens_json', 'reason', 'admin_name', 'admin_name_hidden', 'admin_token', 'kicked_at', 'active'];
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function loadUserArchive_() {
  const response = UrlFetchApp.fetch(BUYAD_KICK_ARCHIVE_URL + '?v=' + Date.now(), {
    muteHttpExceptions: true,
    followRedirects: true
  });
  if (response.getResponseCode() !== 200) throw new Error('Could not read the user identity archive.');
  const archive = JSON.parse(response.getContentText() || '{}');
  return archive && archive.users && typeof archive.users === 'object' ? archive.users : {};
}

function profileForIdentifier_(identifier) {
  const users = loadUserArchive_();
  const token = String(identifier || '');
  for (const key in users) {
    const profile = users[key] || {};
    const tokens = Array.isArray(profile.tokens) ? profile.tokens.map(String) : [];
    if (String(profile.telegramId || '') === token || tokens.indexOf(token) >= 0) {
      return { telegramId: String(profile.telegramId || ''), tokens: tokens };
    }
  }
  return { telegramId: /^\d+$/.test(token) ? token : '', tokens: /^\d+$/.test(token) ? [] : [token] };
}

function requireKickAdmin_(identity, payload) {
  const adminToken = String(payload.adminToken || '');
  if (!adminToken || adminToken !== identity.userToken) throw new Error('Administrator identity does not match this Telegram session.');
  const registryResponse = UrlFetchApp.fetch(BUYAD_KICK_ADMIN_URL + '?v=' + Date.now(), {
    muteHttpExceptions: true,
    followRedirects: true
  });
  if (registryResponse.getResponseCode() !== 200) throw new Error('Could not verify the administrator registry.');
  const source = registryResponse.getContentText();
  const escaped = adminToken.replace(/[.*+?^\x24{}()|[\]\\]/g, '\\$&');
  const tokenPattern = new RegExp('"admin_token"\\s*:\\s*"' + escaped + '"');
  const tokenMatch = tokenPattern.exec(source);
  if (!tokenMatch) throw new Error('Kicking users is available only to registered administrators.');
  const objectStart = source.lastIndexOf('{', tokenMatch.index);
  const objectEnd = source.indexOf('\n  }', tokenMatch.index);
  const block = source.slice(objectStart, objectEnd >= 0 ? objectEnd + 4 : tokenMatch.index + 500);
  const levelMatch = block.match(/"admin_level"\s*:\s*(\d+)/);
  const nameMatch = block.match(/"admin_name"\s*:\s*"([^"]*)"/);
  const level = Number(levelMatch && levelMatch[1] || 0);
  if (level < 2) throw new Error('Kicking users is available only to administrators of level 2 or higher.');
  const kickPermission = block.match(/"kickUser"\s*:\s*(true|false)/);
  if (kickPermission && kickPermission[1] !== 'true') throw new Error('Your administrator registry does not grant the kickUser permission.');
  const users = loadUserArchive_();
  let boundTelegramId = '';
  for (const key in users) {
    const profile = users[key] || {};
    if (Array.isArray(profile.tokens) && profile.tokens.map(String).indexOf(adminToken) >= 0) {
      boundTelegramId = String(profile.telegramId || '');
      break;
    }
  }
  if (!boundTelegramId || boundTelegramId !== identity.telegramId) {
    throw new Error('Could not confirm this admin token belongs to the current Telegram account. Open the app once with this admin account and try again.');
  }
  return {
    level: level,
    name: String(nameMatch && nameMatch[1] || 'Администратор'),
    canHideName: level === 5 && /"hideNameOnBan"\s*:\s*true/.test(block)
  };
}

function kickUser_(identity, payload) {
  const admin = requireKickAdmin_(identity, payload);
  const target = String(payload.target || '').trim();
  if (!target) throw new Error('Specify a Telegram ID or user token.');
  const profile = profileForIdentifier_(target);
  const telegramId = String(profile.telegramId || '');
  const tokens = Array.from(new Set((profile.tokens || []).concat(/^\d+$/.test(target) ? [] : [target]).filter(Boolean)));
  if (!telegramId && !tokens.length) throw new Error('Could not resolve this user identifier.');
  if (telegramId && telegramId === identity.telegramId) throw new Error('You cannot kick your own account.');
  if (tokens.indexOf(identity.userToken) >= 0) throw new Error('You cannot kick your own account.');
  const hideName = payload.hideAdminName === true;
  if (hideName && !admin.canHideName) throw new Error('Only a level 5 administrator with hide-name permission can hide their name.');
  const reason = String(payload.reason || '').trim().slice(0, 500) || 'Не указана';
  const sheet = kickSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const last = sheet.getLastRow();
    let row = 0;
    if (last >= 2) {
      const rows = sheet.getRange(2, 1, last - 1, 8).getValues();
      for (let i = 0; i < rows.length; i++) {
        let storedTokens = [];
        try { storedTokens = JSON.parse(String(rows[i][1] || '[]')); } catch (_) {}
        if ((telegramId && String(rows[i][0] || '') === telegramId) || tokens.some(token => storedTokens.indexOf(token) >= 0)) {
          row = i + 2;
          break;
        }
      }
    }
    const values = [telegramId, JSON.stringify(tokens), reason, hideName ? '' : admin.name, hideName, identity.userToken, new Date(), true];
    if (row) sheet.getRange(row, 1, 1, values.length).setValues([values]);
    else sheet.appendRow(values);
  } finally {
    lock.releaseLock();
  }
  return { kicked: true, telegramId: telegramId, reason: reason, adminName: hideName ? '' : admin.name, adminNameHidden: hideName };
}

function checkKick_(identity) {
  const sheet = kickSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return { kicked: false };
  const rows = sheet.getRange(2, 1, last - 1, 8).getValues();
  for (let i = rows.length - 1; i >= 0; i--) {
    const row = rows[i];
    const active = row[7] === true || String(row[7]).toLowerCase() === 'true';
    if (!active) continue;
    let tokens = [];
    try { tokens = JSON.parse(String(row[1] || '[]')); } catch (_) {}
    if (String(row[0] || '') === identity.telegramId || tokens.map(String).indexOf(identity.userToken) >= 0) {
      const hidden = row[4] === true || String(row[4]).toLowerCase() === 'true';
      return {
        kicked: true,
        reason: String(row[2] || 'Не указана'),
        adminName: hidden ? '' : String(row[3] || 'Не указан'),
        adminNameHidden: hidden,
        kickedAt: row[6] instanceof Date ? row[6].toISOString() : String(row[6] || '')
      };
    }
  }
  return { kicked: false };
}
