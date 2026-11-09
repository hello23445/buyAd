/*
 * BuyAd referral backend.
 *
 * Deploy this file as a Google Apps Script Web App. Set Script Property
 * TELEGRAM_BOT_TOKEN to the bot token (never put it in the website source).
 * The spreadsheet ID is the one supplied for BuyAd.
 *
 * Browser calls use JSONP through doGet, so the website never needs a
 * cross-origin fetch to script.google.com.
 */
const BUYAD_SPREADSHEET_ID = '1pNPa_d4XwUiZzrLVNl4YENBezSAOOUsKQpmpyQIEZIo';
const BUYAD_USERS_SHEET = 'Users';
const BUYAD_ADMIN_CONFIG_URL = 'https://raw.githubusercontent.com/hello23445/buyAd/main/admin2.js';
const BUYAD_DEFAULT_SHARE_TEXT = 'В этом боте можно быстро и эффективно продвигать свои ресурсы абсолютно бесплатно!';
const BUYAD_REFERRAL_BONUS = 60;
const BUYAD_CREATE_COST = 25;
const BUYAD_MAX_GIFT = 50;
const BUYAD_ADMIN_ROLE_URL = 'https://raw.githubusercontent.com/hello23445/buyAd/main/admin.js';

function isReferralSystemEnabled_() {
  return PropertiesService.getScriptProperties().getProperty('BUYAD_REFERRAL_SYSTEM_ENABLED') !== 'false';
}

function requireReferralSystemEnabled_() {
  if (!isReferralSystemEnabled_()) throw new Error('Referral system is globally disabled.');
}

function setReferralSystemEnabled_(enabled) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // The global flag blocks every referral action and link while preserving
    // each owner's individual enabled/disabled preference for later restoration.
    PropertiesService.getScriptProperties().setProperty(
      'BUYAD_REFERRAL_SYSTEM_ENABLED',
      enabled === true ? 'true' : 'false'
    );
  } finally {
    lock.releaseLock();
  }
}

function requireReferralAdmin_(identity) {
  const token = String(identity && identity.userToken || '');
  if (!token) throw new Error('Administrator access required.');
  try {
    const response = UrlFetchApp.fetch(BUYAD_ADMIN_ROLE_URL + '?v=' + Date.now(), { muteHttpExceptions: true, followRedirects: true });
    if (response.getResponseCode() !== 200) throw new Error('Admin registry unavailable');
    const source = response.getContentText();
    const pattern = /"admin_level"\s*:\s*(\d+)[\s\S]{0,300}?"admin_token"\s*:\s*"([^"]+)"/g;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      if (match[2] === token && Number(match[1]) >= 4) return Number(match[1]);
    }
  } catch (_) {}
  throw new Error('Administrator level 4 or higher is required.');
}

function doGet(e) {
  const query = (e && e.parameter) || {};
  const callback = String(query.callback || '');
  let result;
  let diagnosticStage = 'validate_request';
  let diagnosticAction = String(query.action || 'unknown');
  try {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
      throw new Error('Invalid JSONP callback.');
    }
    diagnosticStage = 'parse_payload';
    const payload = query.payload ? JSON.parse(query.payload) : {};
    diagnosticStage = 'verify_telegram';
    const identity = verifyTelegramInitData_(String(query.initData || ''), payload.userToken || '');
    diagnosticStage = 'action:' + diagnosticAction;
    result = dispatchReferralAction_(diagnosticAction, identity, payload);
    result = Object.assign({ success: true }, result || {});
  } catch (error) {
    const diagnostic = {
      action: diagnosticAction,
      stage: diagnosticStage,
      type: String(error && error.name || 'Error'),
      message: String(error && error.message || error || 'Unknown error').slice(0, 500)
    };
    try { Logger.log('BuyAd referral diagnostic: ' + JSON.stringify(diagnostic) + '\\n' + String(error && error.stack || '')); } catch (_) {}
    result = { success: false, error: publicError_(error), diagnostic: diagnostic };
  }
  return jsonpOutput_(callback, result);
}

