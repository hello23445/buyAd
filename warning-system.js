/* BuyAd warnings and client-side audit UI.
 * IMPORTANT: this browser-only store is a development fallback, not a shared audit backend.
 * Warnings are stored centrally in admin2.js; audit logging is disabled.
 */
(() => {
  'use strict';

  const WARN_KEY = 'buyAdWarningsV2';
  const WARN_HIDE_NAME_KEY = 'buyAdHideWarningIssuerName';
  const LEGACY_WARN_KEY = 'buyAdWarningsV1';
  const USER_LOG_KEY = 'buyAdUserLogsV2';
  const ADMIN_LOG_KEY = 'buyAdAdminLogsV2';
  const MAX_LOG_ROWS = 10000;
  const TWO_DAYS = 2 * 24 * 60 * 60 * 1000;
  const FIVE_DAYS = 5 * 24 * 60 * 60 * 1000;

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
  let cloudUserLogsLoaded = false;
  // Warning writes are serialized to avoid conflicting GitHub updates.
  let cloudWriteQueue = Promise.resolve();
  const persistArray = (exportName, rows, message) => {
    const run = async () => {
      if (exportName === 'UserWarnings' && !cloudWarningsLoaded) throw new Error('Данные предупреждений ещё не загружены из GitHub.');
      if (exportName === 'UserLogs' && !cloudUserLogsLoaded) throw new Error('Журнал пользователей ещё не загружен из GitHub.');
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
  const persistUserLogs = rows => persistArray('UserLogs', rows, 'Record IP in user log');
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
      safeWriteCache(WARN_KEY, Array.isArray(remoteWarnings) ? remoteWarnings : []);
      cloudWarningsLoaded = true;
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
  const currentLang = () => localStorage.getItem('lang') === 'en' ? 'en' : 'ru';
  const tr = (key, fallbackRu, fallbackEn) => {
    const lang = currentLang();
    return (typeof i18n !== 'undefined' && i18n[lang] && i18n[lang][key]) || (lang === 'ru' ? fallbackRu : fallbackEn);
  };
  const formatDate = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString(currentLang() === 'ru' ? 'ru-RU' : 'en-GB');
  };
  const formatDateTime = value => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString(currentLang() === 'ru' ? 'ru-RU' : 'en-GB');
  };
  const escapeHtml = value => String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
  const adminName = () => {
    const admin = currentAdmin();
    if (!admin) return '';
    return String(admin.admin_name || (currentLang() === 'ru' ? 'Администратор ' + currentLevel() + ' уровня' : 'Administrator level ' + currentLevel()));
  };
  const adminNameHidden = () => currentLevel() === 5 && localStorage.getItem(WARN_HIDE_NAME_KEY) === 'true';
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
    !!target && (
      (target.token && String(row.token || '') === String(target.token)) ||
      (target.telegramId && String(row.telegramId || '') === String(target.telegramId))
    );
  const warningTime = row => {
    const candidates = [row && row.issuedAt, row && row.timestamp, row && row.createdAt, row && row.date];
    for (const value of candidates) {
      const time = Date.parse(value || '');
      if (Number.isFinite(time)) return time;
    }
    return 0;
  };
  const validIsoAfter = (value, offset, fallback = Date.now()) => {
    const parsed = Date.parse(value || '');
    return new Date((Number.isFinite(parsed) ? parsed : fallback) + offset).toISOString();
  };
  const warnings = () => {
    const current = safeRead(WARN_KEY);
    if (current.length) return current.map(row => row && typeof row === 'object' ? { ...row } : row);
    const legacy = safeRead(LEGACY_WARN_KEY);
    if (legacy.length) {
      if (safeWrite(WARN_KEY, legacy)) {
        try { localStorage.removeItem(LEGACY_WARN_KEY); } catch (_) {}
      }
      return legacy.map(row => row && typeof row === 'object' ? { ...row } : row);
    }
    return [];
  };
  const writeWarnings = rows => {
    if (!safeWrite(WARN_KEY, rows)) return Promise.reject(new Error('Не удалось обновить локальный кэш предупреждений.'));
    return persistWarnings(rows);
  };
    const readLogRows = () => safeRead(USER_LOG_KEY);
  const logUser = () => {};
  const logAdmin = () => {};
  async function recordIpHistory(ip, trigger) {
    const address = String(ip || '').trim();
    if (!address || !cloudUserLogsLoaded) return false;
    const rows = readLogRows();
    rows.push({ id: 'ip_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), timestamp: new Date().toISOString(), userToken: currentToken(), telegramId: currentTelegramId(), event: 'ip_history', details: { ip: address, trigger: String(trigger || 'unknown') } });
    const trimmed = rows.slice(-MAX_LOG_ROWS);
    safeWriteCache(USER_LOG_KEY, trimmed);
    try { await persistUserLogs(trimmed); return true; }
    catch (error) { console.warn('Не удалось сохранить историю IP:', error); return false; }
  }
  const warningsFor = (token, telegramId) => {
    const normalizedToken = String(token || '');
    const normalizedTelegramId = String(telegramId || '');
    return warnings().filter(row =>
      (normalizedToken && String(row.token || '') === normalizedToken) ||
      (normalizedTelegramId && String(row.telegramId || '') === normalizedTelegramId)
    ).sort((a, b) => warningTime(a) - warningTime(b));
  };

  function showMessage(title, message) {
    const pre = document.createElement('pre');
    pre.style.cssText = 'white-space:pre-wrap;overflow-wrap:anywhere;max-height:55vh;overflow:auto;margin:0;font:inherit;';
    pre.textContent = String(message || '');
    if (typeof openModal === 'function') openModal(title, pre, [{ text: tr('ok', 'ОК', 'OK') }]);
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
              showMessage(tr('warningActionFailedTitle', 'Не удалось выполнить действие', 'Action failed'), result.error);
            } else if (result && result.message) {
              showMessage(result.title || 'Готово', result.message);
            }
          }).catch(error => {
            showMessage(tr('warningSaveFailedTitle', 'Не удалось сохранить в GitHub', 'Could not save to GitHub'), error && error.message ? error.message : String(error));
          });
        }
      },
      { text: lang === 'ru' ? 'Отмена' : 'Cancel', class: 'btn btn--ghost' }
    ]);
  }

  function scheduleNewWarning(rows, warning) {
    const group = rows.filter(row => targetMatches(row, warning));
    group.sort((a, b) => warningTime(a) - warningTime(b));
    const last = group[group.length - 1];
    const base = Date.now() + TWO_DAYS;
    const lastRemoval = last ? Date.parse(last.removeAt || '') : NaN;
    const nextFromLast = Number.isFinite(lastRemoval) ? lastRemoval + TWO_DAYS : (last ? warningTime(last) + TWO_DAYS : base);
    const next = last ? Math.max(base, Number.isFinite(nextFromLast) ? nextFromLast : base) : base;
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
      group.sort((a, b) => warningTime(a) - warningTime(b));
      const lock = group.filter(row => row.lockUntil).sort((a, b) => warningTime(b) - warningTime(a))[0];
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
          row.removeAt = validIsoAfter(row.issuedAt || row.timestamp || row.createdAt || row.date, TWO_DAYS);
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

    // Автоматическая очистка не должна записывать admin2.js в GitHub при входе
    // или в фоновом таймере. Синхронизация в GitHub выполняется только явными
    // действиями управления предупреждениями.
    if (removeIds.size) {
      safeWriteCache(WARN_KEY, rows.filter(row => !removeIds.has(row.id)));
    } else if (changed) {
      safeWriteCache(WARN_KEY, rows);
    }
  }

  function activeLock(rows) {
    return rows.filter(row => row.lockUntil && Number.isFinite(Date.parse(row.lockUntil)) && Date.parse(row.lockUntil) > Date.now())
      .sort((a, b) => warningTime(b) - warningTime(a))[0] || null;
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
    const adminLabel = lock.adminNameHidden || !lock.adminName ? tr('adminNameHidden', 'Скрыто', 'Hidden') : lock.adminName;
    if (reason) {
      reason.hidden = false;
      reason.style.whiteSpace = 'pre-line';
      reason.textContent = currentLang() === 'ru'
        ? 'Причина блокировки: 3/3 предупреждений\nПричина выдачи предупреждения: ' + (lock.reason || tr('warningNotSpecified', 'Не указана', 'Not specified')) + '\nДата выдачи: ' + formatDate(lock.issuedAt)
        : 'Reason for block: 3/3 warnings\nWarning reason: ' + (lock.reason || tr('warningNotSpecified', 'Не указана', 'Not specified')) + '\nIssued on: ' + formatDate(lock.issuedAt);
    }
    if (duration) {
      duration.hidden = false;
      duration.style.whiteSpace = 'pre-line';
      duration.textContent = currentLang() === 'ru'
        ? 'Разблокировка: ' + formatDateTime(lock.lockUntil) + '\nБлокировка на 5 дней'
        : 'Unlocks: ' + formatDateTime(lock.lockUntil) + '\nBlocked for 5 days';
    }
    if (byAdmin) {
      byAdmin.hidden = false;
      byAdmin.textContent = (currentLang() === 'ru' ? 'Выдал: ' : 'Issued by: ') + adminLabel;
    }
    const userToken = document.getElementById('user-token-blocked');
    if (userToken) userToken.textContent = currentToken() || '—';
    const telegramId = String(currentTelegramId() || window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '—');
    let telegramIdEl = document.getElementById('blocked-telegram-id');
    if (!telegramIdEl && userToken) {
      telegramIdEl = document.createElement('div');
      telegramIdEl.id = 'blocked-telegram-id';
      telegramIdEl.style.cssText = 'overflow-wrap:anywhere;margin-top:6px;';
      userToken.insertAdjacentElement('afterend', telegramIdEl);
    }
    if (telegramIdEl) telegramIdEl.textContent = (currentLang() === 'ru' ? 'Telegram ID пользователя: ' : 'User Telegram ID: ') + telegramId;

    const copyButton = document.getElementById('btn-copy-token-blocked');
    if (copyButton) copyButton.onclick = async () => {
      const value = String(currentToken() || '—');
      try {
        if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
          await navigator.clipboard.writeText(value);
        } else {
          throw new Error('Clipboard API unavailable');
        }
      } catch (_) {
        const area = document.createElement('textarea');
        area.value = value;
        area.setAttribute('readonly', '');
        area.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;';
        document.body.appendChild(area);
        area.focus();
        area.select();
        area.setSelectionRange(0, area.value.length);
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (_) {}
        area.remove();
        if (!ok) {
          if (typeof openModal === 'function') openModal(currentLang() === 'ru' ? 'Ошибка копирования' : 'Copy failed', currentLang() === 'ru' ? 'Не удалось скопировать токен. Вы можете выделить и скопировать его вручную.' : 'Could not copy the token. You can select and copy it manually.');
          return;
        }
      }
      const label = copyButton.querySelector('span');
      if (label) {
        const oldText = label.textContent;
        label.textContent = currentLang() === 'ru' ? 'Скопировано' : 'Copied';
        setTimeout(() => { label.textContent = oldText; }, 2500);
      }
    };

    document.querySelectorAll('#blocked-lang-buttons .seg').forEach(button => {
      button.onclick = () => {
        const lang = button.dataset.value === 'en' ? 'en' : 'ru';
        try { localStorage.setItem('lang', lang); } catch (_) {}
        document.querySelectorAll('#blocked-lang-buttons .seg').forEach(item => item.classList.toggle('active', item === button));
        if (typeof applyLang === 'function') applyLang(lang);
        const refreshedLock = activeLock(warningsFor(currentToken(), currentTelegramId()));
        if (refreshedLock) showWarningLock(refreshedLock);
      };
    });
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
        button.title = currentLang() === 'ru' ? 'Недоступно при наличии предупреждения' : 'Unavailable while a warning is active';
      } else {
        button.removeAttribute('aria-disabled');
        if (button.title === 'Недоступно при наличии предупреждения' || button.title === 'Unavailable while a warning is active') button.removeAttribute('title');
      }
    });
    document.querySelectorAll('.platform-row').forEach(row => {
      const shouldBlock = blocked && denied(row.dataset.value || row.textContent);
      row.setAttribute('aria-disabled', shouldBlock ? 'true' : 'false');
      row.classList.toggle('platform-row--warning-blocked', shouldBlock);
      row.title = shouldBlock ? (currentLang() === 'ru' ? 'Недоступно при наличии предупреждения' : 'Unavailable while a warning is active') : '';
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
    if (button) {
      const hasWarnings = rows.length > 0;
      button.hidden = !hasWarnings;
      button.style.display = hasWarnings ? 'flex' : 'none';
      button.setAttribute('aria-hidden', hasWarnings ? 'false' : 'true');
    }
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
    if (create) create.title = blockedByDailyLimit ? (currentLang() === 'ru' ? 'При 2/3 предупреждениях доступно одно создание рекламы в день' : 'With 2/3 warnings, only one ad can be created per day') : '';
    const blockedScreen = document.getElementById('screen-blocked');
    if (blockedScreen?.dataset.warningLock === 'true') {
      delete blockedScreen.dataset.warningLock;
      if (typeof showMainMenu === 'function') showMainMenu();
    }
  }

  async function issueWarning(targetValue, reasonValue) {
    const admin = currentAdmin();
    if (!cloudWarningsLoaded) return { error: currentLang() === 'ru' ? 'Подождите, пока загрузятся данные предупреждений из GitHub.' : 'Please wait while warnings load from GitHub.' };
    if (!admin || currentLevel() < 2) return { error: tr('warningDeniedIssue', 'Выдавать предупреждения могут администраторы 2-го уровня и выше.', 'Only administrators level 2 and above can issue warnings.') };
    const reason = String(reasonValue || '').trim();
    const target = targetFromInput(targetValue);
    if (!target) return { error: tr('warningTargetPlaceholder', 'Введите токен пользователя или Telegram ID.', 'Enter a user token or Telegram ID.') };

    cleanupWarnings();
    const rows = warnings().map(row => row && typeof row === 'object' ? JSON.parse(JSON.stringify(row)) : row);
    const originalRows = rows.map(row => row && typeof row === 'object' ? JSON.parse(JSON.stringify(row)) : row);
    const current = rows.filter(row => targetMatches(row, target));
    if (current.length >= 3 || current.some(row => row.lockUntil)) {
      return { error: currentLang() === 'ru' ? 'У пользователя уже 3/3 предупреждения. Новое предупреждение выдать нельзя.' : 'The user already has 3/3 warnings. No more warnings can be issued.' };
    }
    const limits = { 2: 2, 3: 4, 4: 7, 5: Infinity };
    const limit = limits[currentLevel()] || 0;
    const adminId = admin.admin_token || currentToken();
    const today = localDate();
    const issuedToday = rows.filter(row => row.adminToken === adminId && warningTime(row) > 0 && localDate(new Date(warningTime(row))) === today).length;
    if (issuedToday >= limit) return { error: currentLang() === 'ru' ? 'Достигнут дневной лимит выдачи предупреждений: ' + limit + '.' : 'Daily warning limit reached: ' + limit + '.' };

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
      for (let index = 0; index < rows.length; index++) {
        if (targetMatches(rows[index], target)) rows[index] = { ...rows[index], lockUntil, removeAt: lockUntil };
      }
    }
    try { await writeWarnings(rows); } catch (error) { safeWrite(WARN_KEY, originalRows); return { error: (currentLang() === 'ru' ? 'Варн не сохранён в GitHub: ' : 'Warning was not saved to GitHub: ') + (error.message || error) }; }
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
    const successText = count === 3
      ? tr('warningIssuedLock', 'Выдано предупреждение 3/3. Аккаунт заблокирован на 5 дней.', 'Warning 3/3 issued. Account locked for 5 days.')
      : tr('warningIssuedSuccess', 'Предупреждение выдано: {count}/3.', 'Warning issued: {count}/3.').replace('{count}', String(count));
    return { message: successText };
  }

  async function removeWarnings(targetValue) {
    if (!cloudWarningsLoaded) return { error: currentLang() === 'ru' ? 'Подождите, пока загрузятся данные предупреждений из GitHub.' : 'Please wait while warnings load from GitHub.' };
    if (currentLevel() !== 5) return { error: tr('warningDeniedRemove', 'Снимать предупреждения может только администратор 5-го уровня.', 'Only a level 5 administrator can remove warnings.') };
    const target = targetFromInput(targetValue);
    if (!target) return { error: tr('warningTargetPlaceholder', 'Введите токен пользователя или Telegram ID.', 'Enter a user token or Telegram ID.') };
    const rows = warnings().map(row => row && typeof row === 'object' ? JSON.parse(JSON.stringify(row)) : row);
    const originalRows = rows.map(row => row && typeof row === 'object' ? JSON.parse(JSON.stringify(row)) : row);
    const removed = rows.filter(row => targetMatches(row, target));
    if (!removed.length) return { error: tr('warningNoneForUser', 'У пользователя нет предупреждений.', 'The user has no warnings.') };
    try { await writeWarnings(rows.filter(row => !removed.includes(row))); } catch (error) { safeWrite(WARN_KEY, originalRows); return { error: (currentLang() === 'ru' ? 'Снятие предупреждений не сохранено в GitHub: ' : 'Warning removal was not saved to GitHub: ') + (error.message || error) }; }
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
    const successText = removed.some(row => row.lockUntil)
      ? tr('warningRemovedUnlock', 'Все предупреждения сняты. Блокировка 3/3 отменена.', 'All warnings removed. The 3/3 lock has been lifted.')
      : tr('warningRemovedSuccess', 'Снято предупреждений: {count}.', 'Warnings removed: {count}.').replace('{count}', String(removed.length));
    return { message: successText };
  }

  function openIssueWarningModal() {
    const lang = currentLang();
    if (currentLevel() < 2) return showMessage(tr('warningDeniedTitle', 'Недостаточно прав', 'Permission denied'), tr('warningDeniedIssue', 'Выдавать предупреждения могут администраторы 2-го уровня и выше.', 'Only administrators level 2 and above can issue warnings.'));
    openForm(tr('warningIssueButton', 'Выдать предупреждение (warn)', 'Issue warning (warn)'), body => {
      const controls = {
        target: field(body, tr('warningTargetLabel', 'Telegram ID или токен пользователя', 'Telegram ID or user token'), { placeholder: tr('warningTargetPlaceholder', 'Введите Telegram ID или токен', 'Enter Telegram ID or token'), required: true }),
        reason: field(body, tr('warningReasonLabel', 'Причина (необязательно)', 'Reason (optional)'), { multiline: true, placeholder: tr('warningReasonPlaceholder', 'Укажите причину, если необходимо', 'Enter a reason if needed'), rows: 3 })
      };
      if (currentLevel() === 5) {
        const wrap = document.createElement('label');
        wrap.style.cssText = 'display:flex;align-items:center;gap:8px;margin:8px 0;';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = localStorage.getItem(WARN_HIDE_NAME_KEY) === 'true';
        checkbox.addEventListener('change', () => localStorage.setItem(WARN_HIDE_NAME_KEY, checkbox.checked ? 'true' : 'false'));
        const label = document.createElement('span');
        label.textContent = tr('warningHideName', 'Скрыть моё имя при выдаче предупреждения', 'Hide my name when issuing a warning');
        wrap.append(checkbox, label);
        body.appendChild(wrap);
        controls.hideName = checkbox;
      }
      return controls;
    }, async controls => {
      if (controls.hideName) localStorage.setItem(WARN_HIDE_NAME_KEY, controls.hideName.checked ? 'true' : 'false');
      return await issueWarning(controls.target.value, controls.reason.value);
    }, lang === 'ru' ? 'Выдать warn' : 'Issue warning');
  }

  function openRemoveWarningsModal() {
    if (currentLevel() !== 5) return showMessage(tr('warningDeniedTitle', 'Недостаточно прав', 'Permission denied'), tr('warningDeniedRemove', 'Снимать предупреждения может только администратор 5-го уровня.', 'Only a level 5 administrator can remove warnings.'));
    openForm(tr('warningRemoveButton', 'Снять предупреждения', 'Remove warnings'), body => ({
      target: field(body, tr('warningTargetLabel', 'Telegram ID или токен пользователя', 'Telegram ID or user token'), { placeholder: tr('warningTargetPlaceholder', 'Введите Telegram ID или токен', 'Enter Telegram ID or token'), required: true })
    }), controls => removeWarnings(controls.target.value), tr('warningRemoveButton', 'Снять предупреждения', 'Remove warnings'));
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
  // IP-address search is disabled.

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


  let warningScreen = null;
  let warningScreenList = null;

  function renderWarningsScreen() {
    if (!warningScreenList) return;
    const lang = currentLang();
    const rows = warningsFor(currentToken(), currentTelegramId());
    if (!rows.length) {
      warningScreenList.innerHTML = '<div class="card"><div class="hint">' + escapeHtml(tr('warningEmpty', 'Предупреждений нет.', 'No warnings.')) + '</div></div>';
      return;
    }
    warningScreenList.innerHTML = rows.map((row, index) => {
      const name = row.adminNameHidden || !row.adminName ? tr('adminNameHidden', 'Скрыто', 'Hidden') : row.adminName;
      return '<article class="card warning-entry">' +
        '<div class="card__title">' + escapeHtml(tr('warningCountLabel', 'Предупреждение', 'Warning')) + ' ' + (index + 1) + '/3</div>' +
        '<p>' + escapeHtml(tr('warningIssuedLabel', 'Выдано', 'Issued')) + ': ' + escapeHtml(formatDate(row.issuedAt)) + '</p>' +
        '<p>' + escapeHtml(tr('warningRemoveAtLabel', 'Снятие', 'Removal')) + ': ' + escapeHtml(formatDate(row.removeAt)) + '</p>' +
        '<p>' + escapeHtml(tr('warningReasonPrefix', 'Причина', 'Reason')) + ': ' + escapeHtml(row.reason || tr('warningNotSpecified', 'Не указана', 'Not specified')) + '</p>' +
        '<p>' + escapeHtml(tr('warningByLabel', 'Выдал', 'Issued by')) + ': ' + escapeHtml(name) + '</p>' +
      '</article>';
    }).join('');
  }

  function createWarningScreen() {
    if (warningScreen || !document.querySelector('main')) return;
    warningScreen = document.createElement('section');
    warningScreen.id = 'screen-warnings';
    warningScreen.className = 'screen';
    warningScreen.hidden = true;
    warningScreen.innerHTML = '<div class="stack">' +
      '<div class="screen__head">' +
      '<button class="back-btn" id="back-from-warnings" type="button" aria-label="' + escapeHtml(tr('reviewBack', 'Назад', 'Back')) + '"><i class="fa-solid fa-arrow-left"></i></button>' +
      '<div class="screen__title" id="warning-screen-title">' + escapeHtml(tr('warningTitle', 'Список предупреждений', 'Warning list')) + '</div>' +
      '</div><div id="warning-list-content" class="stack-sm"></div></div>';
    document.querySelector('main').appendChild(warningScreen);
    warningScreenList = warningScreen.querySelector('#warning-list-content');
    warningScreen.querySelector('#back-from-warnings').addEventListener('click', () => {
      document.querySelectorAll('.screen').forEach(item => { item.hidden = item.id !== 'screen-main'; });
      if (typeof refreshBackButton === 'function') refreshBackButton();
    });
  }

  function openWarningsScreen() {
    createWarningScreen();
    if (!warningScreen) return;
    document.querySelectorAll('.screen').forEach(item => { item.hidden = item !== warningScreen; });
    warningScreen.hidden = false;
    renderWarningsScreen();
    if (typeof refreshBackButton === 'function') refreshBackButton();
  }

  function applyLanguage(lang = currentLang()) {
    const dict = typeof i18n !== 'undefined' ? i18n[lang] : null;
    const setLabel = (id, key, ru, en) => {
      const el = document.querySelector('#' + id + ' .menu__text');
      if (el) el.textContent = (dict && dict[key]) || (lang === 'ru' ? ru : en);
    };
    const group = document.getElementById('warn-tools-group');
    if (group) group.textContent = (dict && dict.warningSection) || (lang === 'ru' ? 'Предупреждения' : 'Warnings');
    setLabel('warn-issue', 'warningIssueButton', 'Выдать предупреждение (warn)', 'Issue warning (warn)');
    setLabel('warn-remove', 'warningRemoveButton', 'Снять предупреждения', 'Remove warnings');
    const nav = document.querySelector('#nav-warnings .menu__text');
    if (nav) nav.textContent = (dict && dict.warningTitle) || (lang === 'ru' ? 'Список предупреждений' : 'Warning list');
    const back = document.getElementById('back-from-warnings');
    if (back) back.setAttribute('aria-label', (dict && dict.reviewBack) || (lang === 'ru' ? 'Назад' : 'Back'));
    const title = document.getElementById('warning-screen-title');
    if (title) title.textContent = (dict && dict.warningTitle) || (lang === 'ru' ? 'Список предупреждений' : 'Warning list');
    if (warningScreen && !warningScreen.hidden) renderWarningsScreen();
  }

  function addAdminButtons() {
    const menu = document.querySelector('#screen-admin .menu');
    if (!menu || document.getElementById('warn-issue')) return;
    const group = document.createElement('div');
    group.className = 'menu__group';
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
    applyLanguage();
  }

  function updateAdminButtonVisibility() {
    const level = currentLevel();
    document.querySelectorAll('#warn-tools-group, #screen-admin [data-min-level]').forEach(element => {
      element.hidden = level < Number(element.dataset.minLevel || 1);
    });
  }

  function install() {
    createWarningScreen();
    const crystals = document.getElementById('nav-crystals');
    if (crystals && !document.getElementById('nav-warnings')) {
      const button = document.createElement('button');
      button.id = 'nav-warnings';
      button.type = 'button';
      button.className = crystals.className;
      button.hidden = true;
      button.innerHTML = '<span class="menu__icon"><i class="fa-solid fa-triangle-exclamation"></i></span>' +
        '<span class="menu__text"></span>' +
        '<span class="menu__chev"><i class="fa-solid fa-chevron-right"></i></span>';
      crystals.insertAdjacentElement('afterend', button);
      button.addEventListener('click', openWarningsScreen);
    }
    addAdminButtons();
    applyLanguage();
    updateAdminButtonVisibility();
    cleanupWarnings();
    refresh();
  }

  window.addEventListener('buyad:admin2-config-loaded', event => {
    const detail = event.detail || {};
    if (Array.isArray(detail.UserWarnings)) {
      safeWriteCache(WARN_KEY, detail.UserWarnings);
      cloudWarningsLoaded = true;
    }
    if (Array.isArray(detail.UserLogs)) {
      safeWriteCache(USER_LOG_KEY, detail.UserLogs);
      cloudUserLogsLoaded = true;
    }
    refresh();
  });

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
        showMessage(currentLang() === 'ru' ? 'Функция недоступна' : 'Feature unavailable', currentLang() === 'ru' ? 'Эта площадка заблокирована при наличии предупреждения.' : 'This platform is blocked while a warning is active.');
        return;
      }
    }

    const button = event.target.closest('button,[role="button"]');
    if (!button) return;
    const lock = activeLock(rows);
    if (lock && !['btn-support', 'btn-copy-token-blocked', 'nav-warnings', 'back-from-warnings'].includes(button.id) && !button.closest('#blocked-lang-buttons')) {
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
      showMessage(currentLang() === 'ru' ? 'Лимит создания рекламы' : 'Ad creation limit', currentLang() === 'ru' ? 'При 2/3 предупреждениях можно создать только одну рекламу в день.' : 'With 2/3 warnings, you can create only one ad per day.');
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
    recordIpHistory,
    cleanupWarnings,
    applyLanguage,
    openWarningsScreen
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