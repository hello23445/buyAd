/*
 * BuyAd persistent kick service.
 * Deploy as a separate Google Apps Script Web App.
 * Required Script Property: TELEGRAM_BOT_TOKEN.
 * The endpoint verifies Telegram initData and the admin token-to-Telegram-ID
 * binding stored in data/user-statistics.json before writing to Google Sheets.
 */
const BUYAD_KICK_SPREADSHEET_ID = '1pNPa_d4XwUiZzrLVNl4YENBezSAOOUsKQpmpyQIEZIo';
const BUYAD_CONFIG_SPREADSHEET_ID = '1UpHiiY8EiEApSFfxdE0VWlgoGk4M4Vh2-lMBhIiVibI';
const BUYAD_KICK_SHEET_NAME = 'KickedUsers';
const BUYAD_RELOAD_SHEET_NAME = 'ReloadEvents';
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
      result = checkKick_(identity, payload);
    } else if (action === 'kick') {
      result = kickUser_(identity, payload);
    } else if (action === 'kickAll') {
      result = kickAll_(identity, payload);
    } else if (action === 'createReload') {
      result = createReloadEvent_(identity, payload);
    } else if (action === 'getUsers') {
      const admin = requireKickAdmin_(identity, payload);
      result = getUsers_(admin);
    } else if (action === 'getUser') {
      const admin = requireKickAdmin_(identity, payload);
      result = getUser_(admin, payload);
    } else if (action === 'createNotification') {
      const admin = requireKickAdmin_(identity, payload);
      result = createNotification_(admin, payload);
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
  const botToken = telegramBotToken_();
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

function telegramBotToken_() {
  const configBook = SpreadsheetApp.openById(BUYAD_CONFIG_SPREADSHEET_ID);
  const sheets = configBook.getSheets();
  if (!sheets.length) throw new Error('Таблица конфигурации не содержит листов.');
  const token = String(sheets[0].getRange('A2').getDisplayValue() || '').trim();
  if (!token) throw new Error('Токен Telegram-бота не найден в A2 таблицы конфигурации.');
  return token;
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
  const hideName = payload.hideAdminName === true || String(payload.hideAdminName || '').toLowerCase() === 'true';
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


function reloadSheet_() {
  const book = spreadsheet_();
  let sheet = book.getSheetByName(BUYAD_RELOAD_SHEET_NAME);
  if (!sheet) sheet = book.insertSheet(BUYAD_RELOAD_SHEET_NAME);
  const headers = ['event_id','target_type','target_value','target_tokens_json','target_telegram_id','scheduled_at','duration_seconds','admin_name','admin_name_hidden','created_at','active'];
  if (sheet.getLastRow() === 0) sheet.getRange(1,1,1,headers.length).setValues([headers]);
  return sheet;
}
function hashIp_(ip) {
  const props = PropertiesService.getScriptProperties();
  const secret = props.getProperty('IP_HASH_SECRET') || telegramBotToken_();
  if (!secret) throw new Error('IP reload matching requires TELEGRAM_BOT_TOKEN in Script Properties.');
  const value = String(ip || '').trim().toLowerCase();
  if (!value || value.length > 64) throw new Error('Invalid IP address.');
  return bytesToHex_(Utilities.computeHmacSha256Signature(value, secret));
}
function kickAll_(identity, payload) {
  const admin = requireKickAdmin_(identity, payload);
  const hidden = payload.hideAdminName === true || String(payload.hideAdminName || '').toLowerCase() === 'true';
  if (hidden && !admin.canHideName) throw new Error('Only a level 5 administrator with hide-name permission can hide their name.');
  const reason = String(payload.reason || '').trim().slice(0,500) || 'Не указана';
  const users = loadUserArchive_();
  const profilesById = {};
  Object.keys(users).forEach(key => {
    const profile = users[key] || {};
    const id = String(profile.telegramId || '').trim();
    if (!id) return;
    profilesById[id] = { telegramId:id, tokens:Array.from(new Set((Array.isArray(profile.tokens) ? profile.tokens : []).map(String).filter(Boolean))) };
  });
  // Merge the live Users sheet so mass kick covers every registered app account.
  const usersSheet = spreadsheet_().getSheetByName('Users');
  if (usersSheet && usersSheet.getLastRow() > 0) {
    const liveRows = usersSheet.getRange(1, 1, usersSheet.getLastRow(), 2).getDisplayValues();
    liveRows.forEach(row => {
      const id = String(row[0] || '').trim();
      if (!/^\\d+$/.test(id)) return;
      if (!profilesById[id]) profilesById[id] = { telegramId:id, tokens:[] };
      const token = String(row[1] || '').trim();
      if (token && profilesById[id].tokens.indexOf(token) < 0) profilesById[id].tokens.push(token);
    });
  }
  const profiles = Object.keys(profilesById).map(id => profilesById[id]);
  const sheet = kickSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let count = 0;
  try {
    const last = sheet.getLastRow();
    const existing = last >= 2 ? sheet.getRange(2,1,last-1,8).getValues() : [];
    profiles.forEach(profile => {
      const telegramId = String(profile.telegramId || '');
      const tokens = Array.from(new Set((Array.isArray(profile.tokens) ? profile.tokens : []).map(String).filter(Boolean)));
      let row = 0;
      for (let i=0;i<existing.length;i++) {
        let oldTokens=[]; try { oldTokens=JSON.parse(String(existing[i][1] || '[]')); } catch (_) {}
        if ((telegramId && String(existing[i][0] || '') === telegramId) || tokens.some(token => oldTokens.indexOf(token)>=0)) { row=i+2; break; }
      }
      const values=[telegramId,JSON.stringify(tokens),reason,hidden?'':admin.name,hidden,identity.userToken,new Date(),true];
      if(row) sheet.getRange(row,1,1,values.length).setValues([values]); else sheet.appendRow(values);
      count++;
    });
  } finally { lock.releaseLock(); }
  return { kicked:true, kickedCount:count, reason:reason, adminName:hidden?'':admin.name, adminNameHidden:hidden };
}

function usersSheet_() {
  const sheet = spreadsheet_().getSheetByName('Users');
  if (!sheet) throw new Error('Лист Users не найден в указанной Google-таблице.');
  return sheet;
}

function readUsersRows_() {
  const sheet = usersSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];
  const values = sheet.getRange(1, 1, lastRow, 5).getDisplayValues();
  return values.filter(function(row, index) {
    const telegramId = String(row[0] || '').trim();
    const token = String(row[1] || '').trim();
    if (!telegramId && !token) return false;
    if (index === 0 && !/^\\d+$/.test(telegramId) && /telegram|user|token/i.test(row.join(' '))) return false;
    return true;
  });
}

function getUsers_(admin) {
  if (Number(admin.level) < 2) throw new Error('Просмотр пользователей доступен администраторам 2-го уровня и выше.');
  const allRows = readUsersRows_();
  const limit = 1000;
  return { rows: allRows.slice(0, limit), total: allRows.length, truncated: allRows.length > limit };
}

function getUser_(admin, payload) {
  if (Number(admin.level) < 2) throw new Error('Просмотр пользователей доступен администраторам 2-го уровня и выше.');
  const query = String(payload.query || '').trim();
  if (!query) throw new Error('Укажите Telegram ID или токен пользователя.');
  const rows = readUsersRows_().filter(function(row) {
    return String(row[0] || '').trim() === query || String(row[1] || '').trim() === query;
  });
  return { rows: rows.slice(0, 20), total: rows.length, truncated: rows.length > 20 };
}


const BUYAD_NOTIFICATION_SHEET_NAME='UserNotifications';
function notificationSheet_(){
  const book=spreadsheet_();let sheet=book.getSheetByName(BUYAD_NOTIFICATION_SHEET_NAME);
  if(!sheet)sheet=book.insertSheet(BUYAD_NOTIFICATION_SHEET_NAME);
  if(sheet.getLastRow()===0)sheet.getRange(1,1,1,10).setValues([['event_id','target_type','target_telegram_id','target_tokens_json','message','duration_seconds','show_chief','created_at','expires_at','admin_name']]);
  return sheet;
}
function createNotification_(admin,payload){
  if(Number(admin.level)<5)throw new Error('Notifications are available only to the level 5 chief administrator.');
  const type=String(payload.targetType||'all'),target=String(payload.target||'').trim(),message=String(payload.message||'').trim(),duration=Number(payload.durationSeconds);
  if(!message||message.length>1500)throw new Error('Notification text must contain 1 to 1500 characters.');
  if(!Number.isInteger(duration)||duration<1||duration>86400)throw new Error('Notification duration must be 1 to 86400 seconds.');
  let telegramId='',tokens=[];
  if(type==='telegram'||type==='token'){
    if(!target)throw new Error('Specify a Telegram ID or user token.');
    const profile=profileForIdentifier_(target);telegramId=profile.telegramId||(type==='telegram'?target:'');
    tokens=Array.from(new Set((profile.tokens||[]).concat(type==='token'?[target]:[])));
    if(type==='telegram'&&!/^\\d+$/.test(telegramId))throw new Error('Invalid Telegram ID.');
    if(type==='token'&&!tokens.length)throw new Error('User token was not found.');
  }else if(type!=='all')throw new Error('Unknown notification target.');
  const now=Date.now(),eventId=Utilities.getUuid();
  notificationSheet_().appendRow([eventId,type,telegramId,JSON.stringify(tokens),message,duration,payload.showChief===true,new Date(now),new Date(now+duration*1000),admin.name]);
  return {created:true,eventId:eventId};
}
function matchingNotifications_(identity){
  const sheet=notificationSheet_(),last=sheet.getLastRow();if(last<2)return[];
  const now=Date.now(),rows=sheet.getRange(2,1,last-1,10).getValues(),matches=[];
  rows.forEach(row=>{
    const expires=row[8] instanceof Date?row[8].getTime():Number(row[8]);if(!Number.isFinite(expires)||now>expires)return;
    const type=String(row[1]||'');let tokens=[];try{tokens=JSON.parse(String(row[3]||'[]')).map(String);}catch(_){}
    const telegram=String(row[2]||'');
    const matched=type==='all'||(type==='telegram'&&telegram===identity.telegramId)||(type==='token'&&(tokens.includes(identity.userToken)||(telegram&&telegram===identity.telegramId)));
    if(matched)matches.push({eventId:String(row[0]||''),message:String(row[4]||''),durationSeconds:Number(row[5])||5,showChief:row[6]===true||String(row[6]).toLowerCase()==='true'});
  });
  return matches;
}

function createReloadEvent_(identity, payload) {
  const admin=requireKickAdmin_(identity,payload);
  if (Number(admin.level) < 4) throw new Error('Application restart is available only to administrators of level 4 or higher.');
  const type=String(payload.targetType || '');
  const target=String(payload.target || '').trim();
  const scheduledAt=Number(payload.scheduledAt || Date.now());
  const duration=Number(payload.durationSeconds || 5);
  if(!Number.isFinite(scheduledAt)||scheduledAt<Date.now()-30000||scheduledAt>Date.now()+86400000) throw new Error('Reload time must be between now and 24 hours from now.');
  if(!Number.isInteger(duration)||duration<1||duration>300) throw new Error('Restart duration must be between 1 and 300 seconds.');
  let targetValue='',tokens=[],telegramId='';
  if(type==='all') {
    // Every authenticated app session matches.
  } else if(type==='ip') {
    targetValue=hashIp_(target);
  } else if(type==='telegram') {
    if(!/^\\d+$/.test(target)) throw new Error('Telegram ID must contain digits only.');
    const profile=profileForIdentifier_(target); telegramId=profile.telegramId||target; tokens=profile.tokens||[];
  } else if(type==='token') {
    if(!/^[A-Za-z0-9_-]{8,120}$/.test(target)) throw new Error('Invalid user token.');
    const profile=profileForIdentifier_(target); telegramId=profile.telegramId||''; tokens=Array.from(new Set((profile.tokens||[]).concat([target])));
  } else throw new Error('Unknown reload target type.');
  const sheet=reloadSheet_(), eventId=Utilities.getUuid();
  sheet.appendRow([eventId,type,targetValue,JSON.stringify(tokens),telegramId,scheduledAt,duration,admin.name,false,new Date(),true]);
  return {created:true,eventId:eventId,scheduledAt:scheduledAt,durationSeconds:duration};
}
function matchingReloadEvents_(identity,payload) {
  const sheet=reloadSheet_(),last=sheet.getLastRow();
  if(last<2) return [];
  const ip=String(payload.clientIp||'').trim();
  const ipHash=ip?hashIp_(ip):'';
  const now=Date.now(),rows=sheet.getRange(2,1,last-1,11).getValues(),matches=[];
  rows.forEach(row=>{
    const active=row[10]===true||String(row[10]).toLowerCase()==='true';
    if(!active) return;
    const at=Number(row[5] instanceof Date?row[5].getTime():row[5]),duration=Number(row[6])||5;
    if(!Number.isFinite(at)||now>at+Math.max(duration*1000,30000)) return;
    const type=String(row[1]||'');
    let tokens=[];try{tokens=JSON.parse(String(row[3]||'[]')).map(String);}catch(_){}
    const telegram=String(row[4]||'');
    const match=type==='all'||(type==='telegram'&&telegram===identity.telegramId)||
      (type==='token'&&(tokens.indexOf(identity.userToken)>=0||telegram===identity.telegramId))||
      (type==='ip'&&ipHash&&String(row[2]||'')===ipHash);
    if(match) matches.push({eventId:String(row[0]||''),scheduledAt:at,durationSeconds:duration,adminName:String(row[7]||''),adminNameHidden:row[8]===true||String(row[8]).toLowerCase()==='true'});
  });
  return matches.sort((a,b)=>a.scheduledAt-b.scheduledAt);
}

function checkKick_(identity, payload = {}) {
  const sheet = kickSheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const last = sheet.getLastRow();
    const rows = last >= 2 ? sheet.getRange(2, 1, last - 1, 8).getValues() : [];
    for (let i = rows.length - 1; i >= 0; i--) {
      const row = rows[i];
      const active = row[7] === true || String(row[7]).toLowerCase() === 'true';
      if (!active) continue;
      let tokens = [];
      try { tokens = JSON.parse(String(row[1] || '[]')); } catch (_) {}
      if (String(row[0] || '') === identity.telegramId || tokens.map(String).indexOf(identity.userToken) >= 0) {
        const hidden = row[4] === true || String(row[4]).toLowerCase() === 'true';
        // Consume this kick after the first successful delivery so reopening the app
        // does not replay the same kick over and over.
        sheet.getRange(i + 2, 8).setValue(false);
        return {
          kicked: true,
          reason: String(row[2] || 'Не указана'),
          adminName: hidden ? '' : String(row[3] || 'Не указан'),
          adminNameHidden: hidden,
          kickedAt: row[6] instanceof Date ? row[6].toISOString() : String(row[6] || '')
        };
      }
    }
    return { kicked: false, reloadEvents: matchingReloadEvents_(identity, payload), notifications: matchingNotifications_(identity) };
  } finally {
    lock.releaseLock();
  }
}