function jsonpOutput_(callback, value) {
  const safeCallback = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback) ? callback : 'invalidCallback';
  return ContentService
    .createTextOutput(safeCallback + '(' + JSON.stringify(value) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function publicError_(error) {
  try { Logger.log('BuyAd referral backend error: ' + String(error && error.stack || error)); } catch (_) {}
  const message = String(error && error.message || error || 'Unknown error');
  const allowed = [
    'Telegram authorization is missing or invalid.',
    'Telegram authorization has expired. Reopen the app.',
    'This Telegram account has no registered user row in Users.',
    'Not enough crystals. 25 crystals are required.',
    'A referral link already exists.',
    'A referral link does not exist.',
    'Referral access is disabled while your account has an active warning or ban.',
    'This referral link is disabled or unavailable.',
    'Referral self-registration is not allowed.',
    'The referral visit was already processed.',
    'No first-visit record was found.',
    'Referral settings are invalid.',
    'Referral system is globally disabled.',
    'Administrator access required.',
    'Administrator level 4 or higher is required.',
    'Could not verify the account restriction status. Try again later.',
    'The referral service is not configured. Add TELEGRAM_BOT_TOKEN in Apps Script project properties.',
    'Could not update the Google Sheets balance. Please try again.'
  ];
  if (allowed.indexOf(message) >= 0) return message;
  return 'Referral request failed. Please try again later.';
}

function dispatchReferralAction_(action, identity, payload) {
  switch (action) {
    case 'registerVisit':
      return registerReferralVisit_(identity);
    case 'setGlobalEnabled':
      requireReferralAdmin_(identity);
      setReferralSystemEnabled_(payload.enabled === true);
      return { systemEnabled: isReferralSystemEnabled_() };
    case 'getGlobalStatus':
      requireReferralAdmin_(identity);
      return { systemEnabled: isReferralSystemEnabled_() };
    case 'getState':
      return getReferralState_(identity);
    case 'getStats':
      return getReferralStats_(identity, String(payload.period || 'day'), payload.manualRefresh === true);
    case 'createReferral':
      return createReferral_(identity);
    case 'saveSettings':
      return saveReferralSettings_(identity, payload);
    case 'setEnabled':
      return setReferralEnabled_(identity, payload.enabled === true);
    case 'claimReferral':
      return claimReferral_(identity);
    case 'markGiftSeen':
      return markReferralGiftSeen_(identity);
    default:
      throw new Error('Unknown referral action.');
  }
}

/* Verify the raw, signed Telegram.WebApp.initData on the server. */
function verifyTelegramInitData_(initData, userToken) {
  const botToken = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
  if (!botToken) throw new Error('The referral service is not configured. Add TELEGRAM_BOT_TOKEN in Apps Script project properties.');
  if (!initData) throw new Error('Telegram authorization is missing or invalid.');

  const values = {};
  initData.split('&').forEach(function (part) {
    if (!part) return;
    const index = part.indexOf('=');
    const key = index >= 0 ? part.slice(0, index) : part;
    const value = index >= 0 ? part.slice(index + 1) : '';
    values[decodeURIComponent(key.replace(/\+/g, ' '))] = decodeURIComponent(value.replace(/\+/g, ' '));
  });

  const receivedHash = String(values.hash || '').toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(receivedHash)) throw new Error('Telegram authorization is missing or invalid.');
  const checkString = Object.keys(values)
    .filter(function (key) { return key !== 'hash'; })
    .sort()
    .map(function (key) { return key + '=' + values[key]; })
    .join('\n');

  const secretKey = Utilities.computeHmacSha256Signature(botToken, 'WebAppData');
  const calculatedHash = bytesToHex_(Utilities.computeHmacSha256Signature(Utilities.newBlob(checkString).getBytes(), secretKey));
  if (!constantTimeEquals_(receivedHash, calculatedHash)) throw new Error('Telegram authorization is missing or invalid.');

  const authDate = Number(values.auth_date || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || now - authDate > 86400 || authDate > now + 300) {
    throw new Error('Telegram authorization has expired. Reopen the app.');
  }

  let user;
  try { user = JSON.parse(values.user || '{}'); } catch (_) { user = null; }
  const telegramId = String(user && user.id || '');
  if (!/^\d+$/.test(telegramId)) throw new Error('Telegram authorization is missing or invalid.');

  return {
    telegramId: telegramId,
    startParam: String(values.start_param || values.startapp || ''),
    userToken: String(userToken || '').slice(0, 120)
  };
}

