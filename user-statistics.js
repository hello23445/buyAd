/* BuyAd user statistics archive and admin UI. */
(() => {
  'use strict';

  const tx = (ru, en) => (localStorage.getItem('lang') || 'ru') === 'ru' ? ru : en;
  const REPOSITORY = 'hello23445/buyAd';
  const FILE_PATH = 'data/user-statistics.json';
  const TOKEN_BROKER = 'https://script.google.com/macros/s/AKfycbzTDNI5q2qAUWHoXsm5KJWlnrv0ivvK5LI6Gbevp9A-u31L48D0wZbWuDnD-X52vo-MOA/exec';
  const GITHUB_API = 'https://api.github.com/repos/' + REPOSITORY + '/contents/' + FILE_PATH;
  const MOSCOW_TZ = 'Europe/Moscow';
  let githubTokenPromise = null;
  let writeQueue = Promise.resolve();
  let lastResult = null;
  let archiveCache = null;
  let archiveCacheAt = 0;
  let searchSequence = 0;

  const currentToken = () => String(localStorage.getItem('get_UserToken') || '');
  const currentTelegramId = () => String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '');
  const currentUserId = () => {
    try { return typeof getUserID === 'function' ? String(getUserID() || '') : currentTelegramId(); }
    catch (_) { return currentTelegramId(); }
  };
  const currentAdmin = () => {
    try { return typeof getCurrentAdmin === 'function' ? getCurrentAdmin() : null; }
    catch (_) { return null; }
  };
  const hasAccess = () => {
    const admin = currentAdmin();
    return !!admin && Number(admin.admin_level) >= 2 &&
      (typeof adminHasPermission !== 'function' || adminHasPermission('viewUserStatistics'));
  };
  const nowIso = () => new Date().toISOString();

  function getGithubToken() {
    if (!githubTokenPromise) {
      githubTokenPromise = fetch(TOKEN_BROKER, { cache: 'no-store' })
        .then(response => {
          if (!response.ok) throw new Error(tx('Не удалось получить GitHub API token', 'Could not get GitHub API token'));
          return response.json();
        })
        .then(data => {
          if (!data || !data.token) throw new Error(tx('GitHub API token отсутствует', 'GitHub API token is missing'));
          return String(data.token);
        })
        .catch(error => {
          githubTokenPromise = null;
          throw error;
        });
    }
    return githubTokenPromise;
  }

  function decodeBase64Utf8(value) {
    const binary = atob(String(value || '').replace(/\s/g, ''));
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function encodeBase64Utf8(value) {
    const bytes = new TextEncoder().encode(String(value));
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  async function readArchive(options = {}) {
    if (options.force !== true && archiveCache && Date.now() - archiveCacheAt < 20000) return archiveCache;
    const token = await getGithubToken();
    const response = await fetch(GITHUB_API, {
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error(tx('Не удалось прочитать архив статистики: HTTP ', 'Could not read statistics archive: HTTP ') + response.status);
    const file = await response.json();
    let archive;
    try { archive = JSON.parse(decodeBase64Utf8(file.content)); }
    catch (_) { throw new Error(tx('Файл архива статистики содержит некорректный JSON.', 'The statistics archive contains invalid JSON.')); }
    if (!archive || typeof archive !== 'object') archive = {};
    if (!archive.users || typeof archive.users !== 'object') archive.users = {};
    archiveCache = { token, sha: file.sha, archive };
    archiveCacheAt = Date.now();
    return archiveCache;
  }

  function mutateArchive(mutator, message) {
    const task = async () => {
      const token = await getGithubToken();
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = await readArchive({ force: true });
        const archive = current.archive;
        if (!archive.users || typeof archive.users !== 'object') archive.users = {};
        mutator(archive);
        archive.version = 1;
        archive.updatedAt = nowIso();
        const response = await fetch(GITHUB_API, {
          method: 'PUT',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: 'Bearer ' + token,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: message || 'Update user statistics archive',
            content: encodeBase64Utf8(JSON.stringify(archive, null, 2) + '\n'),
            sha: current.sha
          })
        });
        if (response.ok) {
          lastResult = archive;
          archiveCache = null;
          archiveCacheAt = 0;
          return archive;
        }
        if (response.status !== 409 && response.status !== 422) {
          const detail = await response.text().catch(() => '');
          throw new Error(tx('GitHub API вернул ', 'GitHub API returned ') + response.status + (detail ? ': ' + detail.slice(0, 220) : ''));
        }
      }
      throw new Error(tx('Архив часто обновляется; повторите действие.', 'The archive is updated frequently; please try again.'));
    };
    writeQueue = writeQueue.catch(() => {}).then(task);
    return writeQueue;
  }

  function userKey(telegramId, fallbackId, token) {
    if (telegramId) return 'tg:' + String(telegramId);
    if (fallbackId) return 'local:' + String(fallbackId);
    if (token) return 'token:' + String(token);
    return '';
  }

  function findKeyByToken(archive, token) {
    if (!token) return '';
    return Object.keys(archive.users || {}).find(key => {
      const user = archive.users[key] || {};
      return Array.isArray(user.tokens) && user.tokens.map(String).includes(String(token));
    }) || '';
  }

  function mergeUserRecords(target, source) {
    if (!source || typeof source !== 'object') return target;
    const merged = Object.assign({}, source, target);
    const tokens = new Set([...(Array.isArray(source.tokens) ? source.tokens : []), ...(Array.isArray(target.tokens) ? target.tokens : [])].map(String).filter(Boolean));
    merged.tokens = Array.from(tokens);
    merged.punishments = [
      ...(Array.isArray(source.punishments) ? source.punishments : []),
      ...(Array.isArray(target.punishments) ? target.punishments : [])
    ];
    const byId = new Map();
    merged.punishments.forEach(item => {
      const id = item && (item.id || [item.kind, item.issuedAt, item.identifier].join('|'));
      if (id) byId.set(String(id), item);
    });
    merged.punishments = Array.from(byId.values());
    if (!merged.registeredAt) merged.registeredAt = source.registeredAt || null;
    if (!merged.firstSeenAt) merged.firstSeenAt = source.firstSeenAt || target.firstSeenAt || null;
    return merged;
  }

  function getOrCreateUser(archive, target) {
    const tgId = String(target.telegramId || '');
    const token = String(target.token || '');
    const fallback = String(target.fallbackId || '');
    let key = tgId ? userKey(tgId, '', '') : (fallback ? userKey('', fallback, '') : '');
    if (key && archive.users[key]) {
      const tokenMatch = findKeyByToken(archive, token);
      if (tokenMatch && tokenMatch !== key) {
        archive.users[key] = mergeUserRecords(archive.users[key], archive.users[tokenMatch]);
        delete archive.users[tokenMatch];
      }
    } else if (token) {
      key = findKeyByToken(archive, token) || key;
    }
    if (!key) key = userKey('', '', token);
    if (!archive.users[key]) {
      archive.users[key] = {
        telegramId: tgId || '',
        fallbackId: fallback || '',
        tokens: [],
        firstSeenAt: nowIso(),
        registeredAt: null,
        lastLoginAt: null,
        loginCount: 0,
        punishments: []
      };
    }
    const user = archive.users[key];
    if (tgId) user.telegramId = tgId;
    if (fallback) user.fallbackId = fallback;
    if (!Array.isArray(user.tokens)) user.tokens = [];
    if (token && !user.tokens.includes(token)) user.tokens.push(token);
    if (!Array.isArray(user.punishments)) user.punishments = [];
    return { key, user };
  }

  async function recordLogin(isRegistration) {
    const token = currentToken();
    const telegramId = currentTelegramId();
    const userId = currentUserId();
    if (!token && !telegramId && !userId) return;
    const fallbackId = telegramId ? '' : userId;
    return mutateArchive(archive => {
      const result = getOrCreateUser(archive, { telegramId, fallbackId, token });
      const user = result.user;
      const now = nowIso();
      if (!user.firstSeenAt) user.firstSeenAt = now;
      user.lastLoginAt = now;
      user.loginCount = Number(user.loginCount || 0) + 1;
      if (isRegistration && !user.registeredAt) user.registeredAt = now;
      user.lastSeenToken = token || user.lastSeenToken || '';
    }, isRegistration ? 'Register user in statistics archive' : 'Record user login');
  }

  function inferIdentifierType(value) {
    const text = String(value || '').trim();
    if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(text) || text.includes(':')) return 'ip';
    if (/^\d{4,}$/.test(text)) return 'telegram_id';
    return 'token';
  }

  function adminDetails() {
    const admin = currentAdmin() || {};
    const isHidden = localStorage.getItem('hideAdminNameOnBan') === 'true' ||
      localStorage.getItem('buyAdHideWarningIssuerName') === 'true';
    return {
      adminName: isHidden ? '' : String(admin.admin_name || ('Администратор ' + (admin.admin_level || '') + ' уровня')),
      adminNameHidden: isHidden,
      adminLevel: Number(admin.admin_level || 0)
    };
  }

  function appendPunishment(archive, targetValue, kind, reason, durationDays, expiresAt, removed) {
    const identifier = String(targetValue || '').trim();
    if (!identifier) return;
    const identifierType = inferIdentifierType(identifier);
    const target = identifierType === 'telegram_id'
      ? { telegramId: identifier }
      : (identifierType === 'token' ? { token: identifier } : { token: '', fallbackId: 'ip:' + identifier });
    const result = getOrCreateUser(archive, target);
    const user = result.user;
    const rows = user.punishments;
    if (removed) {
      const existing = [...rows].reverse().find(row =>
        row && row.kind === kind && row.identifier === identifier && !row.removedAt
      );
      if (existing) existing.removedAt = nowIso();
      else rows.push({
        id: 'removed:' + kind + ':' + identifier + ':' + Date.now(),
        kind, identifier, identifierType, issuedAt: '', removedAt: nowIso(),
        reason: '', adminName: adminDetails().adminName,
        adminNameHidden: adminDetails().adminNameHidden
      });
      return;
    }
    const admin = adminDetails();
    rows.push({
      id: kind + ':' + identifier + ':' + Date.now(),
      kind,
      identifier,
      identifierType,
      issuedAt: nowIso(),
      expiresAt: expiresAt || '',
      durationDays: durationDays == null ? null : Number(durationDays),
      reason: String(reason || tx('Не указана', 'Not specified')),
      adminName: admin.adminName,
      adminNameHidden: admin.adminNameHidden,
      adminLevel: admin.adminLevel
    });
  }

  function recordPunishment(kind, targetValue, reason, durationDays, expiresAt, removed) {
    return mutateArchive(archive => {
      appendPunishment(archive, targetValue, kind, reason, durationDays, expiresAt, removed);
    }, removed ? 'Record punishment removal' : 'Record punishment');
  }

  function recordIpAdminAction(action, details) {
    const value = String(details && details.targetIp || '').trim();
    if (!value) return;
    const reason = details.reason || tx('Не указана', 'Not specified');
    const duration = details.durationDays == null ? null : details.durationDays;
    const expires = details.expiresAt || '';
    return recordPunishment('ip_ban', value, reason, duration, expires, action === 'ip_unbanned');
  }

  function warningRows() {
    try {
      if (typeof getRuntimeConfig === 'function') {
        const rows = getRuntimeConfig('UserWarnings', []);
        if (Array.isArray(rows)) return rows;
      }
    } catch (_) {}
    return [];
  }

  function syncWarnings(rows) {
    if (!Array.isArray(rows) || !rows.length) return Promise.resolve();
    return mutateArchive(archive => {
      rows.forEach(row => {
        if (!row || typeof row !== 'object') return;
        const telegramId = String(row.telegramId || '');
        const token = String(row.token || '');
        if (!telegramId && !token) return;
        const result = getOrCreateUser(archive, { telegramId, token });
        const user = result.user;
        const id = 'warning:' + String(row.id || [telegramId, row.issuedAt, row.reason].join(':'));
        if (user.punishments.some(item => item.id === id)) return;
        user.punishments.push({
          id,
          kind: 'warning',
          identifier: telegramId || token,
          identifierType: telegramId ? 'telegram_id' : 'token',
          issuedAt: row.issuedAt || '',
          expiresAt: row.lockUntil || row.removeAt || '',
          reason: String(row.reason || tx('Не указана', 'Not specified')),
          adminName: row.adminNameHidden ? '' : String(row.adminName || ''),
          adminNameHidden: row.adminNameHidden === true,
          adminLevel: Number(row.adminLevel || 0)
        });
      });
    }, 'Sync warnings into user statistics archive');
  }

  function getRuntimeArray(name) {
    try {
      if (typeof getRuntimeConfig === 'function') {
        const rows = getRuntimeConfig(name, []);
        return Array.isArray(rows) ? rows : [];
      }
    } catch (_) {}
    return [];
  }

  function entryValue(entry) {
    if (entry && typeof entry === 'object') {
      return String(entry.value || entry.token || entry.ip || entry.telegramId || '').trim();
    }
    return String(entry || '').trim();
  }

  function isExpired(entry) {
    if (!entry || typeof entry !== 'object' || !entry.expiresAt) return false;
    const time = Date.parse(entry.expiresAt);
    return Number.isFinite(time) && time <= Date.now();
  }

  function matchesProfile(entry, profile, preferredType) {
    if (isExpired(entry)) return false;
    const value = entryValue(entry);
    if (!value) return false;
    const type = String(entry.type || preferredType || '');
    const tokens = Array.isArray(profile.tokens) ? profile.tokens.map(String) : [];
    const ips = Array.isArray(profile.ipAddresses) ? profile.ipAddresses.map(String) : [];
    if (type === 'telegramId' || type === 'telegram_id') return !!profile.telegramId && value === String(profile.telegramId);
    if (type === 'ip') return ips.includes(value);
    if (type === 'token') return tokens.includes(value);
    return tokens.includes(value) || (!!profile.telegramId && value === String(profile.telegramId)) || ips.includes(value);
  }

  function collectCurrentRestrictions(profile) {
    const result = [];
    const groups = [
      { name: 'BanForever', kind: 'account_ban', type: 'token', label: tx('Блокировка по токену', 'Token ban') }, 
      { name: 'BlockedUsersTelegramID', kind: 'telegram_ban', type: 'telegram_id', label: tx('Блокировка по Telegram ID', 'Telegram ID ban') }, 
      { name: 'BlockedUsersIPadresses', kind: 'ip_ban', type: 'ip', label: tx('Блокировка по IP', 'IP ban') }, 
      { name: 'BlockCreateAds', kind: 'ads_restriction', type: '', label: tx('Запрет создания/редактирования рекламы', 'Ad creation/editing restriction') }
    ];
    groups.forEach(group => {
      getRuntimeArray(group.name).forEach(entry => {
        const type = entry && typeof entry === 'object' ? String(entry.type || group.type) : group.type;
        if (!matchesProfile(entry, profile, type)) return;
        result.push({
          id: group.name + ':' + entryValue(entry) + ':' + String(entry && entry.issuedAt || ''),
          kind: group.kind,
          identifier: entryValue(entry),
          identifierType: type || group.type,
          issuedAt: entry && typeof entry === 'object' ? entry.issuedAt || '' : '',
          expiresAt: entry && typeof entry === 'object' ? entry.expiresAt || '' : '',
          reason: entry && typeof entry === 'object' ? entry.reason || tx('Не указана', 'Not specified') : tx('Не указана', 'Not specified'),
          adminName: entry && typeof entry === 'object' && !entry.adminNameHidden ? entry.adminName || '' : '',
          adminNameHidden: !!(entry && typeof entry === 'object' && entry.adminNameHidden)
        });
      });
    });
    return result;
  }

  function getWarningsForProfile(profile) {
    const tokens = Array.from(new Set((profile.tokens || []).map(String).filter(Boolean)));
    const telegramId = String(profile.telegramId || '');
    const api = window.BuyAdWarnings;
    // Use the warning system's normalized/cleaned records where available,
    // and merge matches by ID to avoid counting the same warning twice
    // when it is linked to both Telegram ID and an older token.
    let rows = [];
    if (api && typeof api.warningsFor === 'function') {
      tokens.forEach(token => {
        rows = rows.concat(api.warningsFor(token, telegramId) || []);
      });
      if (!tokens.length && telegramId) rows = rows.concat(api.warningsFor('', telegramId) || []);
    } else {
      rows = warningRows().filter(row =>
        (telegramId && String(row.telegramId || '') === telegramId) ||
        (row.token && tokens.includes(String(row.token)))
      );
    }
    const byId = new Map();
    rows.forEach(row => {
      if (!row || typeof row !== 'object') return;
      const key = String(row.id || [row.telegramId, row.token, row.issuedAt, row.reason].join('|'));
      if (!byId.has(key)) byId.set(key, row);
    });
    return Array.from(byId.values());
  }

  function punishmentLabel(kind) {
    const labels = {
      account_ban: tx('Блокировка аккаунта', 'Account ban'),
      telegram_ban: tx('Блокировка по Telegram ID', 'Telegram ID ban'),
      ip_ban: tx('Блокировка по IP', 'IP ban'),
      ads_restriction: tx('Запрет создания/редактирования рекламы', 'Ad creation/editing restriction'),
      warning: tx('Предупреждение', 'Warning')
    };
    return labels[kind] || String(kind || tx('Наказание', 'Punishment'));
  }

  function moscowDate(value) {
    if (!value) return tx('Не зафиксирована', 'Not recorded');
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return tx('Не зафиксирована', 'Not recorded');
    return new Intl.DateTimeFormat((localStorage.getItem('lang') || 'ru') === 'ru' ? 'ru-RU' : 'en-GB', {
      timeZone: MOSCOW_TZ,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23'
    }).format(date);
  }

  function makeElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function appendField(parent, label, value) {
    const wrap = makeElement('div', 'field');
    wrap.style.marginBottom = '10px';
    wrap.appendChild(makeElement('div', 'field__label', label));
    wrap.appendChild(makeElement('div', 'rules__text', value == null || value === '' ? '—' : value));
    parent.appendChild(wrap);
    return wrap;
  }

  async function copyValue(value, button) {
    try {
      if (typeof copyTextCompat === 'function') await copyTextCompat(value);
      else if (navigator.clipboard && navigator.clipboard.writeText) await navigator.clipboard.writeText(String(value));
      else throw new Error('Clipboard is unavailable');
      if (button) {
        const original = button.textContent;
        button.textContent = tx('Скопировано', 'Copied');
        setTimeout(() => { button.textContent = original; }, 1600);
      }
    } catch (_) {
      setStatus(tx('Не удалось скопировать значение.', 'Could not copy value.'));
    }
  }

  function setStatus(text, isError) {
    const node = document.getElementById('user-statistics-status');
    if (node) {
      node.textContent = String(text || '');
      node.style.color = isError ? '#ff7777' : '';
    }
  }

  async function loadLiveStats(profile) {
    const userId = String(profile.telegramId || '');
    if (!userId || typeof GAS_SYS_URL === 'undefined' || typeof GAS_ADS_URL === 'undefined') {
      return { crystals: null, adCount: null };
    }
    const result = { crystals: null, adCount: null };
    const query = '?userID=' + encodeURIComponent(userId);
    const tasks = [
      fetch(GAS_SYS_URL + '?action=getUserCrystals' + query, { cache: 'no-store' })
        .then(response => response.ok ? response.json() : Promise.reject(new Error('crystals')))
        .then(data => { if (data && Number.isFinite(Number(data.crystals))) result.crystals = Number(data.crystals); })
        .catch(() => {}),
      Promise.all([
        fetch(GAS_SYS_URL + '?action=getMyPending' + query, { cache: 'no-store' }).then(response => response.ok ? response.json() : []),
        fetch(GAS_ADS_URL + '?action=getMyAds' + query, { cache: 'no-store' }).then(response => response.ok ? response.json() : [])
      ]).then(([pending, approved]) => {
        if (Array.isArray(pending) && Array.isArray(approved)) {
          result.adCount = pending.length + approved.filter(ad => (ad.status || 'approved') !== 'rejected').length;
        }
      }).catch(() => {})
    ];
    await Promise.all(tasks);
    return result;
  }

  function findArchiveProfile(archive, query) {
    const value = String(query || '').trim();
    if (!value) return null;
    const isTelegramId = /^\d{4,}$/.test(value);
    for (const [key, user] of Object.entries(archive.users || {})) {
      if (!user || typeof user !== 'object') continue;
      if (isTelegramId && String(user.telegramId || '') === value) return { key, user };
      if (Array.isArray(user.tokens) && user.tokens.map(String).includes(value)) return { key, user };
    }
    if (isTelegramId) {
      return { key: 'tg:' + value, user: { telegramId: value, tokens: [], punishments: [], registeredAt: null, lastLoginAt: null } };
    }
    return { key: 'token:' + value, user: { telegramId: '', tokens: [value], punishments: [], registeredAt: null, lastLoginAt: null } };
  }

  function buildPunishmentHistory(profile) {
    const all = [
      ...(Array.isArray(profile.punishments) ? profile.punishments : []),
      ...collectCurrentRestrictions(profile),
      ...getWarningsForProfile(profile).map(row => ({
        id: 'warning:' + String(row.id || row.issuedAt || Math.random()),
        kind: 'warning',
        identifier: row.telegramId || row.token || '',
        identifierType: row.telegramId ? 'telegram_id' : 'token',
        issuedAt: row.issuedAt || '',
        reason: row.reason || tx('Не указана', 'Not specified'),
        adminName: row.adminNameHidden ? '' : row.adminName || '',
        adminNameHidden: row.adminNameHidden === true
      }))
    ];
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 2);
    const unique = new Map();
    all.forEach(row => {
      if (!row || !row.issuedAt) return;
      const time = Date.parse(row.issuedAt);
      if (!Number.isFinite(time) || time < cutoff.getTime()) return;
      const id = String(row.id || [row.kind, row.issuedAt, row.identifier].join('|'));
      if (!unique.has(id)) unique.set(id, row);
    });
    return Array.from(unique.values()).sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt));
  }

  function renderHistory(parent, profile) {
    const rows = buildPunishmentHistory(profile);
    parent.replaceChildren();
    if (!rows.length) {
      parent.appendChild(makeElement('div', 'hint', tx('За последние два месяца наказаний с зафиксированной датой нет.', 'No punishments with recorded dates in the last two months.')));
      return;
    }
    rows.forEach((row, index) => {
      const card = makeElement('article', 'card punishment-history-entry');
      card.style.marginTop = '8px';
      card.appendChild(makeElement('div', 'card__title', '№' + (index + 1) + ' · ' + punishmentLabel(row.kind)));
      const issued = makeElement('div', 'punishment-history-date', moscowDate(row.issuedAt));
      issued.setAttribute('aria-label', tx('Дата и время выдачи по Москве', 'Issued date and time (Moscow)'));
      card.appendChild(issued);
      appendField(card, tx('Администратор', 'Administrator'), row.adminNameHidden || !row.adminName ? tx('Скрыто', 'Hidden') : row.adminName);
      appendField(card, tx('Причина', 'Reason'), row.reason || tx('Не указана', 'Not specified'));
      if (row.expiresAt) appendField(card, tx('Действует до (МСК)', 'Expires (MSK)'), moscowDate(row.expiresAt));
      if (row.removedAt) appendField(card, tx('Снято (МСК)', 'Removed (MSK)'), moscowDate(row.removedAt));
      parent.appendChild(card);
    });
  }

  function renderProfile(profile, live) {
    const output = document.getElementById('user-statistics-result');
    if (!output) return;
    output.classList.add('stats-result');
    output.replaceChildren();
    const warnings = getWarningsForProfile(profile).filter(row => {
      const expiresAt = row && (row.lockUntil || row.removeAt || row.expiresAt);
      return !isExpired({ expiresAt });
    });
    const activeRestrictions = collectCurrentRestrictions(profile);
    const activeBans = activeRestrictions.filter(row => row.kind !== 'ads_restriction');
    const adRestrictions = activeRestrictions.filter(row => row.kind === 'ads_restriction');
    const warningCount = warnings.length;
    let status = tx('Активен', 'Active');
    if (activeBans.some(row => row.kind === 'account_ban')) status = tx('Забанен по токену', 'Banned by token');
    else if (activeBans.some(row => row.kind === 'telegram_ban')) status = tx('Забанен по Telegram ID', 'Banned by Telegram ID');
    else if (activeBans.some(row => row.kind === 'ip_ban')) status = tx('Полностью забанен по IP', 'Fully banned by IP');
    else if (warningCount >= 3) status = tx('Забанен за 3 из 3 предупреждений', 'Banned after 3 of 3 warnings');

    const identityCard = makeElement('div', 'card stats-overview');
    identityCard.appendChild(makeElement('div', 'card__title', tx('Общая информация', 'General information')));
    appendField(identityCard, tx('Дата регистрации', 'Registration date'), moscowDate(profile.registeredAt));
    appendField(identityCard, tx('Последний вход', 'Last login'), moscowDate(profile.lastLoginAt));
    const telegramIdField = appendField(identityCard, 'Telegram ID', profile.telegramId || '—');
    const idCopy = makeElement('button', 'btn btn--ghost user-statistics-copy-id', tx('Копировать Telegram ID', 'Copy Telegram ID'));
    idCopy.type = 'button';
    idCopy.disabled = !profile.telegramId;
    idCopy.addEventListener('click', () => copyValue(profile.telegramId, idCopy));
    telegramIdField.appendChild(idCopy);
    appendField(identityCard, tx('Количество предупреждений', 'Warning count'), warningCount);
    appendField(identityCard, tx('Статус аккаунта', 'Account status'), status);
    appendField(identityCard, tx('Кристаллы', 'Crystals'), live.crystals == null ? (profile.crystals == null ? tx('Нет данных', 'No data') : profile.crystals) : live.crystals);
    appendField(identityCard, tx('Создано реклам', 'Ads created'), profile.adCreatedCount != null ? profile.adCreatedCount : (live.adCount == null ? (profile.adCount == null ? tx('Нет данных', 'No data') : profile.adCount) : live.adCount));

    identityCard.appendChild(makeElement('div', 'field__label', tx('Все токены аккаунта', 'All account tokens')));
    const tokenList = makeElement('div', 'stack-sm');
    const tokens = Array.isArray(profile.tokens) ? profile.tokens : [];
    if (!tokens.length) tokenList.appendChild(makeElement('div', 'hint', tx('Токены ещё не попали в архив.', 'Tokens have not been archived yet.')));
    tokens.forEach(token => {
      const row = makeElement('div', 'tokenbox');
      const code = makeElement('code', '', token);
      const button = makeElement('button', 'btn btn--ghost', tx('Копировать', 'Copy'));
      button.type = 'button';
      button.addEventListener('click', () => copyValue(token, button));
      row.append(code, button);
      tokenList.appendChild(row);
    });
    identityCard.appendChild(tokenList);
    output.appendChild(identityCard);

    if (activeBans.length) {
      const banCard = makeElement('div', 'card');
      banCard.appendChild(makeElement('div', 'card__title', tx('Данные блокировки', 'Ban details')));
      activeBans.forEach(row => {
        appendField(banCard, tx('Тип', 'Type'), row.identifierType === 'telegram_id' ? 'Telegram ID' : row.identifierType === 'ip' ? tx('IP-адрес', 'IP address') : tx('Токен', 'Token'));
        appendField(banCard, tx('Дата выдачи (МСК)', 'Issued (MSK)'), moscowDate(row.issuedAt));
        appendField(banCard, tx('Администратор', 'Administrator'), row.adminNameHidden || !row.adminName ? tx('Скрыто', 'Hidden') : row.adminName);
        appendField(banCard, tx('Причина', 'Reason'), row.reason || tx('Не указана', 'Not specified'));
        appendField(banCard, tx('Окончание (МСК)', 'Ends (MSK)'), row.expiresAt ? moscowDate(row.expiresAt) : tx('Навсегда', 'Permanent'));
      });
      output.appendChild(banCard);
    }

    const restrictionCard = makeElement('div', 'card');
    restrictionCard.appendChild(makeElement('div', 'card__title', tx('Ограничения рекламы', 'Ad restrictions')));
    if (!adRestrictions.length) {
      appendField(restrictionCard, tx('Создание и редактирование', 'Creating and editing'), tx('Ограничений нет', 'No restrictions'));
    } else {
      adRestrictions.forEach(row => {
        appendField(restrictionCard, tx('Создание и редактирование', 'Creating and editing'), tx('Заблокировано', 'Blocked'));
        appendField(restrictionCard, tx('Дата выдачи (МСК)', 'Issued (MSK)'), moscowDate(row.issuedAt));
        appendField(restrictionCard, tx('Дата окончания (МСК)', 'End date (MSK)'), row.expiresAt ? moscowDate(row.expiresAt) : tx('Навсегда', 'Permanent'));
        appendField(restrictionCard, tx('Администратор', 'Administrator'), row.adminNameHidden || !row.adminName ? tx('Скрыто', 'Hidden') : row.adminName);
        appendField(restrictionCard, tx('Причина', 'Reason'), row.reason || tx('Не указана', 'Not specified'));
      });
    }
    output.appendChild(restrictionCard);

    const historyCard = makeElement('div', 'card stats-history');
    historyCard.appendChild(makeElement('div', 'card__title', tx('История наказаний', 'Punishment history')));
    const historyButton = makeElement('button', 'btn btn--primary btn--full', tx('Список наказаний за последние 2 месяца', 'Punishments from the last 2 months'));
    historyButton.type = 'button';
    const historyContent = makeElement('div', 'stack-sm');
    historyContent.hidden = true;
    historyButton.addEventListener('click', () => {
      historyContent.hidden = !historyContent.hidden;
      if (!historyContent.hidden) renderHistory(historyContent, profile);
    });
    historyCard.append(historyButton, historyContent);
    output.appendChild(historyCard);
  }

  async function getProfileByIdentifier(query) {
    if (!hasAccess()) throw new Error(tx('Просмотр статистики доступен только администраторам 2-го уровня и выше.', 'User statistics are available to level 2 administrators and above only.'));
    const value = String(query || '').trim();
    if (!value) return null;
    const result = await readArchive();
    const found = findArchiveProfile(result.archive, value);
    if (!found) return null;
    const profile = { ...found.user };
    profile.telegramId = String(profile.telegramId || (/^\d{4,}$/.test(value) ? value : ''));
    profile.tokens = Array.isArray(profile.tokens) ? profile.tokens.map(String) : [];
    if (!profile.telegramId && !/^\d{4,}$/.test(value)) profile.tokens = Array.from(new Set([...profile.tokens, value]));
    return profile;
  }

  async function searchUser() {
    if (!hasAccess()) {
      setStatus(tx('Доступ разрешён только администраторам 2-го уровня и выше.', 'Access is available to level 2 administrators and above only.'), true);
      return;
    }
    const input = document.getElementById('user-statistics-query');
    const query = String(input && input.value || '').trim();
    if (!query) {
      setStatus(tx('Введите Telegram ID или токен.', 'Enter Telegram ID or token.'), true);
      return;
    }
    const button = document.getElementById('user-statistics-search');
    const sequence = ++searchSequence;
    if (button) button.disabled = true;
    setStatus(tx('Загружаю сохранённую статистику…', 'Loading saved statistics…'));
    try {
      const result = await readArchive();
      if (sequence !== searchSequence) return;
      const found = findArchiveProfile(result.archive, query);
      if (!found) throw new Error(tx('Пользователь не найден.', 'User not found.'));
      const profile = { ...found.user };
      profile.tokens = Array.isArray(profile.tokens) ? profile.tokens : [];
      if (/^\d{4,}$/.test(query)) profile.telegramId = query;
      if (!profile.telegramId && !/^\d{4,}$/.test(query)) profile.tokens = Array.from(new Set([...profile.tokens, query]));

      // Render the archived snapshot immediately. Live GAS requests run in background.
      renderProfile(profile, { crystals: null, adCount: null });
      setStatus(tx('Сохранённые данные показаны. Обновляю актуальные показатели…', 'Saved data displayed. Updating live statistics…'));
      if (button) button.disabled = false;

      loadLiveStats(profile).then(live => {
        if (sequence !== searchSequence) return;
        if (live.crystals != null) profile.crystals = live.crystals;
        if (live.adCount != null) {
          profile.adCount = live.adCount;
          profile.adCreatedCount = Math.max(Number(profile.adCreatedCount || 0), Number(live.adCount));
        }
        renderProfile(profile, live);
        setStatus(tx('Статистика обновлена. Время в карточке указано по Москве.', 'Statistics updated. Times are shown in Moscow time.'));
      }).catch(error => {
        if (sequence === searchSequence) setStatus(tx('Показаны сохранённые данные; актуальная статистика временно недоступна.', 'Saved data is shown; live statistics are temporarily unavailable.'));
        console.warn('Live user statistics unavailable:', error);
      });
    } catch (error) {
      if (sequence === searchSequence) setStatus((typeof buyAdUiTranslate === 'function' ? buyAdUiTranslate(error.message) : error.message) || tx('Не удалось получить статистику.', 'Could not retrieve statistics.'), true);
    } finally {
      if (sequence === searchSequence && button) button.disabled = false;
    }
  }

  function installStatisticsStyles() {
    if (document.getElementById('user-statistics-modern-styles')) return;
    const style = document.createElement('style');
    style.id = 'user-statistics-modern-styles';
    style.textContent = `
      #screen-user-statistics { --us-bg: var(--card-bg, rgba(255,255,255,.045)); --us-line: rgba(148,163,184,.18); }
      #screen-user-statistics > .stack { width: min(100%, 1040px); margin: 0 auto; gap: 18px; }
      #screen-user-statistics .screen__head { display:flex; align-items:center; gap:12px; margin-bottom:4px; }
      #screen-user-statistics .screen__title { font-size: clamp(22px, 3vw, 30px); font-weight:800; letter-spacing:-.035em; }
      #screen-user-statistics .card { background:var(--us-bg); border:1px solid var(--us-line); border-radius:20px; padding:clamp(16px, 2.5vw, 24px); box-shadow:0 10px 30px rgba(0,0,0,.10); min-width:0; }
      #screen-user-statistics .card__title { font-size:17px; font-weight:800; letter-spacing:-.02em; margin-bottom:16px; }
      #screen-user-statistics .field { min-width:0; margin-bottom:12px !important; padding:12px 14px; border:1px solid var(--us-line); border-radius:13px; background:rgba(148,163,184,.055); }
      #screen-user-statistics .user-statistics-copy-id { display:block; width:100%; margin-top:12px; }
      #screen-user-statistics .field__label { display:block; font-size:11px; font-weight:750; letter-spacing:.065em; text-transform:uppercase; opacity:.66; margin-bottom:6px; }
      #screen-user-statistics .rules__text { overflow-wrap:anywhere; line-height:1.45; font-weight:600; }
      #screen-user-statistics .textarea { width:100%; min-height:48px; border-radius:13px; }
      #screen-user-statistics .btn { min-height:42px; border-radius:12px; font-weight:750; transition:transform .16s ease, opacity .16s ease; }
      #screen-user-statistics .btn:not(:disabled):active { transform:scale(.98); }
      #screen-user-statistics .hint { line-height:1.5; opacity:.72; }
      #screen-user-statistics .tokenbox { display:flex; align-items:center; gap:10px; min-width:0; padding:10px 12px; border:1px solid var(--us-line); border-radius:12px; background:rgba(148,163,184,.045); }
      #screen-user-statistics .tokenbox code { flex:1; min-width:0; overflow-wrap:anywhere; white-space:normal; font-size:12px; }
      #screen-user-statistics .stats-result { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px; align-items:start; }
      #screen-user-statistics .stats-overview { grid-column:1 / -1; display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 12px; }
      #screen-user-statistics .stats-overview > .card__title,
      #screen-user-statistics .stats-overview > .field__label,
      #screen-user-statistics .stats-overview > .stack-sm { grid-column:1 / -1; }
      #screen-user-statistics .stats-overview > .field:nth-of-type(n+7) { background:rgba(99,102,241,.07); border-color:rgba(129,140,248,.22); }
      #screen-user-statistics .stats-history { grid-column:1 / -1; }
      #screen-user-statistics .stats-history .card { margin-top:10px !important; box-shadow:none; }
      #screen-user-statistics .stack-sm { display:grid; gap:9px; }
      #screen-user-statistics button:focus-visible, #screen-user-statistics input:focus-visible { outline:2px solid #818cf8; outline-offset:3px; }
      @media (max-width:680px) {
        #screen-user-statistics > .stack { gap:13px; }
        #screen-user-statistics .stats-result { grid-template-columns:minmax(0,1fr); gap:12px; }
        #screen-user-statistics .stats-overview { grid-template-columns:minmax(0,1fr); }
        #screen-user-statistics .stats-result > .card, #screen-user-statistics .stats-history { grid-column:1; }
        #screen-user-statistics .card { border-radius:16px; padding:16px; }
        #screen-user-statistics .tokenbox { align-items:flex-start; flex-direction:column; }
        #screen-user-statistics .tokenbox .btn { width:100%; }
      }
    `;
    document.head.appendChild(style);
  }

  function addScreenAndMenu() {
    const menu = document.querySelector('#screen-admin .menu');
    if (menu && !document.getElementById('admin-user-statistics')) {
      const group = makeElement('div', 'menu__group', tx('Пользователи', 'Users'));
      group.id = 'admin-user-statistics-group';
      const button = makeElement('button', 'menu__item');
      button.id = 'admin-user-statistics';
      button.type = 'button';
      button.innerHTML = '<span class="menu__icon"><i class="fa-solid fa-chart-line"></i></span>' +
        '<span class="menu__text">Статистика пользователя</span>' +
        '<span class="menu__chev"><i class="fa-solid fa-chevron-right"></i></span>';
      button.addEventListener('click', () => {
        if (!hasAccess()) {
          setStatus(tx('Доступ разрешён только администраторам 2-го уровня и выше.', 'Access is available to level 2 administrators and above only.'), true);
          return;
        }
        document.querySelectorAll('.screen').forEach(screen => { screen.hidden = true; });
        const screen = document.getElementById('screen-user-statistics');
        if (screen) screen.hidden = false;
        setStatus('');
        const input = document.getElementById('user-statistics-query');
        if (input) input.focus();
        if (typeof refreshBackButton === 'function') refreshBackButton();
      });
      menu.append(group, button);
      // Keep the local command-chat setting directly below the statistics entry.
      const commandHeading = document.querySelector('.admin-main-command-heading');
      const kickButton = document.getElementById('admin-kick-user');
      const commandsButton = document.getElementById('admin-available-commands');
      const commandToggle = document.getElementById('admin-main-command-toggle-row');
      if (commandHeading && commandToggle) menu.append(commandHeading, kickButton, commandsButton, commandToggle);
    }

    const app = document.querySelector('main.app') || document.getElementById('app');
    if (app && !document.getElementById('screen-user-statistics')) {
      const screen = document.createElement('section');
      screen.id = 'screen-user-statistics';
      screen.className = 'screen';
      screen.hidden = true;
      screen.innerHTML = '<div class="stack">' +
        '<div class="screen__head"><button class="back-btn" id="back-from-user-statistics" type="button" aria-label="'+tx('Назад','Back')+'"><i class="fa-solid fa-arrow-left"></i></button><div class="screen__title">'+tx('Статистика пользователя','User statistics')+'</div></div>' +
        '<div class="card"><div class="field"><label class="field__label" for="user-statistics-query">'+tx('Telegram ID или токен пользователя','User Telegram ID or token')+'</label><input id="user-statistics-query" class="textarea" type="text" autocomplete="off" placeholder="'+tx('Введите Telegram ID или токен','Enter Telegram ID or token')+'"></div><button id="user-statistics-search" class="btn btn--primary btn--full" type="button" style="margin-top:12px">'+tx('Найти пользователя','Find user')+'</button><div id="user-statistics-status" class="hint" role="status" aria-live="polite" style="margin-top:10px"></div></div>' +
        '<div id="user-statistics-result" class="stack"></div>' +
        '</div>';
      app.appendChild(screen);
      screen.querySelector('#user-statistics-search').addEventListener('click', searchUser);
      screen.querySelector('#user-statistics-query').addEventListener('keydown', event => {
        if (event.key === 'Enter') searchUser();
      });
      screen.querySelector('#back-from-user-statistics').addEventListener('click', () => {
        screen.hidden = true;
        const adminScreen = document.getElementById('screen-admin');
        if (adminScreen) adminScreen.hidden = false;
        if (typeof refreshBackButton === 'function') refreshBackButton();
      });
    }
    if (typeof updateAdminLevelBadge === 'function') updateAdminLevelBadge();
    updateButtonVisibility();
  }

  function hookWarningApi() {
    const api = window.BuyAdWarnings;
    if (!api || api.__userStatisticsHooked) return;
    api.__userStatisticsHooked = true;
    if (typeof api.recordPunishmentIssued === 'function') {
      const original = api.recordPunishmentIssued;
      api.recordPunishmentIssued = function(kind, targetValue, reason, durationDays, expiresAt) {
        const result = original.apply(this, arguments);
        recordPunishment(kind, targetValue, reason, durationDays, expiresAt, false).catch(error => console.warn('User statistics punishment save failed:', error));
        return result;
      };
    }
    if (typeof api.recordPunishmentRemoved === 'function') {
      const original = api.recordPunishmentRemoved;
      api.recordPunishmentRemoved = function(kind, targetValue) {
        const result = original.apply(this, arguments);
        recordPunishment(kind, targetValue, '', null, '', true).catch(error => console.warn('User statistics punishment removal save failed:', error));
        return result;
      };
    }
    if (typeof api.recordAdminAction === 'function') {
      const original = api.recordAdminAction;
      api.recordAdminAction = function(action, details) {
        const result = original.apply(this, arguments);
        if (action === 'ip_banned' || action === 'ip_unbanned') {
          recordIpAdminAction(action, details || {}).catch(error => console.warn('User statistics IP punishment save failed:', error));
        }
        return result;
      };
    }
    if (typeof api.recordAdCreated === 'function') {
      const original = api.recordAdCreated;
      api.recordAdCreated = function(info) {
        const result = original.apply(this, arguments);
        const tgId = currentTelegramId();
        const token = currentToken();
        mutateArchive(archive => {
          const user = getOrCreateUser(archive, { telegramId: tgId, token, fallbackId: tgId ? '' : currentUserId() }).user;
          user.adCreatedCount = Number(user.adCreatedCount || 0) + 1;
          user.lastAdCreatedAt = nowIso();
        }, 'Record created advertisement').catch(error => console.warn('User statistics ad counter save failed:', error));
        return result;
      };
    }
  }

  function updateButtonVisibility() {
    const button = document.getElementById('admin-user-statistics');
    const group = document.getElementById('admin-user-statistics-group');
    const visible = hasAccess();
    if (button) button.hidden = !visible;
    if (group) group.hidden = !visible;
  }

  function install() {
    installStatisticsStyles();
    addScreenAndMenu();
    hookWarningApi();
    const rows = warningRows();
    if (rows.length) syncWarnings(rows).catch(error => console.warn('Warning archive sync failed:', error));
    if (localStorage.getItem('lang')) {
      recordLogin(false).catch(error => console.warn('User login archive save failed:', error));
    }
    window.addEventListener('buyad:admin2-config-loaded', event => {
      const warnings = event.detail && event.detail.UserWarnings;
      if (Array.isArray(warnings)) syncWarnings(warnings).catch(error => console.warn('Warning archive sync failed:', error));
      updateButtonVisibility();
    });
    window.addEventListener('buyad:user-warnings-updated', event => {
      const warnings = event.detail && event.detail.rows;
      if (Array.isArray(warnings)) syncWarnings(warnings).catch(error => console.warn('Warning archive sync failed:', error));
    });
    window.addEventListener('storage', updateButtonVisibility);
    updateButtonVisibility();
    window.addEventListener('buyad:language-changed', () => {
      const screen = document.getElementById('screen-user-statistics');
      const input = document.getElementById('user-statistics-query');
      if (screen && !screen.hidden && input && input.value.trim()) searchUser();
      const button = document.getElementById('admin-user-statistics');
      if (button) button.querySelector('.menu__text').textContent = tx('Статистика пользователя', 'User statistics');
      const group = document.getElementById('admin-user-statistics-group');
      if (group) group.textContent = tx('Пользователи', 'Users');
    });
  }

  async function getPunishmentHistoryByIdentifier(query) {
    if (!hasAccess()) throw new Error(tx('Просмотр списка наказаний доступен только администраторам с соответствующим правом.', 'Punishment history is available only to administrators with the required permission.'));
    const value = String(query || '').trim();
    if (!value) return null;
    const result = await readArchive();
    const found = findArchiveProfile(result.archive, value);
    if (!found) return null;
    const profile = { ...found.user };
    profile.telegramId = String(profile.telegramId || (/^\\d{4,}$/.test(value) ? value : ''));
    profile.tokens = Array.isArray(profile.tokens) ? profile.tokens.map(String) : [];
    profile.ipAddresses = Array.isArray(profile.ipAddresses) ? profile.ipAddresses.map(String) : [];
    if (!profile.telegramId && !/^\\d{4,}$/.test(value)) profile.tokens = Array.from(new Set([...profile.tokens, value]));
    return { profile, punishments: buildPunishmentHistory(profile) };
  }

  window.BuyAdUserStatistics = {
    recordLogin,
    recordPunishment,
    syncWarnings,
    updateButtonVisibility,
    searchUser,
    getProfileByIdentifier,
    getPunishmentHistoryByIdentifier
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})();