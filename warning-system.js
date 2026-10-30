/* BuyAd warnings and client-side audit UI.
 * IMPORTANT: this browser-only store is a development fallback, not a shared audit backend.
 * Warnings are stored centrally in admin2.js; audit logging is disabled.
 */
(() => {
  'use strict';

  const WARN_KEY = 'buyAdWarningsV2';
  const IP_HISTORY_KEY = 'buyAdUserIpHistoryV1';
  const LEGACY_WARN_KEY = 'buyAdWarningsV1';
  const USER_LOG_KEY = 'buyAdUserLogsV2';
  const ADMIN_LOG_KEY = 'buyAdAdminLogsV2';
  const MAX_LOG_ROWS = 10000;
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;
  let clientIp = '';
  let lastLoggedIp = '';

  const safeRead = key => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  };
  // Local cache keeps the existing synchronous UI responsive. The canonical
  // records are synchronized with the repository via the existing token broker.
  let cloudReady = false;
  let cloudTokenPromise = null;
  const cloudQueues = new Map();
  const getGitHubToken = () => {
    if (!cloudTokenPromise) cloudTokenPromise = fetch('https://script.google.com/macros/s/AKfycbzTDNI5q2qAUWHoXsm5KJWlnrv0ivvK5LI6Gbevp9A-u31L48D0wZbWuDnD-X52vo-MOA/exec', { cache: 'no-store' })
      .then(response => { if (!response.ok) throw new Error('Не удалось получить GitHub API token'); return response.json(); })
      .then(data => { if (!data.token) throw new Error('GitHub API token отсутствует'); return data.token; });
    return cloudTokenPromise;
  };
  const githubGet = async path => {
    const token = await getGitHubToken();
    const response = await fetch('https://api.github.com/repos/hello23445/buyAd/contents/' + path, {
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token },
      cache: 'no-store'
    });
    if (!response.ok) throw new Error('GitHub read failed for ' + path + ': ' + response.status);
    const file = await response.json();
    const decoded = decodeURIComponent(escape(atob(String(file.content || '').replace(/\s/g, ''))));
    return { token, sha: file.sha, content: decoded };
  };
  const githubPut = async (path, content, message) => {
    const token = await getGitHubToken();
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await githubGet(path);
      const response = await fetch('https://api.github.com/repos/hello23445/buyAd/contents/' + path, {
        method: 'PUT',
        headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, content: btoa(unescape(encodeURIComponent(content))), sha: current.sha })
      });
      if (response.ok) return response.json();
      if (response.status !== 409 && response.status !== 422) throw new Error('GitHub write failed for ' + path + ': ' + response.status);
    }
    throw new Error('Не удалось сохранить ' + path + ': файл изменялся одновременно несколько раз.');
  };
  let cloudWarningsLoaded = false;
  let cloudIpHistoryLoaded = false;
  // All writes to admin2.js share one queue because warnings and IP history
  // live in the same file. Re-read and rebuild the content on every retry.
  let cloudWriteQueue = Promise.resolve();
  const persistArray = (exportName, rows, message) => {
    const run = async () => {
      if (exportName === 'UserWarnings' && !cloudWarningsLoaded) throw new Error('Данные предупреждений ещё не загружены из GitHub.');
      if (exportName === 'UserIpHistory' && !cloudIpHistoryLoaded) throw new Error('История IP ещё не загружена из GitHub.');
      const serialized = JSON.stringify(rows);
      const pattern = new RegExp('((?:export\\s+)?(?:let|const|var)\\s+' + exportName + '\\s*=\\s*)(\\[[\\s\\S]*?\\])(\\s*;)', 'm');
      for (let attempt = 0; attempt < 3; attempt++) {
        const current = await githubGet('admin2.js');
        if (!pattern.test(current.content)) throw new Error('В admin2.js не найден массив ' + exportName);
        const updated = current.content.replace(pattern, (_, before, _old, after) => before + serialized + after);
        const token = await getGitHubToken();
        const response = await fetch('https://api.github.com/repos/hello23445/buyAd/contents/admin2.js', {
          method: 'PUT',
          headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ message, content: btoa(unescape(encodeURIComponent(updated))), sha: current.sha })
        });
        if (response.ok) return response.json();
        if (response.status !== 409 && response.status !== 422) {
          const detail = await response.text().catch(() => '');
          throw new Error('GitHub API вернул ' + response.status + (detail ? ': ' + detail.slice(0, 250) : ''));
        }
      }
      throw new Error('Файл admin2.js постоянно меняется; не удалось сохранить данные после 3 попыток.');
    };
    cloudWriteQueue = cloudWriteQueue.catch(() => {}).then(run);
    return cloudWriteQueue;
  };
  const persistWarnings = rows => persistArray('UserWarnings', rows, 'Save user warnings');
  const persistIpHistory = rows => persistArray('UserIpHistory', rows, 'Save user IP history');
  const safeWrite = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn('BuyAd local storage failed:', error);
      return false;
    }
  };
    async function loadCloudWarnings() {
    try {
      const current = await githubGet('admin2.js');
      const match = current.content.match(/(?:export\s+)?const\s+UserWarnings\s*=\s*(\[[\s\S]*?\])\s*;/);
      const remoteWarnings = match ? JSON.parse(match[1]) : [];
      const ipMatch = current.content.match(/(?:export\s+)?const\s+UserIpHistory\s*=\s*(\[[\s\S]*?\])\s*;/);
      const remoteIpHistory = ipMatch ? JSON.parse(ipMatch[1]) : [];
      safeWriteCache(WARN_KEY, Array.isArray(remoteWarnings) ? remoteWarnings : []);
      safeWriteCache(IP_HISTORY_KEY, Array.isArray(remoteIpHistory) ? remoteIpHistory : []);
      cloudWarningsLoaded = true;
      cloudIpHistoryLoaded = true;
      refresh();
    } catch (error) { console.error('Не удалось загрузить предупреждения из GitHub:', error); }
  }
  const safeWriteCache = (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (_) { return false; }
  };
  const currentAdmin = () => {
    try { return typeof getCurrentAdmin === 'function' ? getCurrentAdmin() : null; }
    catch (_) { return null; }
  };
  const currentToken = () => String(localStorage.getItem('get_UserToken') || localStorage.getItem('token') || localStorage.getItem('userToken') || '');
  const currentTelegramId = () => String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '');
  const currentLevel = () => Number(currentAdmin()?.admin_level || 0);
  const localDate = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  };
  const formatDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU');
  };
  const formatDateTime = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU');
  };
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const adminName = () => {
    const admin = currentAdmin();
    if (!admin) return '';
    try {
      if (typeof getAdminDisplayName === 'function') return String(getAdminDisplayName(admin, 'ban') || '');
    } catch (_) {}
    return String(admin.admin_name || ('Администратор ' + currentLevel() + ' уровня'));
  };
  const adminNameHidden = () => !!currentAdmin() && !adminName();
  const actor = () => {
    const admin = currentAdmin();
    return {
      adminToken: admin?.admin_token || '',
      adminTelegramId: currentTelegramId(),
      adminName: adminName(),
      adminNameHidden: adminNameHidden(),
      adminLevel: currentLevel()
    };
  };
  const targetFromInput = value => {
    const normalized = String(value || '').trim();
    if (!normalized) return null;
    return /^\d{4,}$/.test(normalized) ? { telegramId: normalized } : { token: normalized };
  };
  const targetMatches = (row, target) =>
    !!target && ((target.token && row.token === target.token) || (target.telegramId && row.telegramId === target.telegramId));
  const warnings = () => {
    const current = safeRead(WARN_KEY);
    if (current.length) return current;
    const legacy = safeRead(LEGACY_WARN_KEY);
    if (legacy.length) {
      if (safeWrite(WARN_KEY, legacy)) {
        try { localStorage.removeItem(LEGACY_WARN_KEY); } catch (_) {}
      }
      return legacy;
    }
    return [];
  };
  const writeWarnings = rows => {
    if (!safeWrite(WARN_KEY, rows)) return Promise.reject(new Error('Не удалось обновить локальный кэш предупреждений.'));
    return persistWarnings(rows);
  };
    const readLogRows = () => [];
  const logUser = () => {};
  const logAdmin = () => {};
  const warningsFor = (token, telegramId) =>
    warnings().filter(row => (token && row.token === token) || (telegramId && row.telegramId === telegramId))
      .sort((a, b) => Date.parse(a.issuedAt) - Date.parse(b.issuedAt));

  function showMessage(title, message) {
    const pre = document.createElement('pre');
    pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:55vh;overflow:auto;margin:0;font:inherit;';
    pre.textContent = String(message || '');
    if (typeof openModal === 'function') openModal(title, pre, [{ text: 'OK' }]);
    else alert(title + '\n\n' + message);
  }

  function field(parent, labelText, options = {}) {
    const wrap = document.createElement('label');
    wrap.className = 'admin-create-field';
    wrap.style.display = 'grid';
    wrap.style.gap = '6px';
    wrap.style.marginBottom = '10px';
    const label = document.createElement('span');
    label.textContent = labelText;
    label.style.fontWeight = '600';
    wrap.appendChild(label);
    const input = document.createElement(options.multiline ? 'textarea' : 'input');
    if (!options.multiline) input.type = options.type || 'text';
    if (options.multiline) input.rows = options.rows || 3;
    input.placeholder = options.placeholder || '';
    input.autocomplete = 'off';
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:0.75rem;border:1px solid rgba(128,128,128,.45);border-radius:10px;font:inherit;background:transparent;color:inherit;';
    if (options.required) input.required = true;
    if (options.value) input.value = options.value;
    wrap.appendChild(input);
    parent.appendChild(wrap);
    return input;
  }

  function openForm(title, build, submit, submitText = 'Посмотреть логи') {
    const body = document.createElement('div');
    body.style.display = 'grid';
    body.style.gap = '2px';
    const controls = build(body);
    const lang = localStorage.getItem('lang') || 'ru';
    if (typeof openModal !== 'function') {
      const value = prompt(title);
      if (value) submit({ value });
      return;
    }
    openModal(title, body, [
      {
        text: submitText,
        onClick: () => {
          Promise.resolve().then(() => submit(controls)).then(result => {
            if (result && result.error) {
              showMessage('Не удалось выполнить действие', result.error);
            } else if (result && result.message) {
              showMessage(result.title || 'Готово', result.message);
            }
          }).catch(error => {
            showMessage('Не удалось сохранить в GitHub', error && error.message ? error.message : String(error));
          });
        }
      },
      { text: lang === 'ru' ? 'Отмена' : 'Cancel', class: 'btn btn--ghost' }
    ]);
  }

  function scheduleNewWarning(rows, warning) {
    const group = rows.filter(row => targetMatches(row, warning));
    group.sort((a, b) => Date.parse(a.issuedAt) - Date.parse(b.issuedAt));
    const last = group[group.length - 1];
    const base = Date.now() + TWO_DAYS;
    const next = last ? Math.max(base, Date.parse(last.removeAt || last.issuedAt) + TWO_DAYS) : base;
    warning.removeAt = new Date(next).toISOString();
  }

  function cleanupWarnings() {
    const rows = warnings();
    const now = Date.now();
    const groups = new Map();
    rows.forEach(row => {
      const key = row.token ? 't:' + row.token : 'id:' + String(row.telegramId || '');
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    const removeIds = new Set();
    let changed = false;

    for (const group of groups.values()) {
      group.sort((a, b) => Date.parse(a.issuedAt) - Date.parse(b.issuedAt));
      const lock = group.filter(row => row.lockUntil).sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))[0];
      if (lock) {
        const lockTime = Date.parse(lock.lockUntil);
        if (Number.isFinite(lockTime) && lockTime <= now) {
          group.forEach(row => removeIds.add(row.id));
          const target = { token: lock.token || '', telegramId: lock.telegramId || '' };
          logUser(target, 'warnings_cleared_after_lock', {
            reason: 'Истекла блокировка за 3/3 предупреждений',
            removedCount: group.length,
            unlockedAt: new Date().toISOString()
          });
          logAdmin('automatic_unlock_and_clear', {
            targetToken: target.token,
            targetTelegramId: target.telegramId,
            reason: 'Истекла блокировка за 3/3 предупреждений',
            removedCount: group.length
          });
          changed = true;
        }
        continue;
      }

      group.forEach(row => {
        if (!row.removeAt) {
          row.removeAt = new Date(Date.parse(row.issuedAt) + TWO_DAYS).toISOString();
          changed = true;
        }
      });
      for (const row of group) {
        const removeAt = Date.parse(row.removeAt);
        if (!Number.isFinite(removeAt) || removeAt > now) continue;
        removeIds.add(row.id);
        const target = { token: row.token || '', telegramId: row.telegramId || '' };
        logUser(target, 'warning_removed_automatically', {
          warningId: row.id,
          reason: 'Системное снятие предупреждения через 2 дня',
          remainingWarnings: Math.max(0, group.filter(item => !removeIds.has(item.id)).length - 1),
          issuedAt: row.issuedAt,
          scheduledRemovalAt: row.removeAt
        });
        logAdmin('warning_removed_automatically', {
          targetToken: target.token,
          targetTelegramId: target.telegramId,
          reason: 'Системное снятие предупреждения через 2 дня',
          warningId: row.id
        });
        changed = true;
      }
    }

    if (removeIds.size) {
      writeWarnings(rows.filter(row => !removeIds.has(row.id))).catch(error => console.error('Не удалось сохранить автоматическое снятие варнов в GitHub:', error));
    } else if (changed) {
      writeWarnings(rows).catch(error => console.error('Не удалось сохранить обновление варнов в GitHub:', error));
    }
  }

  function activeLock(rows) {
    return rows.filter(row => row.lockUntil && Date.parse(row.lockUntil) > Date.now())
      .sort((a, b) => Date.parse(b.issuedAt) - Date.parse(a.issuedAt))[0] || null;
  }

  function showWarningLock(lock) {
    const screen = document.getElementById('screen-blocked');
    if (!screen) return;
    document.querySelectorAll('.screen').forEach(item => { item.hidden = item !== screen; });
    screen.hidden = false;
    screen.dataset.warningLock = 'true';
    const reason = document.getElementById('blocked-reason');
    const duration = document.getElementById('blocked-duration');
    const byAdmin = document.getElementById('blocked-by-admin');
    const adminLabel = lock.adminNameHidden || !lock.adminName ? 'Скрыт' : lock.adminName;
    if (reason) {
      reason.hidden = false;
      reason.textContent = 'Причина блокировки: 3/3 предупреждений. Причина выдачи предупреждения: ' +
        (lock.reason || 'Не указана') + '. Дата выдачи: ' + formatDate(lock.issuedAt) + '.';
    }
    if (duration) {
      duration.hidden = false;
      duration.textContent = 'Блокировка на 5 дней. Разблокировка: ' + formatDateTime(lock.lockUntil) + '.';
    }
    if (byAdmin) {
      byAdmin.hidden = false;
      byAdmin.textContent = 'Выдал: ' + adminLabel;
    }
    const userToken = document.getElementById('user-token-blocked');
    if (userToken) userToken.textContent = currentToken() || currentTelegramId() || '—';
  }

  function applyPlatformRestrictions(count) {
    const blocked = count >= 1;
    const denied = value => {
      const text = String(value || '').toLowerCase();
      return text.includes("канал 'создать никнейм'") ||
        text.includes("бот 'создать никнейм'") ||
        text.includes("мини-приложение 'сгенерировать фото'");
    };
    document.querySelectorAll('#platform-buttons .seg').forEach(button => {
      const shouldBlock = blocked && denied(button.dataset.value || button.textContent);
      button.disabled = shouldBlock;
      if (shouldBlock) {
        button.setAttribute('aria-disabled', 'true');
        button.title = 'Недоступно при наличии предупреждения';
      } else {
        button.removeAttribute('aria-disabled');
        if (button.title === 'Недоступно при наличии предупреждения') button.removeAttribute('title');
      }
    });
    document.querySelectorAll('.platform-row').forEach(row => {
      const shouldBlock = blocked && denied(row.dataset.value || row.textContent);
      row.setAttribute('aria-disabled', shouldBlock ? 'true' : 'false');
      row.classList.toggle('platform-row--warning-blocked', shouldBlock);
      row.title = shouldBlock ? 'Недоступно при наличии предупреждения' : '';
    });
  }

  const dailyAdKey = () => 'buyAd_warningAdCreated_' + (currentToken() || currentTelegramId());
  const dailyAdUsed = () => localStorage.getItem(dailyAdKey()) === localDate();
  function setWarningDisabled(element, disabled) {
    if (!element) return;
    if (disabled) {
      if (element.dataset.warningDisabled !== 'true') {
        element.dataset.warningWasDisabled = element.disabled ? 'true' : 'false';
      }
      element.disabled = true;
      element.dataset.warningDisabled = 'true';
    } else if (element.dataset.warningDisabled === 'true') {
      element.disabled = element.dataset.warningWasDisabled === 'true';
      delete element.dataset.warningDisabled;
      delete element.dataset.warningWasDisabled;
    }
  }

  function refresh() {
    cleanupWarnings();
    const rows = warningsFor(currentToken(), currentTelegramId());
    const button = document.getElementById('nav-warnings');
    if (button) button.hidden = rows.length === 0;
    applyPlatformRestrictions(rows.length);
    const lock = activeLock(rows);
    const create = document.getElementById('nav-create');
    const createAd = document.getElementById('btn-create-ad');
    if (lock) {
      showWarningLock(lock);
      setWarningDisabled(create, true);
      setWarningDisabled(createAd, true);
      return;
    }
    const blockedByDailyLimit = rows.length >= 2 && dailyAdUsed();
    setWarningDisabled(create, blockedByDailyLimit);
    setWarningDisabled(createAd, blockedByDailyLimit);
    if (create) create.title = blockedByDailyLimit ? 'При 2/3 предупреждениях доступно одно создание рекламы в день' : '';
    const blockedScreen = document.getElementById('screen-blocked');
    if (blockedScreen?.dataset.warningLock === 'true') {
      delete blockedScreen.dataset.warningLock;
      if (typeof showMainMenu === 'function') showMainMenu();
    }
  }

  async function issueWarning() {
    const admin = currentAdmin();
    if (!cloudWarningsLoaded) return { error: 'Подождите, пока загрузятся данные предупреждений из GitHub.' };
    if (!admin || currentLevel() < 2) return { error: 'Выдавать предупреждения могут только администраторы 2-го уровня и выше.' };
    const targetValue = arguments[0];
    const reason = String(arguments[1] || '').trim();
    const target = targetFromInput(targetValue);
    if (!target) return { error: 'Введите токен пользователя или Telegram ID.' };

    cleanupWarnings();
    const rows = warnings();
    const originalRows = rows.map(row => ({ ...row }));
    const current = rows.filter(row => targetMatches(row, target));
    if (current.length >= 3 || current.some(row => row.lockUntil)) {
      return { error: 'У пользователя уже 3/3 предупреждения. Новое предупреждение выдать нельзя.' };
    }
    const limits = { 2: 2, 3: 4, 4: 7, 5: Infinity };
    const limit = limits[currentLevel()] || 0;
    const adminId = admin.admin_token || currentToken();
    const today = localDate();
    const issuedToday = rows.filter(row => row.adminToken === adminId && localDate(new Date(row.issuedAt)) === today).length;
    if (issuedToday >= limit) return { error: 'Достигнут дневной лимит выдачи предупреждений: ' + limit + '.' };

    const now = new Date();
    const count = current.length + 1;
    const hidden = adminNameHidden();
    const warning = {
      id: 'warn_' + now.getTime() + '_' + Math.random().toString(36).slice(2, 7),
      ...target,
      reason,
      issuedAt: now.toISOString(),
      adminToken: adminId,
      adminTelegramId: currentTelegramId(),
      adminName: hidden ? '' : adminName(),
      adminNameHidden: hidden,
      count
    };
    scheduleNewWarning(rows, warning);
    rows.push(warning);

    if (count === 3) {
      const lockUntil = new Date(now.getTime() + FIVE_DAYS).toISOString();
      rows.filter(row => targetMatches(row, target)).forEach(row => {
        row.lockUntil = lockUntil;
        row.removeAt = lockUntil;
      });
    }
    try { await writeWarnings(rows); } catch (error) { safeWrite(WARN_KEY, originalRows); return { error: 'Варн не сохранён в GitHub: ' + (error.message || error) }; }
    const details = {
      targetToken: target.token || '',
      targetTelegramId: target.telegramId || '',
      reason: reason || 'Не указана',
      durationDays: count === 3 ? 5 : 2,
      warningCount: count,
      warningId: warning.id,
      adminNameHidden: hidden
    };
    logAdmin('warning_issued', details);
    logUser(target, 'warning_issued', {
      reason: reason || 'Не указана',
      issuedAt: warning.issuedAt,
      removeAt: warning.removeAt,
      adminName: warning.adminName,
      adminNameHidden: hidden,
      adminToken: adminId,
      adminTelegramId: currentTelegramId(),
      warningCount: count,
      durationDays: count === 3 ? 5 : 2,
      lockUntil: warning.lockUntil || ''
    });
    refresh();
    return { message: count === 3
      ? 'Выдано предупреждение 3/3. Аккаунт заблокирован на 5 дней.'
      : 'Предупреждение выдано: ' + count + '/3.' };
  }

  async function removeWarnings(targetValue) {
    if (!cloudWarningsLoaded) return { error: 'Подождите, пока загрузятся данные предупреждений из GitHub.' };
    if (currentLevel() !== 5) return { error: 'Снимать предупреждения может только администратор 5-го уровня.' };
    const target = targetFromInput(targetValue);
    if (!target) return { error: 'Введите токен пользователя или Telegram ID.' };
    const rows = warnings();
    const originalRows = rows.map(row => ({ ...row }));
    const removed = rows.filter(row => targetMatches(row, target));
    if (!removed.length) return { error: 'У пользователя нет предупреждений.' };
    try { await writeWarnings(rows.filter(row => !removed.includes(row))); } catch (error) { safeWrite(WARN_KEY, originalRows); return { error: 'Снятие варнов не сохранено в GitHub: ' + (error.message || error) }; }
    const details = {
      targetToken: target.token || '',
      targetTelegramId: target.telegramId || '',
      removedCount: removed.length,
      removedWarningIds: removed.map(row => row.id),
      reason: removed.some(row => row.lockUntil) ? 'Снятие варнов и разблокировка аккаунта 3/3' : 'Ручное снятие предупреждений'
    };
    logAdmin('warnings_removed', details);
    logUser(target, 'warnings_removed', {
      removedCount: removed.length,
      removedWarningIds: details.removedWarningIds,
      reason: details.reason,
      adminName: adminName(),
      adminNameHidden: adminNameHidden(),
      unlocked: removed.some(row => row.lockUntil)
    });
    refresh();
    return { message: removed.some(row => row.lockUntil)
      ? 'Все предупреждения сняты. Блокировка 3/3 отменена.'
      : 'Снято предупреждений: ' + removed.length + '.' };
  }

  function openIssueWarningModal() {
    if (currentLevel() < 2) return showMessage('Недостаточно прав', 'Действие доступно с 2-го уровня.');
    openForm('Выдать предупреждение (warn)', body => ({
      target: field(body, 'Telegram ID или токен пользователя', { placeholder: 'Введите Telegram ID или токен', required: true }),
      reason: field(body, 'Причина (необязательно)', { multiline: true, placeholder: 'Укажите причину, если необходимо', rows: 3 })
    }), controls => {
      const result = issueWarning(controls.target.value, controls.reason.value);
      if (!result.error) refresh();
      return result;
    }, 'Выдать warn');
  }

  function openRemoveWarningsModal() {
    if (currentLevel() !== 5) return showMessage('Недостаточно прав', 'Снимать предупреждения может только администратор 5-го уровня.');
    openForm('Снять предупреждения', body => ({
      target: field(body, 'Telegram ID или токен пользователя', { placeholder: 'Введите Telegram ID или токен', required: true })
    }), controls => removeWarnings(controls.target.value), 'Снять предупреждения');
  }

  function dateFields(body) {
    const from = field(body, 'Дата начала', { type: 'date' });
    const to = field(body, 'Дата окончания', { type: 'date' });
    return { from, to };
  }
  const withinDates = (timestamp, from, to) => {
    const day = localDate(new Date(timestamp));
    return (!from || day >= from) && (!to || day <= to);
  };
  const formatLog = row => {
    const timestamp = formatDateTime(row.timestamp);
    return timestamp + '\n' + JSON.stringify(row, null, 2);
  };
  function openUserLogModal() {
    if (currentLevel() < 5) return showMessage('Недостаточно прав', 'Просмотр журналов пользователей доступен только администраторам 5-го уровня.');
    openForm('Смотреть лог пользователя', body => ({
      target: field(body, 'Токен или Telegram ID пользователя', { placeholder: 'Введите токен или Telegram ID', required: true }),
      ...dateFields(body)
    }), controls => {
      const target = targetFromInput(controls.target.value);
      if (!target) return { error: 'Введите токен или Telegram ID.' };
      logAdmin('user_log_viewed', { targetToken: target.token || '', targetTelegramId: target.telegramId || '' });
      const rows = readLogRows(USER_LOG_KEY).filter(row =>
        targetMatches(row, target) && withinDates(row.timestamp, controls.from.value, controls.to.value)
      );
      return { title: 'Лог пользователя', message: rows.length
        ? rows.map(formatLog).join('\n\n────────────────────\n\n')
        : 'За выбранный период записей нет.' };
    }, 'Посмотреть логи');
  }
  function openAdminLogModal() {
    if (currentLevel() < 5) return showMessage('Недостаточно прав', 'Просмотр журнала администраторов доступен только администраторам 5-го уровня.');
    openForm('Смотреть лог администратора', body => ({
      target: field(body, 'Токен или Telegram ID администратора', { placeholder: 'Введите токен или Telegram ID', required: true }),
      ...dateFields(body)
    }), controls => {
      const value = String(controls.target.value || '').trim();
      if (!value) return { error: 'Введите токен или Telegram ID администратора.' };
      logAdmin('admin_log_viewed', { details: { searchedAdmin: value } });
      const rows = readLogRows(ADMIN_LOG_KEY).filter(row =>
        (row.adminToken === value || row.adminTelegramId === value) &&
        withinDates(row.timestamp, controls.from.value, controls.to.value)
      );
      return { title: 'Лог администратора', message: rows.length
        ? rows.map(formatLog).join('\n\n────────────────────\n\n')
        : 'За выбранный период записей нет.' };
    }, 'Посмотреть логи');
  }
  function openIpSearchModal() {
    if (currentLevel() < 4) return showMessage('Недостаточно прав', 'Поиск пользователей по IP доступен администраторам 4-го уровня и выше.');
    openForm('Найти пользователя по IP', body => ({
      ip: field(body, 'IP-адрес', { placeholder: 'Например, 192.0.2.1', required: true })
    }), controls => {
      const ip = String(controls.ip.value || '').trim();
      if (!ip || !/^[0-9a-fA-F:.]{3,45}$/.test(ip)) return { error: 'Введите корректный IPv4 или IPv6 адрес.' };
      if (!cloudIpHistoryLoaded) return { error: 'История IP ещё загружается из GitHub. Попробуйте ещё раз через несколько секунд.' };
      const matches = safeRead(IP_HISTORY_KEY).filter(row => row.ip === ip);
      const users = new Map();
      matches.forEach(row => {
        const key = (row.token || '') + '|' + (row.telegramId || '');
        users.set(key, { token: row.token || '—', telegramId: row.telegramId || '—', lastSeen: row.lastSeen || '' });
      });
      const result = Array.from(users.values());
      return { title: 'Результат поиска по IP', message: result.length
        ? 'Найдено пользователей: ' + result.length + '\n\n' + result.map((item, index) =>
          (index + 1) + '. Токен: ' + item.token + '\n   Telegram ID: ' + item.telegramId
        ).join('\n\n')
        : 'Совпадений по этому IP не найдено в общей истории.' };
    }, 'Найти');
  }

  function recordAdminAction(action, details = {}) {
    logAdmin(action, details);
    const target = {
      token: details.targetToken || '',
      telegramId: details.targetTelegramId || ''
    };
    if (target.token || target.telegramId) {
      logUser(target, 'admin_action', {
        action,
        reason: details.reason || '',
        durationDays: details.durationDays == null ? null : details.durationDays,
        adId: details.adId || '',
        decision: details.decision || '',
        adminName: adminName(),
        adminNameHidden: adminNameHidden(),
        adminToken: actor().adminToken,
        adminTelegramId: actor().adminTelegramId,
        details
      });
    }
  }

  function recordPunishmentIssued(kind, targetValue, reason, durationDays, expiresAt) {
    const target = targetFromInput(targetValue) || {};
    const details = {
      targetToken: target.token || '',
      targetTelegramId: target.telegramId || '',
      targetIp: kind === 'ip_ban' ? String(targetValue || '') : '',
      reason: reason || 'Не указана',
      durationDays: durationDays == null ? null : durationDays,
      expiresAt: expiresAt || '',
      punishment: kind
    };
    recordAdminAction('punishment_issued', details);
    if (target.token || target.telegramId) {
      logUser(target, 'punishment_issued', {
        punishment: kind,
        reason: reason || 'Не указана',
        durationDays: durationDays == null ? null : durationDays,
        expiresAt: expiresAt || '',
        adminName: adminName(),
        adminNameHidden: adminNameHidden(),
        adminToken: actor().adminToken,
        adminTelegramId: actor().adminTelegramId
      });
    }
  }
  function recordPunishmentRemoved(kind, targetValue) {
    const target = targetFromInput(targetValue) || {};
    const details = {
      targetToken: target.token || '',
      targetTelegramId: target.telegramId || '',
      targetIp: kind === 'ip_ban' ? String(targetValue || '') : '',
      punishment: kind
    };
    recordAdminAction('punishment_removed', details);
    if (target.token || target.telegramId) {
      logUser(target, 'punishment_removed', {
        punishment: kind,
        adminName: adminName(),
        adminNameHidden: adminNameHidden(),
        adminToken: actor().adminToken,
        adminTelegramId: actor().adminTelegramId
      });
    }
  }

  function recordAdCreated(info = {}) {
    localStorage.setItem(dailyAdKey(), localDate());
    logUser({ token: currentToken(), telegramId: currentTelegramId() }, 'ad_created', {
      adId: info.adId || '',
      platform: info.platform || '',
      createdAt: new Date().toISOString()
    });
    refresh();
  }

  function recordIp(ip) {
    const normalized = String(ip || '').trim();
    if (!normalized || normalized === lastLoggedIp) return;
    clientIp = normalized;
    lastLoggedIp = normalized;
    const token = currentToken();
    const telegramId = currentTelegramId();
    if (!token && !telegramId) return;
    const rows = safeRead(IP_HISTORY_KEY);
    const key = row => (row.token || '') + '|' + (row.telegramId || '') + '|' + row.ip;
    const record = { ip: normalized, token, telegramId, lastSeen: new Date().toISOString() };
    const existing = rows.findIndex(row => key(row) === key(record));
    if (existing >= 0) rows[existing] = record;
    else rows.push(record);
    const limitedRows = rows.slice(-10000);
    safeWrite(IP_HISTORY_KEY, limitedRows);
    persistIpHistory(limitedRows).catch(error => console.error('Не удалось сохранить историю IP в GitHub:', error));
  }
  async function loadClientIp() {
    try {
      if (typeof getClientIp === 'function') {
        const ip = await getClientIp();
        if (ip) recordIp(ip);
        return;
      }
      const response = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        recordIp(data.ip || '');
      }
    } catch (_) {}
  }

  function addAdminButtons() {
    const menu = document.querySelector('#screen-admin .menu');
    if (!menu || document.getElementById('warn-issue')) return;
    const group = document.createElement('div');
    group.className = 'menu__group';
    group.textContent = 'Предупреждения';
    group.id = 'warn-tools-group';
    group.dataset.minLevel = '2';
    menu.appendChild(group);

    const makeButton = (id, text, iconName, onClick, minLevel) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.id = id;
      button.className = 'menu__item';
      button.innerHTML = '<span class="menu__icon"><i class="fa-solid ' + iconName + '"></i></span>' +
        '<span class="menu__text">' + escapeHtml(text) + '</span>' +
        '<span class="menu__chev"><i class="fa-solid fa-chevron-right"></i></span>';
      button.addEventListener('click', onClick);
      button.dataset.minLevel = String(minLevel);
      menu.appendChild(button);
      return button;
    };
    makeButton('warn-issue', 'Выдать предупреждение (warn)', 'fa-triangle-exclamation', openIssueWarningModal, 2);
    makeButton('warn-remove', 'Снять предупреждение', 'fa-circle-check', openRemoveWarningsModal, 5);
    makeButton('warn-ip-search', 'Найти пользователя по IP', 'fa-magnifying-glass-location', openIpSearchModal, 4);
  }

  function updateAdminButtonVisibility() {
    const level = currentLevel();
    document.querySelectorAll('#warn-tools-group, #screen-admin [data-min-level]').forEach(element => {
      element.hidden = level < Number(element.dataset.minLevel || 1);
    });
  }

  function install() {
    const crystals = document.getElementById('nav-crystals');
    if (crystals && !document.getElementById('nav-warnings')) {
      const button = document.createElement('button');
      button.id = 'nav-warnings';
      button.type = 'button';
      button.className = crystals.className;
      button.hidden = true;
      button.innerHTML = '<span class="menu__icon"><i class="fa-solid fa-triangle-exclamation"></i></span>' +
        '<span class="menu__text">Список предупреждений</span>' +
        '<span class="menu__chev"><i class="fa-solid fa-chevron-right"></i></span>';
      crystals.insertAdjacentElement('afterend', button);
      button.addEventListener('click', () => {
        const rows = warningsFor(currentToken(), currentTelegramId());
        const text = rows.map((row, index) => {
          const name = row.adminNameHidden || !row.adminName ? 'Скрыто' : row.adminName;
          return 'Предупреждение ' + (index + 1) +
            '\nВыдано: ' + formatDate(row.issuedAt) +
            '\nСнятие в: ' + formatDate(row.removeAt) +
            '\nПричина: ' + (row.reason || 'Не указана') +
            '\nВыдано кем: ' + name;
        }).join('\n\n');
        showMessage('Список предупреждений', text || 'Предупреждений нет.');
      });
    }
    addAdminButtons();
    updateAdminButtonVisibility();
    cleanupWarnings();
    refresh();
    loadCloudWarnings();
    loadClientIp();
  }

  document.addEventListener('click', event => {
    const platformRow = event.target.closest('.platform-row');
    const rows = warningsFor(currentToken(), currentTelegramId());
    const blockedPlatformNames = [
      "канал 'создать никнейм'",
      "бот 'создать никнейм'",
      "мини-приложение 'сгенерировать фото'"
    ];
    if (platformRow && rows.length >= 1) {
      const platform = String(platformRow.dataset.value || platformRow.textContent || '').toLowerCase();
      if (blockedPlatformNames.some(name => platform.includes(name))) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showMessage('Функция недоступна', 'Эта площадка заблокирована при наличии предупреждения.');
        return;
      }
    }

    const button = event.target.closest('button,[role="button"]');
    if (!button) return;
    const lock = activeLock(rows);
    if (lock && !['btn-support', 'btn-copy-token-blocked'].includes(button.id)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    const platformValue = button.dataset?.value || button.textContent || '';
    if (rows.length >= 1 && (
      String(platformValue).toLowerCase().includes("бот 'создать никнейм'") ||
      String(platformValue).toLowerCase().includes("канал 'создать никнейм'") ||
      String(platformValue).toLowerCase().includes("мини-приложение 'сгенерировать фото'")
    )) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showMessage('Функция недоступна', 'Эта площадка заблокирована при наличии предупреждения.');
      return;
    }
    const createAction = button.id === 'nav-create' || button.id === 'btn-create-ad';
    if (createAction && rows.length >= 2 && dailyAdUsed()) {
      event.preventDefault();
      event.stopImmediatePropagation();
      showMessage('Лимит создания рекламы', 'При 2/3 предупреждениях можно создать только одну рекламу в день.');
      return;
    }

  }, true);

  window.BuyAdWarnings = {
    warningsFor,
    refresh,
    recordAdminAction,
    recordPunishmentIssued,
    recordPunishmentRemoved,
    recordAdCreated,
    recordIp,
    cleanupWarnings
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
  setInterval(() => {
    cleanupWarnings();
    refresh();
    updateAdminButtonVisibility();
  }, 60000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      cleanupWarnings();
      refresh();
    }
  });
})();