function bytesToHex_(bytes) {
  return bytes.map(function (byte) {
    return ('0' + ((byte + 256) % 256).toString(16)).slice(-2);
  }).join('');
}

function constantTimeEquals_(left, right) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i++) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function spreadsheet_() {
  return SpreadsheetApp.openById(BUYAD_SPREADSHEET_ID);
}

function usersSheet_() {
  const sheet = spreadsheet_().getSheetByName(BUYAD_USERS_SHEET);
  if (!sheet) throw new Error('This Telegram account has no registered user row in Users.');
  return sheet;
}

function findUserRow_(telegramId) {
  const sheet = usersSheet_();
  const lastRow = sheet.getLastRow();
  if (!lastRow) return 0;
  const values = sheet.getRange(1, 1, lastRow, 1).getValues();
  for (let i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === String(telegramId)) return i + 1;
  }
  return 0;
}

function ensureUserRow_(telegramId, initialBalance) {
  const sheet = usersSheet_();
  let row = findUserRow_(telegramId);
  if (!row) {
    row = Math.max(1, sheet.getLastRow() + 1);
    sheet.getRange(row, 1).setValue(String(telegramId));
    sheet.getRange(row, 3).setValue(Number(initialBalance || 0));
  } else if (sheet.getRange(row, 3).getValue() === '') {
    sheet.getRange(row, 3).setValue(0);
  }
  return row;
}

function userBalance_(row) {
  const value = Number(usersSheet_().getRange(row, 3).getValue());
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

function setUserBalance_(row, amount) {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Could not update the Google Sheets balance. Please try again.');
  usersSheet_().getRange(row, 3).setValue(amount);
}

function getOrCreateSheet_(name, headers) {
  const book = spreadsheet_();
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sheet;
}

function referralSheet_() {
  return getOrCreateSheet_('Referrals', [
    'telegram_id', 'referral_code', 'referral_url', 'enabled',
    'share_text', 'gift_amount', 'created_at', 'updated_at'
  ]);
}

function eventsSheet_() {
  return getOrCreateSheet_('ReferralEvents', [
    'referred_telegram_id', 'owner_telegram_id', 'referral_code',
    'recipient_gift', 'owner_reward', 'created_at'
  ]);
}

function visitsSheet_() {
  return getOrCreateSheet_('ReferralVisits', [
    'telegram_id', 'first_seen_at', 'referral_code', 'is_new',
    'claim_status', 'gift_received', 'owner_earned', 'gift_seen_at'
  ]);
}

function findVisitRow_(telegramId) {
  const sheet = visitsSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const rows = sheet.getRange(2, 1, last - 1, 1).getDisplayValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '') === String(telegramId)) return i + 2;
  }
  return 0;
}

function findReferralByOwner_(telegramId) {
  const sheet = referralSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const rows = sheet.getRange(2, 1, last - 1, 8).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '') === String(telegramId)) {
      return { row: i + 2, ownerId: String(rows[i][0]), code: String(rows[i][1]), url: String(rows[i][2]), enabled: rows[i][3] === true || String(rows[i][3]).toLowerCase() === 'true', shareText: rows[i][4] == null ? BUYAD_DEFAULT_SHARE_TEXT : String(rows[i][4]), giftAmount: normalizeGift_(rows[i][5]), createdAt: rows[i][6] || '' };
    }
  }
  return null;
}

function findReferralByCode_(code) {
  const sheet = referralSheet_();
  const last = sheet.getLastRow();
  if (last < 2) return null;
  const rows = sheet.getRange(2, 1, last - 1, 8).getValues();
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][1] || '') === String(code)) {
      return { row: i + 2, ownerId: String(rows[i][0]), code: String(rows[i][1]), url: String(rows[i][2]), enabled: rows[i][3] === true || String(rows[i][3]).toLowerCase() === 'true', shareText: rows[i][4] == null ? BUYAD_DEFAULT_SHARE_TEXT : String(rows[i][4]), giftAmount: normalizeGift_(rows[i][5]), createdAt: rows[i][6] || '' };
    }
  }
  return null;
}

