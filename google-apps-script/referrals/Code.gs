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

function doGet(e) {
  const query = (e && e.parameter) || {};
  const callback = String(query.callback || '');
  let result;
  try {
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callback)) {
      throw new Error('Invalid JSONP callback.');
    }
    const payload = query.payload ? JSON.parse(query.payload) : {};
    const identity = verifyTelegramInitData_(String(query.initData || ''), payload.userToken || '');
    result = dispatchReferralAction_(String(query.action || ''), identity, payload);
    result = Object.assign({ success: true }, result || {});
  } catch (error) {
    result = { success: false, error: publicError_(error) };
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
    case 'getState':
      return getReferralState_(identity);
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

  const secretKey = Utilities.computeHmacSha256Signature('WebAppData', botToken);
  const calculatedHash = bytesToHex_(Utilities.computeHmacSha256Signature(checkString, secretKey));
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
    startParam: String(values.start_param || ''),
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
      return { row: i + 2, ownerId: String(rows[i][0]), code: String(rows[i][1]), url: String(rows[i][2]), enabled: rows[i][3] === true || String(rows[i][3]).toLowerCase() === 'true', shareText: String(rows[i][4] || BUYAD_DEFAULT_SHARE_TEXT), giftAmount: normalizeGift_(rows[i][5]), createdAt: rows[i][6] || '' };
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
      return { row: i + 2, ownerId: String(rows[i][0]), code: String(rows[i][1]), url: String(rows[i][2]), enabled: rows[i][3] === true || String(rows[i][3]).toLowerCase() === 'true', shareText: String(rows[i][4] || BUYAD_DEFAULT_SHARE_TEXT), giftAmount: normalizeGift_(rows[i][5]), createdAt: rows[i][6] || '' };
    }
  }
  return null;
}

function normalizeGift_(value) {
  const amount = Math.round(Number(value) || 0);
  return Math.max(0, Math.min(BUYAD_MAX_GIFT, amount));
}

function registerReferralVisit_(identity) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const existingRow = findVisitRow_(identity.telegramId);
    if (existingRow) {
      const existing = visitsSheet_().getRange(existingRow, 1, 1, 8).getValues()[0];
      return { firstVisit: false, isNew: existing[3] === true, referralCode: String(existing[2] || '') };
    }

    // The user must not already exist in Users before this first-visit stamp.
    const isNew = findUserRow_(identity.telegramId) === 0;
    const rawCode = identity.startParam;
    const referralCode = /^ref_[a-f0-9]{64}$/.test(rawCode) ? rawCode : '';
    const sheet = visitsSheet_();
    sheet.appendRow([
      identity.telegramId, new Date(), referralCode, isNew,
      referralCode && isNew ? 'pending' : 'ignored', 0, 0, ''
    ]);
    return { firstVisit: true, isNew: isNew, referralCode: referralCode };
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
  const isBanned = banned.some(function (entry) {
    const value = restrictionValue_(entry);
    return value === id || tokens.indexOf(value) >= 0;
  });
  if (isBanned) return { eligible: false, reason: 'Аккаунт заблокирован' };

  const now = Date.now();
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
      const pattern = new RegExp('(?:export\\s+)?const\\s+' + name + '\\s*=\\s*(\\[[\\s\\S]*?\\])\\s*;');
      const match = source.match(pattern);
      if (!match) throw new Error('Missing ' + name);
      result[name] = JSON.parse(match[1]);
    });
    cache.put('buyad_referral_admin_restrictions_v1', JSON.stringify(result), 20);
    return result;
  } catch (error) {
    throw new Error('Could not verify the account restriction status. Try again later.');
  }
}

function getReferralState_(identity) {
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
    telegramIdFound: !!row,
    balance: balance,
    eligible: eligibility.eligible,
    eligibilityReason: eligibility.reason,
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

function createReferral_(identity) {
  const eligibility = isUserEligible_(identity.telegramId, identity.userToken);
  if (!eligibility.eligible) throw new Error('Referral access is disabled while your account has an active warning or ban.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const existing = findReferralByOwner_(identity.telegramId);
    if (existing) return { referral: { url: existing.url, enabled: existing.enabled, manuallyEnabled: existing.enabled, shareText: existing.shareText, giftAmount: existing.giftAmount } };

    const userRow = findUserRow_(identity.telegramId);
    if (!userRow) throw new Error('This Telegram account has no registered user row in Users.');
    const balance = userBalance_(userRow);
    if (balance < BUYAD_CREATE_COST) throw new Error('Not enough crystals. 25 crystals are required.');

    const digest = bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, identity.telegramId, Utilities.Charset.UTF_8));
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
    const current = findReferralByOwner_(identity.telegramId);
    if (!current) throw new Error('A referral link does not exist.');
    const sheet = referralSheet_();
    sheet.getRange(current.row, 5, 1, 3).setValues([[shareText, gift, current.createdAt || new Date()]]);
    sheet.getRange(current.row, 8).setValue(new Date());
    SpreadsheetApp.flush();
    return { saved: true, shareText: shareText, giftAmount: gift };
  } finally {
    lock.releaseLock();
  }
}

function setReferralEnabled_(identity, enabled) {
  if (enabled) {
    const eligibility = isUserEligible_(identity.telegramId, identity.userToken);
    if (!eligibility.eligible) throw new Error('Referral access is disabled while your account has an active warning or ban.');
  }
  const referral = findReferralByOwner_(identity.telegramId);
  if (!referral) throw new Error('A referral link does not exist.');
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
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
  const visits = visitsSheet_();
  const visitRow = findVisitRow_(identity.telegramId);
  if (!visitRow) throw new Error('No first-visit record was found.');

  const first = visits.getRange(visitRow, 1, 1, 8).getValues()[0];
  const status = String(first[4] || '');
  const giftAlreadyReceived = normalizeGift_(first[5]);
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
  const ownerEligibility = isUserEligible_(referral.ownerId, '');
  if (!ownerEligibility.eligible) {
    visits.getRange(visitRow, 5).setValue('ignored');
    return { claimed: false, giftReceived: 0, showGift: false };
  }
  if (referral.ownerId === identity.telegramId) {
    visits.getRange(visitRow, 5).setValue('ignored');
    throw new Error('Referral self-registration is not allowed.');
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
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
  const row = findVisitRow_(identity.telegramId);
  if (!row) return { marked: false };
  const visits = visitsSheet_();
  const value = visits.getRange(row, 5, 1, 4).getValues()[0];
  if (String(value[0]) === 'claimed' && normalizeGift_(value[1]) > 0 && !value[3]) {
    visits.getRange(row, 8).setValue(new Date());
  }
  return { marked: true };
}