function normalizeGift_(value) {
  const amount = Math.round(Number(value) || 0);
  return Math.max(0, Math.min(BUYAD_MAX_GIFT, amount));
}

function registerReferralVisit_(identity) {
  if (!isReferralSystemEnabled_()) return { firstVisit: false, isNew: false, referralCode: '', systemEnabled: false };
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!isReferralSystemEnabled_()) return { firstVisit: false, isNew: false, referralCodePresent: false, systemEnabled: false };
    const existingRow = findVisitRow_(identity.telegramId);
    const rawCode = identity.startParam;
    let referralCode = /^ref_[a-f0-9]{64}$/.test(rawCode) ? rawCode : '';
    let selfReferral = false;
    if (referralCode) {
      const linkedReferral = findReferralByCode_(referralCode);
      if (linkedReferral && linkedReferral.ownerId === identity.telegramId) {
        selfReferral = true;
        referralCode = '';
      } else if (!linkedReferral || !linkedReferral.enabled) {
        referralCode = '';
      }
    }

    if (existingRow) {
      const existing = visitsSheet_().getRange(existingRow, 1, 1, 8).getValues()[0];
      // Telegram may deliver start_param only on a subsequent launch. The
      // first-visit row already records whether the account was new at the
      // original visit, so a Users row created by initUser afterwards must not
      // prevent attaching the referral code. Never overwrite an existing claim.
      if (
        referralCode &&
        existing[3] === true &&
        !existing[2] &&
        String(existing[4] || '') !== 'claimed'
      ) {
        visitsSheet_().getRange(existingRow, 3, 1, 3).setValues([[referralCode, true, 'pending']]);
        SpreadsheetApp.flush();
        return { firstVisit: false, isNew: true, referralCodePresent: true, referralAccepted: true };
      }
      if (selfReferral && existing[3] === true && !existing[2] && String(existing[4] || '') !== 'claimed') {
        visitsSheet_().getRange(existingRow, 5).setValue('ignored');
      }
      return {
        firstVisit: false,
        isNew: existing[3] === true,
        referralCodePresent: !!existing[2],
        referralAccepted: false,
        selfReferral: selfReferral
      };
    }

    // The user must not already exist in Users before this first-visit stamp.
    const isNew = findUserRow_(identity.telegramId) === 0;
    const sheet = visitsSheet_();
    sheet.appendRow([
      identity.telegramId, new Date(), referralCode, isNew,
      referralCode && isNew ? 'pending' : 'ignored', 0, 0, ''
    ]);
    return { firstVisit: true, isNew: isNew, referralCodePresent: !!referralCode, referralAccepted: !!(referralCode && isNew), selfReferral: selfReferral };
  } finally {
    lock.releaseLock();
  }
}

function userTokenForId_(telegramId) {
  const row = findUserRow_(telegramId);
  if (!row) return '';
  // Column B is reserved for the existing user's token in the legacy Users table.
  // If a deployment uses another value there, it will simply not match a ban token.
  return String(usersSheet_().getRange(row, 2).getDisplayValue() || '').trim();
}

function isUserEligible_(telegramId, userToken) {
  const config = loadAdminRestrictionConfig_();
  const id = String(telegramId);
  const tokens = [String(userToken || ''), userTokenForId_(id)].filter(Boolean);

  const banned = [].concat(config.BlockedUsersTelegramID || [], config.BanForever || []);
  const now = Date.now();
  const isBanned = banned.some(function (entry) {
    if (!restrictionIsActive_(entry, now)) return false;
    const value = restrictionValue_(entry);
    return value === id || tokens.indexOf(value) >= 0;
  });
  if (isBanned) return { eligible: false, reason: 'Аккаунт заблокирован' };

  const hasWarning = (config.UserWarnings || []).some(function (warning) {
    if (!warning || typeof warning !== 'object') return false;
    const warningTelegramId = String(warning.telegramId || warning.telegram_id || '');
    const warningToken = String(warning.token || warning.userToken || '');
    if (warningTelegramId !== id && (!warningToken || tokens.indexOf(warningToken) < 0)) return false;
    const removeAt = warning.removeAt ? Date.parse(warning.removeAt) : NaN;
    return !Number.isFinite(removeAt) || removeAt > now;
  });
  if (hasWarning) return { eligible: false, reason: 'Есть активное предупреждение' };
  return { eligible: true, reason: '' };
}

function restrictionIsActive_(entry, now) {
  if (!entry || typeof entry !== 'object' || !entry.expiresAt) return true;
  const expiresAt = Date.parse(entry.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt > now;
}

function restrictionValue_(entry) {
  if (entry && typeof entry === 'object') {
    return String(entry.value || entry.telegramId || entry.telegram_id || entry.token || entry.id || '');
  }
  return String(entry || '');
}

function loadAdminRestrictionConfig_() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get('buyad_referral_admin_restrictions_v1');
  if (cached) return JSON.parse(cached);

  try {
    const response = UrlFetchApp.fetch(BUYAD_ADMIN_CONFIG_URL + '?v=' + Date.now(), {
      muteHttpExceptions: true,
      followRedirects: true
    });
    if (response.getResponseCode() !== 200) throw new Error('HTTP ' + response.getResponseCode());
    const source = response.getContentText();
    const result = {};
    ['BanForever', 'BlockedUsersTelegramID', 'UserWarnings'].forEach(function (name) {
      const pattern = new RegExp('(?:export\\s+)?(?:const|let|var)\\s+' + name + '\\s*=\\s*(\\[[\\s\\S]*?\\])\\s*;');
      const match = source.match(pattern);
      if (!match) throw new Error('Missing ' + name);
      result[name] = JSON.parse(match[1]);
    });
    // Keep the cache short so newly issued warnings/bans disable links promptly.
    cache.put('buyad_referral_admin_restrictions_v1', JSON.stringify(result), 5);
    return result;
  } catch (error) {
    throw new Error('Could not verify the account restriction status. Try again later.');
  }
}

function getReferralState_(identity) {
  if (!isReferralSystemEnabled_()) {
    return { systemEnabled: false, telegramIdFound: !!findUserRow_(identity.telegramId), balance: null, eligible: false, eligibilityReason: 'Реферальная система отключена администратором.', stats: null, referral: null };
  }
  const eligibility = isUserEligible_(identity.telegramId, identity.userToken);
  const row = findUserRow_(identity.telegramId);
  const balance = row ? userBalance_(row) : null;
  const referral = findReferralByOwner_(identity.telegramId);
  let referralCount = 0;
  if (referral) {
    const events = eventsSheet_();
    const last = events.getLastRow();
    if (last >= 2) {
      const ids = events.getRange(2, 2, last - 1, 1).getDisplayValues();
      referralCount = ids.filter(function (r) { return String(r[0] || '') === identity.telegramId; }).length;
    }
  }
  return {
    systemEnabled: true,
    telegramIdFound: !!row,
    balance: balance,
    eligible: eligibility.eligible,
    eligibilityReason: eligibility.reason,
    stats: referral ? getReferralStats_(identity, 'day', false) : null,
    referral: referral ? {
      url: referral.url,
      enabled: referral.enabled && eligibility.eligible,
      manuallyEnabled: referral.enabled,
      shareText: referral.shareText,
      giftAmount: referral.giftAmount,
      referralsCount: referralCount
    } : null
  };
}


function getReferralStats_(identity, period, manualRefresh) {
  requireReferralSystemEnabled_();
  const eligibility = isUserEligible_(identity.telegramId, identity.userToken);
  if (!eligibility.eligible) throw new Error('Referral access is disabled while your account has an active warning or ban.');
  const referral = findReferralByOwner_(identity.telegramId);
  if (!referral) throw new Error('A referral link does not exist.');

  const cache = CacheService.getScriptCache();
  const key = 'buyad_ref_stats_refresh_' + identity.telegramId;
  const now = Date.now();
  const previous = Number(cache.get(key) || 0);
  if (manualRefresh && previous && now - previous < 120000) {
    const remaining = Math.ceil((120000 - (now - previous)) / 1000);
    return { limited: true, retryAfter: remaining, totalInvited: 0, totalOwnerEarned: 0, totalGifted: 0, groups: [] };
  }
  if (manualRefresh) cache.put(key, String(now), 300);
  else if (!previous) cache.put(key, String(now), 300);

  const validPeriods = ['day', 'week', 'month', 'year'];
  if (validPeriods.indexOf(period) < 0) period = 'day';
  const sheet = eventsSheet_();
  const last = sheet.getLastRow();
  const rows = last >= 2 ? sheet.getRange(2, 1, last - 1, 6).getValues() : [];
  const mine = rows.filter(function (row) { return String(row[1] || '') === identity.telegramId; });
  let totalOwnerEarned = 0, totalGifted = 0;
  const buckets = {};
  const tz = Session.getScriptTimeZone() || 'Etc/UTC';
  mine.forEach(function (row) {
    const gift = Number(row[3]) || 0;
    const earned = Number(row[4]) || 0;
    const date = row[5] instanceof Date ? row[5] : new Date(row[5]);
    totalGifted += gift;
    totalOwnerEarned += earned;
    if (isNaN(date.getTime())) return;
    let keyDate;
    if (period === 'year') keyDate = Utilities.formatDate(date, tz, 'yyyy');
    else if (period === 'month') keyDate = Utilities.formatDate(date, tz, 'yyyy-MM');
    else if (period === 'week') {
      const monday = new Date(date);
      monday.setHours(0, 0, 0, 0);
      monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
      keyDate = Utilities.formatDate(monday, tz, 'yyyy-MM-dd');
    } else keyDate = Utilities.formatDate(date, tz, 'yyyy-MM-dd');
    if (!buckets[keyDate]) buckets[keyDate] = { period: keyDate, invited: 0, gifted: 0, earned: 0 };
    buckets[keyDate].invited++;
    buckets[keyDate].gifted += gift;
    buckets[keyDate].earned += earned;
  });
  const groups = Object.keys(buckets).sort().reverse().map(function (key) { return buckets[key]; });
  return {
    limited: false,
    totalInvited: mine.length,
    totalOwnerEarned: totalOwnerEarned,
    totalGifted: totalGifted,
    groups: groups.slice(0, 100)
  };
}

function createReferral_(identity) {
  requireReferralSystemEnabled_();
  const eligibility = isUserEligible_(identity.telegramId, identity.userToken);
  if (!eligibility.eligible) throw new Error('Referral access is disabled while your account has an active warning or ban.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    requireReferralSystemEnabled_();
    const existing = findReferralByOwner_(identity.telegramId);
    if (existing) return { referral: { url: existing.url, enabled: existing.enabled, manuallyEnabled: existing.enabled, shareText: existing.shareText, giftAmount: existing.giftAmount } };

    const userRow = findUserRow_(identity.telegramId);
    if (!userRow) throw new Error('This Telegram account has no registered user row in Users.');
    const balance = userBalance_(userRow);
    if (balance < BUYAD_CREATE_COST) throw new Error('Not enough crystals. 25 crystals are required.');

    // HMAC-SHA-256 prevents outsiders from cheaply enumerating numeric Telegram IDs.
    // The bot token remains server-side in Script Properties and is never returned.
    const hashSecret = PropertiesService.getScriptProperties().getProperty('TELEGRAM_BOT_TOKEN');
    const digest = bytesToHex_(Utilities.computeHmacSha256Signature(identity.telegramId, hashSecret));
    const code = 'ref_' + digest;
    const url = 'https://t.me/buyAdss_bot/buy?startapp=' + code;
    const sheet = referralSheet_();

    setUserBalance_(userRow, balance - BUYAD_CREATE_COST);
    let createdRow = 0;
    try {
      sheet.appendRow([
        identity.telegramId, code, url, true, BUYAD_DEFAULT_SHARE_TEXT,
        0, new Date(), new Date()
      ]);
      createdRow = sheet.getLastRow();
      SpreadsheetApp.flush();
    } catch (error) {
      try { if (createdRow > 0 && createdRow === sheet.getLastRow()) sheet.deleteRow(createdRow); } catch (_) {}
      setUserBalance_(userRow, balance);
      throw new Error('Could not update the Google Sheets balance. Please try again.');
    }
    return {
      balance: balance - BUYAD_CREATE_COST,
      referral: { url: url, enabled: true, manuallyEnabled: true, shareText: BUYAD_DEFAULT_SHARE_TEXT, giftAmount: 0, referralsCount: 0 }
    };
  } finally {
    lock.releaseLock();
  }
}

function saveReferralSettings_(identity, payload) {
  requireReferralSystemEnabled_();
  const eligibility = isUserEligible_(identity.telegramId, identity.userToken);
  if (!eligibility.eligible) throw new Error('Referral access is disabled while your account has an active warning or ban.');
  const referral = findReferralByOwner_(identity.telegramId);
  if (!referral) throw new Error('A referral link does not exist.');

  const shareText = String(payload.shareText == null ? BUYAD_DEFAULT_SHARE_TEXT : payload.shareText).slice(0, 500);
  const gift = Number(payload.giftAmount);
  if (!Number.isInteger(gift) || gift < 0 || gift > BUYAD_MAX_GIFT) throw new Error('Referral settings are invalid.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    requireReferralSystemEnabled_();
    const current = findReferralByOwner_(identity.telegramId);
    if (!current) throw new Error('A referral link does not exist.');
    const sheet = referralSheet_();
    sheet.getRange(current.row, 5).setValue(shareText);
    sheet.getRange(current.row, 6).setValue(gift);
    sheet.getRange(current.row, 8).setValue(new Date());
    SpreadsheetApp.flush();
    return { saved: true, shareText: shareText, giftAmount: gift };
  } finally {
    lock.releaseLock();
  }
}

function setReferralEnabled_(identity, enabled) {
  requireReferralSystemEnabled_();
  if (enabled) {
    const eligibility = isUserEligible_(identity.telegramId, identity.userToken);
    if (!eligibility.eligible) throw new Error('Referral access is disabled while your account has an active warning or ban.');
  }
  const referral = findReferralByOwner_(identity.telegramId);
  if (!referral) throw new Error('A referral link does not exist.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    requireReferralSystemEnabled_();
    const current = findReferralByOwner_(identity.telegramId);
    if (!current) throw new Error('A referral link does not exist.');
    referralSheet_().getRange(current.row, 4).setValue(enabled);
    referralSheet_().getRange(current.row, 8).setValue(new Date());
    return { enabled: enabled };
  } finally {
    lock.releaseLock();
  }
}

function claimReferral_(identity) {
  if (!isReferralSystemEnabled_()) return { claimed: false, giftReceived: 0, showGift: false, systemEnabled: false };
  const visits = visitsSheet_();
  const visitRow = findVisitRow_(identity.telegramId);
  if (!visitRow) throw new Error('No first-visit record was found.');

  const first = visits.getRange(visitRow, 1, 1, 8).getValues()[0];
  const status = String(first[4] || '');
  const giftAlreadyReceived = normalizeGift_(first[5]);

  // Never expose or grant a reward when the signed first-visit record points
  // back to the current user, even if an old or manually edited row says claimed.
  const firstVisitReferral = first[2] ? findReferralByCode_(String(first[2])) : null;
  if (firstVisitReferral && firstVisitReferral.ownerId === identity.telegramId) {
    if (status !== 'claimed') visits.getRange(visitRow, 5).setValue('ignored');
    return { claimed: false, giftReceived: 0, showGift: false, selfReferral: true };
  }
  if (status === 'claimed') {
    return { claimed: true, giftReceived: giftAlreadyReceived, ownerEarned: Number(first[6] || 0), showGift: giftAlreadyReceived > 0 && !first[7] };
  }
  if (status !== 'pending' || first[3] !== true || !first[2]) {
    return { claimed: false, giftReceived: 0, showGift: false };
  }

  const referral = findReferralByCode_(String(first[2]));
  if (!referral || !referral.enabled) {
    visits.getRange(visitRow, 5).setValue('ignored');
    return { claimed: false, giftReceived: 0, showGift: false };
  }
  if (referral.ownerId === identity.telegramId) {
    visits.getRange(visitRow, 5).setValue('ignored');
    throw new Error('Referral self-registration is not allowed.');
  }
  const ownerEligibility = isUserEligible_(referral.ownerId, '');
  if (!ownerEligibility.eligible) {
    visits.getRange(visitRow, 5).setValue('ignored');
    return { claimed: false, giftReceived: 0, showGift: false };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    if (!isReferralSystemEnabled_()) return { claimed: false, giftReceived: 0, showGift: false, systemEnabled: false };
    const refreshedVisitRow = findVisitRow_(identity.telegramId);
    const refreshedVisit = visitsSheet_().getRange(refreshedVisitRow, 1, 1, 8).getValues()[0];
    if (String(refreshedVisit[4] || '') === 'claimed') {
      const previousGift = normalizeGift_(refreshedVisit[5]);
      return { claimed: true, giftReceived: previousGift, ownerEarned: Number(refreshedVisit[6] || 0), showGift: previousGift > 0 && !refreshedVisit[7] };
    }
    if (String(refreshedVisit[4] || '') !== 'pending' || refreshedVisit[3] !== true) {
      return { claimed: false, giftReceived: 0, showGift: false };
    }

    const currentReferral = findReferralByCode_(String(refreshedVisit[2]));
    if (!currentReferral || !currentReferral.enabled || currentReferral.ownerId !== referral.ownerId) {
      visitsSheet_().getRange(refreshedVisitRow, 5).setValue('ignored');
      return { claimed: false, giftReceived: 0, showGift: false };
    }
    if (currentReferral.ownerId === identity.telegramId) {
      visitsSheet_().getRange(refreshedVisitRow, 5).setValue('ignored');
      throw new Error('Referral self-registration is not allowed.');
    }
    // Re-check restrictions while holding the transaction lock; a warning or ban
    // issued after the initial lookup must prevent this reward.
    const latestOwnerEligibility = isUserEligible_(currentReferral.ownerId, '');
    if (!latestOwnerEligibility.eligible) {
      visitsSheet_().getRange(refreshedVisitRow, 5).setValue('ignored');
      return { claimed: false, giftReceived: 0, showGift: false };
    }

    const visitorRow = ensureUserRow_(identity.telegramId, 0);
    const ownerRow = findUserRow_(currentReferral.ownerId);
    if (!ownerRow) {
      visitsSheet_().getRange(refreshedVisitRow, 5).setValue('ignored');
      return { claimed: false, giftReceived: 0, showGift: false };
    }

    const visitorBalance = userBalance_(visitorRow);
    const ownerBalance = userBalance_(ownerRow);
    const gift = normalizeGift_(currentReferral.giftAmount);
    const ownerReward = BUYAD_REFERRAL_BONUS - gift;

    const ledger = eventsSheet_();
    let eventRow = 0;
    try {
      setUserBalance_(visitorRow, visitorBalance + gift);
      setUserBalance_(ownerRow, ownerBalance + ownerReward);
      ledger.appendRow([
        identity.telegramId, currentReferral.ownerId, currentReferral.code,
        gift, ownerReward, new Date()
      ]);
      eventRow = ledger.getLastRow();
      visitsSheet_().getRange(refreshedVisitRow, 5, 1, 4).setValues([['claimed', gift, ownerReward, '']]);
      SpreadsheetApp.flush();
    } catch (error) {
      try { if (eventRow > 0 && eventRow === ledger.getLastRow()) ledger.deleteRow(eventRow); } catch (_) {}
      try { visitsSheet_().getRange(refreshedVisitRow, 5, 1, 4).setValues([['pending', 0, 0, '']]); } catch (_) {}
      setUserBalance_(visitorRow, visitorBalance);
      setUserBalance_(ownerRow, ownerBalance);
      throw new Error('Could not update the Google Sheets balance. Please try again.');
    }

    return { claimed: true, giftReceived: gift, ownerEarned: ownerReward, showGift: gift > 0 };
  } finally {
    lock.releaseLock();
  }
}

function markReferralGiftSeen_(identity) {
  requireReferralSystemEnabled_();
  const row = findVisitRow_(identity.telegramId);
  if (!row) return { marked: false };
  const visits = visitsSheet_();
  const value = visits.getRange(row, 5, 1, 4).getValues()[0];
  if (String(value[0]) === 'claimed' && normalizeGift_(value[1]) > 0 && !value[3]) {
    visits.getRange(row, 8).setValue(new Date());
  }
  return { marked: true };
}
