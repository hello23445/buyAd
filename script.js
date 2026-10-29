// script.js 
/* ========== TELEGRAM ========== */
const tg = window.Telegram?.WebApp;
let isRulesModalOpen = false;
if (tg) {
  tg.ready();
  tg.expand();

  function setTelegramBackButtonVisible(visible) {
    if (!tg?.BackButton) return;
    try {
      if (visible) {
        tg.BackButton.show();
      } else {
        tg.BackButton.hide();
      }
    } catch (e) {
      console.warn('Failed to toggle Telegram BackButton:', e);
    }
  }

  function setTelegramSettingsButtonVisible(visible) {
    if (!tg?.SettingsButton) return;
    try {
      if (visible) {
        tg.SettingsButton.show();
      } else {
        tg.SettingsButton.hide();
      }
    } catch (e) {
      console.warn('Failed to toggle Telegram SettingsButton:', e);
    }
  }
  
  // Восстанавливаем fullscreen состояние при загрузке
  (function() {
    try {
      const APP_SIZE_LS = 'appSize';
      const savedSize = localStorage.getItem(APP_SIZE_LS);
      const isiPhone = /iPhone/i.test(navigator.userAgent);
      
      if (savedSize === 'fullscreen') {
        // Пытаемся включить fullscreen
        if (typeof tg.requestFullscreen === 'function') {
          tg.requestFullscreen();
        } else if (typeof tg.web_app_request_fullscreen === 'function') {
          tg.web_app_request_fullscreen();
        } else if (typeof tg.request_fullscreen === 'function') {
          tg.request_fullscreen();
        }
        // Добавляем класс для iPhone
        if (isiPhone) document.body.classList.add('iphone-fullscreen');
      }
    } catch (e) {
      console.warn('Failed to restore fullscreen state:', e);
    }
  })();
  
  // Включаем подтверждение при закрытии приложения
  tg.enableClosingConfirmation();
  // Скрываем кнопку Settings при входе на сайт и показываем через 15 секунд
  if (tg.SettingsButton) {
    setTelegramSettingsButtonVisible(false);
    setTimeout(() => {
      const settingsScreenVisible = $('screen-settings') && !$('screen-settings').hidden;
      if (!settingsScreenVisible) {
        setTelegramSettingsButtonVisible(true);
      }
    }, 15000);
  }
  // Обработчик клика на кнопку Settings
  if (tg.SettingsButton) {
    tg.SettingsButton.onClick(() => {
      const previousScreen = document.querySelector('.screen:not([hidden])')?.id || 'screen-main';
      hideAllScreens();
      if ($('btn-open-settings')) {
        $('btn-open-settings').disabled = true;
      }
      setTelegramSettingsButtonVisible(false);
      show($('screen-settings'));
    });
  }
  
  // Telegram BackButton handler
  if (tg.BackButton) {
    tg.BackButton.onClick(() => {
      if (isRulesModalOpen) {
        closeModal();
        return;
      }

      const currentScreen = document.querySelector('.screen:not([hidden])')?.id || 'screen-main';
      
      if (currentScreen === 'screen-create' && document.getElementById('back-from-create')) {
        document.getElementById('back-from-create').click();
      } else if (currentScreen === 'screen-myads' && document.getElementById('back-from-myads')) {
        document.getElementById('back-from-myads').click();
      } else if (currentScreen === 'screen-ad-statistics' && document.getElementById('back-from-ad-statistics')) {
        document.getElementById('back-from-ad-statistics').click();
      } else if (currentScreen === 'screen-crystals' && document.getElementById('back-from-crystals')) {
        document.getElementById('back-from-crystals').click();
      } else if (currentScreen === 'screen-admin' && document.getElementById('back-from-admin')) {
        document.getElementById('back-from-admin').click();
      } else if (currentScreen === 'screen-settings' && document.getElementById('back-from-settings')) {
        document.getElementById('back-from-settings').click();
      }
    });
  }
}

/* ========== HELPERS ========== */
const $ = id => document.getElementById(id);
function refreshBackButton() {
  if (!tg?.BackButton) return;

  const currentScreen = document.querySelector('.screen:not([hidden])')?.id || 'screen-main';
  const shouldShow = isRulesModalOpen || [
    'screen-create',
    'screen-myads',
    'screen-ad-statistics',
    'screen-crystals',
    'screen-admin',
    'screen-settings'
  ].includes(currentScreen);

  if (shouldShow) {
    tg.BackButton.show();
  } else {
    tg.BackButton.hide();
  }
}
function show(el) { 
  if (!el) return; 
  try { 
    el.hidden = false;
    refreshBackButton();
  } catch (e) { /* ignore */ } 
}
function hide(el) { if (!el) return; try { el.hidden = true; } catch (e) { /* ignore */ } }
function showPreloader() { 
  show($('preloader')); 
  if (tg?.BackButton) {
    tg.BackButton.hide();
  }
  // Отключаем кнопку кристаллов во время загрузки
  $('nav-crystals').disabled = true;
  $('nav-crystals').style.pointerEvents = 'none';
}
function hidePreloader() { 
  hide($('preloader')); 
  refreshBackButton();
  // Включаем кнопку кристаллов после загрузки
  $('nav-crystals').disabled = false;
  $('nav-crystals').style.pointerEvents = '';
}
let modalOnCloseCallback = null;
function rand(len) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

// Russian plural form helper (legacy)
function getRussianPlural(num) {
  const ones = num % 10;
  const tens = Math.floor((num % 100) / 10);
  if (tens === 1) return 'человек';
  if (ones === 1) return 'человек';
  if (ones >= 2 && ones <= 4) return 'человека';
  return 'человек';
}

// Universal pluralization using translation keys
function pluralPeople(num) {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (lang === 'ru') {
    return getRussianPlural(num);
  }
  const singular = i18n[lang]?.personSingular || 'person';
  const plural = i18n[lang]?.personPlural || 'people';
  return num === 1 ? singular : plural;
}

function pluralClicks(num, lang = localStorage.getItem(LS.lang) || 'ru') {
  if (lang !== 'ru') return num === 1 ? i18n[lang].clickOnce : i18n[lang].clickMany;
  const ones = num % 10;
  const tens = Math.floor((num % 100) / 10);
  if (tens === 1 || ones === 0 || ones >= 5) return i18n[lang].clickMany;
  if (ones === 1) return i18n[lang].clickOnce;
  return i18n[lang].clickFew;
}

// Format number with spaces as thousand separator
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

/* ========== MODAL ========== */
function openModal(title, body, actions = [], opts = {}) {
  $('modal-title').textContent = title;
  const modalBody = $('modal-body');
  if (modalBody) modalBody.innerHTML = '';
  if (typeof body === 'string') {
    if (modalBody) modalBody.textContent = body;
  } else {
    if (modalBody) modalBody.appendChild(body);
  }
  const actionsBox = $('modal-actions');
  if (actionsBox) actionsBox.innerHTML = '';
  actions.forEach(a => {
    const b = document.createElement('button');
    b.className = a.class || 'btn btn--primary';
    b.textContent = a.text;
    b.disabled = a.disabled || false;
    b.onclick = () => {
      try {
        if (a.onClick) a.onClick();
      } finally {
        // prevent close handler from running again when action already handled
        modalOnCloseCallback = null;
        closeModal();
      }
    };
    if (actionsBox) actionsBox.appendChild(b);
  });
  // set optional on-close callback (for close icon behavior)
  modalOnCloseCallback = opts.onClose || null;
  show($('modal-overlay'));
}
function closeModal() {
  // if there's a special on-close callback, call it
  if (modalOnCloseCallback) {
    try { modalOnCloseCallback(); } catch (e) { /* ignore */ }
    modalOnCloseCallback = null;
  }
  hide($('modal-overlay'));
}
$('modal-close').onclick = closeModal;

function showFeatureBlockedModal(type) {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const i18nLang = i18n[lang] || i18n.ru;
  const title = i18nLang.attentionTitle || 'Внимание';
  const body = type === 'edit'
    ? (i18nLang.editDisabled || 'Возможность редактировать рекламу временно отключена.')
    : (i18nLang.createDisabled || 'Возможность создавать рекламу временно отключена.');
  const okText = i18nLang.ok || i18nLang.yes || 'ОК';
  openModal(title, body, [
    { text: okText, class: 'btn btn--primary', onClick: () => {} }
  ]);
}

/* ========== STORAGE ========== */
const LS = {
  lang: 'lang',
  token: 'get_UserToken',
  theme: 'theme'
};

const ADMIN2_PATH = './admin2.js';

const ADMIN_LEVEL_LOCAL_KEY = 'buyAdsAdminLocalLevel';
const ADMIN_DAILY_ACTIONS_KEY = 'buyAdsAdminDailyActions';
const ADMIN_PERMISSION_MIN_LEVEL = {
  reviewAds: 1,
  viewRestricted: 2,
  banToken: 2,
  unban: 2,
  restrictAds: 2,
  banTelegramId: 3,
  banIp: 4,
  globalCreateToggle: 4,
  manageAdmins: 2,
  changeOwnLevelLocally: 5,
  hideNameOnRejection: 5,
  hideNameOnBan: 5,
  viewOwnIp: 5
};
const ADMIN_PERMISSION_LABELS = {
  reviewAds: 'Проверка рекламы',
  viewRestricted: 'Просмотр списка ограниченных пользователей',
  banToken: 'Блокировка пользователя по токену',
  unban: 'Разблокировка пользователя',
  restrictAds: 'Запрет создания и редактирования рекламы',
  banTelegramId: 'Блокировка по Telegram ID',
  banIp: 'Блокировка по IP-адресу',
  globalCreateToggle: 'Управление приложением, рекламой, GAS и платежами',
  manageAdmins: 'Управление администраторами',
  changeOwnLevelLocally: 'Локальное изменение своего уровня',
  hideNameOnRejection: 'Скрывать имя при отклонении рекламы',
  hideNameOnBan: 'Скрывать имя при блокировке',
  viewOwnIp: 'Просмотр своих IP-адресов'
};
function getDefaultAdminPermissions(level) {
  return Object.fromEntries(Object.entries(ADMIN_PERMISSION_MIN_LEVEL).map(([permission, minLevel]) => [permission, Number(level) >= minLevel]));
}
function getBaseAdminByToken(token = localStorage.getItem(LS.token) || '') {
  return (typeof ADMINS !== 'undefined' ? ADMINS : []).find(item => item.admin_token === token) || null;
}
function getCurrentAdmin() {
  const token = localStorage.getItem(LS.token) || '';
  const admin = getBaseAdminByToken(token);
  if (!admin) return null;
  const copy = { ...admin, permissions: { ...(admin.permissions || {}) } };
  if (Number(admin.admin_level) === 5) {
    const localLevel = Number(localStorage.getItem(ADMIN_LEVEL_LOCAL_KEY));
    if ([1, 2, 3, 4, 5].includes(localLevel)) copy.admin_level = localLevel;
  }
  return copy;
}
function adminHasPermission(permission) {
  const admin = getCurrentAdmin();
  if (!admin) return false;
  const isExplicit = Object.prototype.hasOwnProperty.call(admin.permissions || {}, permission);
  if (isExplicit && admin.permissions[permission] === false) return false;

  // У исходного администратора 5-го уровня локальная смена уровня остаётся режимом предпросмотра.
  // Для новых администраторов индивидуальные чекбоксы являются действующими разрешениями.
  const baseAdmin = getBaseAdminByToken();
  const storedLevel = Number(localStorage.getItem(ADMIN_LEVEL_LOCAL_KEY));
  const isRootLevelPreview = Number(baseAdmin?.admin_level) === 5 && [1, 2, 3, 4, 5].includes(storedLevel) && storedLevel !== 5;
  if (admin.custom_permissions === true && isExplicit && !isRootLevelPreview) {
    return admin.permissions[permission] === true;
  }

  const level = Number(admin.admin_level);
  const minLevel = ADMIN_PERMISSION_MIN_LEVEL;
  return !minLevel[permission] || level >= minLevel[permission];
}
function adminDailyCountKey(action) { const admin = getCurrentAdmin(); return ADMIN_DAILY_ACTIONS_KEY + ':' + (admin?.admin_token || '') + ':' + new Date().toISOString().slice(0,10) + ':' + action; }
function adminDailyCount(action) { try { return Number(localStorage.getItem(adminDailyCountKey(action)) || 0); } catch { return 0; } }
function recordAdminAction(action) { const key = adminDailyCountKey(action); localStorage.setItem(key, String(adminDailyCount(action) + 1)); }
function adminDailyLimit(action) {
  const admin = getCurrentAdmin();
  const level = Number(admin?.admin_level || 0);
  // Эти действия только открывают/просматривают панели и не расходуют дневной лимит.
  if (['reviewAds', 'viewRestricted', 'viewOwnIp'].includes(action)) return Infinity;
  if (level >= 5) return Infinity;
  if (level === 4) return 6;

  const level3Limits = {
    banToken: 3, unbanToken: 3, restrictAds: 4, unrestrictAds: 4,
    banTelegramId: 3, unbanTelegramId: 3, banAdmin: 3, unbanAdmin: 3, rejectAd: Infinity
  };
  const level2Limits = {
    banToken: 2, unbanToken: 2, restrictAds: 2, unrestrictAds: 2,
    banAdmin: 2, unbanAdmin: 2, rejectAd: Infinity
  };
  if (level === 3 && Object.prototype.hasOwnProperty.call(level3Limits, action)) return level3Limits[action];
  if (level === 2 && Object.prototype.hasOwnProperty.call(level2Limits, action)) return level2Limits[action];
  if (action === 'rejectAd') return Infinity;

  if (admin?.custom_permissions === true) {
    const permissionForAction = {
      banToken: ['banToken'], unbanToken: ['unban'],
      restrictAds: ['restrictAds'], unrestrictAds: ['restrictAds'],
      banTelegramId: ['banTelegramId'], unbanTelegramId: ['banTelegramId'],
      banIp: ['banIp'], unbanIp: ['banIp'], globalCreateToggle: ['globalCreateToggle'],
      banAdmin: ['banToken', 'unban', 'restrictAds'], unbanAdmin: ['unban']
    };
    const related = permissionForAction[action] || [];
    if (related.some(permission => adminHasPermission(permission))) {
      return level <= 1 ? 1 : level === 2 ? 2 : level === 3 ? 3 : 6;
    }
  }
  return 0;
}
function adminGuard(action, targetValue = '') {
  const admin = getCurrentAdmin(), lang = localStorage.getItem(LS.lang) || 'ru';
  const deny = message => { openModal(lang === 'ru' ? 'Недостаточно прав' : 'Permission denied', message); return false; };
  if (!admin) return deny(lang === 'ru' ? 'Действие доступно только администраторам.' : 'This action is for administrators only.');
  const permissionByAction = { reviewAds:'reviewAds', viewRestricted:'viewRestricted', banToken:'banToken', unbanToken:'unban', banTelegramId:'banTelegramId', unbanTelegramId:'unban', banIp:'banIp', unbanIp:'unban', restrictAds:'restrictAds', unrestrictAds:'restrictAds', globalCreateToggle:'globalCreateToggle', manageAdmins:'manageAdmins', viewOwnIp:'viewOwnIp' };
  const permission = permissionByAction[action]; if (permission && !adminHasPermission(permission)) return deny(lang === 'ru' ? 'Это действие запрещено настройками ваших прав.' : 'Your permissions do not allow this action.');
  const targetAdmin = (typeof ADMINS !== 'undefined' ? ADMINS : []).find(item => item.admin_token === String(targetValue || '').trim());
  if (['banTelegramId','unbanTelegramId'].includes(action)) {
    const selfTelegramId = String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '');
    if (selfTelegramId && String(targetValue || '').trim() === selfTelegramId) return deny(lang === 'ru' ? 'Нельзя применить наказание к самому себе.' : 'You cannot punish yourself.');
  }
  if (action === 'banIp') {
    const ownIps = typeof getSavedUserAPIs === 'function' ? getSavedUserAPIs() : [];
    if (ownIps.includes(String(targetValue || '').trim())) return deny(lang === 'ru' ? 'Нельзя заблокировать собственный IP-адрес.' : 'You cannot block your own IP address.');
  }
  if (targetAdmin && ['banToken','unbanToken','restrictAds','unrestrictAds'].includes(action)) {
    const level = Number(admin.admin_level), targetLevel = Number(targetAdmin.admin_level);
    if (targetAdmin.admin_token === admin.admin_token) return deny(lang === 'ru' ? 'Нельзя применить наказание к самому себе.' : 'You cannot punish yourself.');
    const allowedTarget = level === 4 ? targetLevel === 1 : level === 5 ? targetLevel < 5 : level >= 2 && targetLevel === 1;
    if (!allowedTarget) return deny(lang === 'ru' ? (level === 4 ? 'Администратор 4-го уровня может применять наказание только к администраторам 1-го уровня.' : 'Нельзя блокировать себя и администраторов своего или старшего уровня.') : (level === 4 ? 'Level-4 administrators may only punish level-1 administrators.' : 'You cannot punish yourself, peers, or higher-level administrators.'));

    action = 'banAdmin';
  }
  const limitAction = ({ unbanToken:'banToken', unbanTelegramId:'banTelegramId', unbanIp:'banIp', unrestrictAds:'restrictAds' })[action] || action;
  const limit = adminDailyLimit(limitAction); if (adminDailyCount(limitAction) >= limit) return deny(lang === 'ru' ? 'Достигнут дневной лимит для этого действия (' + limit + ').' : 'Daily limit reached for this action (' + limit + ').');
  return true;
}
function getAdminDisplayName(admin = getCurrentAdmin(), mode = 'ban') {
  if (!admin) return '';
  const hidePermission = mode === 'rejection' ? 'hideNameOnRejection' : 'hideNameOnBan';
  const hideSetting = mode === 'rejection' ? 'hideAdminNameOnRejection' : 'hideAdminNameOnBan';
  if (Number(admin.admin_level) === 5 && adminHasPermission(hidePermission) && localStorage.getItem(hideSetting) === 'true') return '';
  return String(admin.admin_name || ('Администратор ' + admin.admin_level + ' уровня'));
}
function updateAdminLevelBadge() {
  const admin = getCurrentAdmin();
  const input = $('admin-level-badge');
  const save = $('admin-level-save');
  const base = getBaseAdminByToken();
  const baseLevel = Number(base?.admin_level);
  const canLocallySet = baseLevel === 5 && base?.permissions?.changeOwnLevelLocally === true;

  // Не скрываем переключатель даже при выбранном уровне ниже 5:
  // у исходного администратора 5-го уровня всегда остаётся возможность вернуть уровень обратно.
  if (input) {
    input.value = String(admin?.admin_level || 5);
    input.hidden = !canLocallySet;
  }
  if (save) save.hidden = !canLocallySet;

  const addAdminButton = $('admin-add-new');
  if (addAdminButton) {
    addAdminButton.hidden = !(baseLevel === 5 && Number(admin?.admin_level) === 5 && adminHasPermission('manageAdmins'));
  }
  const clear = $('admin-clear-localstorage');
  if (clear) clear.hidden = !(baseLevel === 5 && Number(admin?.admin_level) === 5);

  const permissionVisibility = {
    'admin-check': 'reviewAds',
    'admin-restricted': 'viewRestricted',
    'admin-block-user': 'banToken',
    'admin-unblock-user': 'unban',
    'admin-ban-ip': 'banIp',
    'admin-unban-ip': 'banIp',
    'admin-ban-telegram-id': 'banTelegramId',
    'admin-unban-telegram-id': 'banTelegramId',
    'admin-ban-create-edit': 'restrictAds',
    'admin-unban-create-edit': 'restrictAds',
    'admin-close-app': 'globalCreateToggle',
    'admin-open-app': 'globalCreateToggle',
    'admin-disable-gas': 'globalCreateToggle',
    'admin-enable-gas': 'globalCreateToggle',
    'admin-disable-payments': 'globalCreateToggle',
    'admin-enable-payments': 'globalCreateToggle',
    'admin-disable-create-all': 'globalCreateToggle',
    'admin-enable-create-all': 'globalCreateToggle',
    'admin-disable-edit-all': 'globalCreateToggle',
    'admin-enable-edit-all': 'globalCreateToggle'
  };
  Object.entries(permissionVisibility).forEach(([id, permission]) => {
    const element = $(id);
    if (element) element.hidden = !adminHasPermission(permission);
  });
  const ipCard = $('admin-ip-info-card');
  if (ipCard) ipCard.hidden = !adminHasPermission('viewOwnIp');
}
$('admin-level-save')?.addEventListener('click', () => {
  const input = $('admin-level-badge');
  if (!input) return;
  const value = String(input.value || '').trim();
  const level = value === '' ? 5 : Number(value);
  const base = getBaseAdminByToken();
  if (Number(base?.admin_level) !== 5 || base?.permissions?.changeOwnLevelLocally !== true) {
    alert('Нет разрешения');
    return;
  }
  if (!Number.isInteger(level) || level < 1 || level > 5) {
    alert('Укажите уровень от 1 до 5');
    return;
  }
  localStorage.setItem(ADMIN_LEVEL_LOCAL_KEY, String(level));
  updateAdminLevelBadge();
  openModal('Уровень обновлён', 'Изменение действует только в этом браузере.');
});


async function persistNewAdminRecord(newAdmin) {
  const tokenEndpoint = 'https://script.google.com/macros/s/AKfycbzTDNI5q2qAUWHoXsm5KJWlnrv0ivvK5LI6Gbevp9A-u31L48D0wZbWuDnD-X52vo-MOA/exec';
  const authResponse = await fetch(tokenEndpoint, { cache: 'no-store' });
  if (!authResponse.ok) throw new Error('Не удалось получить разрешение на сохранение администраторов.');
  const authData = await authResponse.json();
  if (!authData?.token) throw new Error('Источник не вернул токен GitHub.');

  const url = 'https://api.github.com/repos/hello23445/buyAd/contents/admin.js';
  const fileResponse = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + authData.token }
  });
  if (!fileResponse.ok) {
    const errorData = await fileResponse.json().catch(() => ({}));
    throw new Error('Не удалось прочитать список администраторов: ' + (errorData.message || fileResponse.status));
  }
  const file = await fileResponse.json();
  const source = decodeURIComponent(escape(atob(String(file.content || '').replace(/\n/g, ''))));
  const tokenMatches = [...source.matchAll(/["']?admin_token["']?\s*:\s*(['"])(.*?)\1/g)];
  if (tokenMatches.some(match => match[2] === newAdmin.admin_token)) {
    throw new Error('Такой токен уже зарегистрирован у администратора.');
  }

  const arrayStart = source.indexOf('const ADMINS = [');
  const closeIndex = source.indexOf('];', arrayStart);
  if (arrayStart < 0 || closeIndex < 0) throw new Error('Не удалось определить список ADMINS в admin.js.');

  const newSource = source.slice(0, closeIndex).trimEnd() + ',\n  ' + JSON.stringify(newAdmin) + '\n' + source.slice(closeIndex);
  const encoded = btoa(unescape(encodeURIComponent(newSource)));
  const saveResponse = await fetch(url, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: 'Bearer ' + authData.token,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: 'Add administrator from admin menu',
      content: encoded,
      sha: file.sha
    })
  });
  const saveResult = await saveResponse.json().catch(() => ({}));
  if (!saveResponse.ok) {
    throw new Error('GitHub не сохранил нового администратора: ' + (saveResult.message || saveResponse.status));
  }
  return saveResult;
}

function openAddAdminModal() {
  const base = getBaseAdminByToken();
  const active = getCurrentAdmin();
  if (Number(base?.admin_level) !== 5 || Number(active?.admin_level) !== 5 || !adminHasPermission('manageAdmins')) {
    openModal('Недостаточно прав', 'Добавлять администраторов может только администратор 5-го уровня с соответствующим правом.');
    return;
  }

  const form = document.createElement('div');
  form.className = 'admin-create-form';

  const tokenLabel = document.createElement('label');
  tokenLabel.className = 'admin-create-field';
  const tokenTitle = document.createElement('span');
  tokenTitle.textContent = 'Токен нового админа';
  const tokenInput = document.createElement('input');
  tokenInput.type = 'text';
  tokenInput.autocomplete = 'off';
  tokenInput.spellcheck = false;
  tokenInput.placeholder = 'Введите токен';
  tokenLabel.append(tokenTitle, tokenInput);
  form.appendChild(tokenLabel);

  const levelLabel = document.createElement('label');
  levelLabel.className = 'admin-create-field';
  const levelTitle = document.createElement('span');
  levelTitle.textContent = 'Уровень админа';
  const levelSelect = document.createElement('select');
  for (let level = 1; level <= 5; level++) {
    const option = document.createElement('option');
    option.value = String(level);
    option.textContent = level + '-й уровень';
    levelSelect.appendChild(option);
  }
  levelSelect.value = '1';
  levelLabel.append(levelTitle, levelSelect);
  form.appendChild(levelLabel);

  const permissionsTitle = document.createElement('div');
  permissionsTitle.className = 'admin-permissions-heading';
  permissionsTitle.textContent = 'Права доступа';
  form.appendChild(permissionsTitle);

  const permissionsList = document.createElement('div');
  permissionsList.className = 'admin-permissions-list';
  const permissionInputs = {};
  Object.entries(ADMIN_PERMISSION_LABELS).forEach(([permission, labelText]) => {
    const optionLabel = document.createElement('label');
    optionLabel.className = 'admin-permission-option';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = false;
    const label = document.createElement('span');
    label.textContent = labelText;
    optionLabel.append(checkbox, label);
    permissionsList.appendChild(optionLabel);
    permissionInputs[permission] = checkbox;
  });
  form.appendChild(permissionsList);

  const applyLevelPermissions = () => {
    const preset = getDefaultAdminPermissions(Number(levelSelect.value));
    Object.entries(permissionInputs).forEach(([permission, checkbox]) => {
      checkbox.checked = preset[permission] === true;
    });
  };
  levelSelect.addEventListener('change', applyLevelPermissions);
  applyLevelPermissions();

  openModal('Добавить нового админа', form, []);
  const actions = $('modal-actions');
  if (actions) actions.innerHTML = '';

  const cancelButton = document.createElement('button');
  cancelButton.type = 'button';
  cancelButton.className = 'btn btn--ghost';
  cancelButton.textContent = 'Отмена';
  cancelButton.onclick = () => closeModal();

  const saveButton = document.createElement('button');
  saveButton.type = 'button';
  saveButton.className = 'btn btn--primary';
  saveButton.textContent = 'Создать администратора';
  saveButton.onclick = async () => {
    const token = String(tokenInput.value || '').trim();
    if (!token) {
      alert('Введите токен нового администратора.');
      tokenInput.focus();
      return;
    }
    if ((typeof ADMINS !== 'undefined' ? ADMINS : []).some(item => item.admin_token === token)) {
      alert('Такой токен уже используется.');
      tokenInput.focus();
      return;
    }

    const selectedLevel = Number(levelSelect.value);
    const permissions = {};
    Object.entries(permissionInputs).forEach(([permission, checkbox]) => {
      permissions[permission] = checkbox.checked;
    });
    const newAdmin = {
      admin_name: 'Администратор ' + selectedLevel + ' уровня',
      admin_level: selectedLevel,
      admin_token: token,
      permissions,
      custom_permissions: true
    };

    // Проверяем доступ непосредственно перед записью в GitHub.
    const currentBase = getBaseAdminByToken();
    if (Number(currentBase?.admin_level) !== 5 || Number(getCurrentAdmin()?.admin_level) !== 5 || !adminHasPermission('manageAdmins')) {
      alert('Добавлять администраторов может только администратор 5-го уровня.');
      closeModal();
      return;
    }

    closeModal();
    showPreloader();
    try {
      await persistNewAdminRecord(newAdmin);
      hidePreloader();
      openModal('Администратор добавлен', 'Новый администратор сохранён. Перезагрузите приложение, чтобы применить обновлённый список.', [
        { text: 'Перезагрузить приложение', onClick: () => location.reload() }
      ]);
    } catch (error) {
      hidePreloader();
      openModal('Не удалось добавить администратора', error?.message || 'Произошла ошибка при сохранении.');
    }
  };

  if (actions) {
    actions.append(cancelButton, saveButton);
  }
  setTimeout(() => tokenInput.focus(), 50);
}
$('admin-add-new')?.addEventListener('click', openAddAdminModal);

$('admin-clear-localstorage')?.addEventListener('click',()=>{
 const token=localStorage.getItem(LS.token)||'', base=(typeof ADMINS!=='undefined'?ADMINS:[]).find(x=>x.admin_token===token);
 if(Number(base?.admin_level)!==5 || Number(getCurrentAdmin()?.admin_level)!==5){alert('Доступно только администратору 5-го уровня');return;}
 if(confirm('Очистить локальные данные? Токен, Telegram ID и сохранённые настройки приложения будут сохранены.')){
  const preserved = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key === LS.token || /telegram.?id|user.?id|setting|theme|lang|appSize|confirmation|position|title|closing/i.test(key))) preserved[key] = localStorage.getItem(key);
  }
  localStorage.clear();
  Object.entries(preserved).forEach(([key, value]) => localStorage.setItem(key, value));
  location.reload();
}
});

let runtimeAdmin2ConfigLoaded = false;
let runtimeAdmin2Config = {
  BanForever: [''],
  BlockCreateAds: [''],
  BlockedUsersTelegramID: [''],
  BlockedUsersIPadresses: [''],
  CloseApp: '',
  GASESES: '',
  Purchases2: '',
  disableCreateAds2: '',
  disableEditingAds: ''
};

function parseExportArray(name, content) {
  const re = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(\\[[\\s\\S]*?\\])\\s*;`);
  const match = content.match(re);
  if (!match) return [''];
  try {
    return JSON.parse(match[1]);
  } catch (e) {
    return [''];
  }
}

function parseExportValue(name, content) {
  const re = new RegExp(`export\\s+const\\s+${name}\\s*=\\s*(['"])(.*?)\\1\\s*;`);
  const match = content.match(re);
  return match ? match[2] : '';
}

async function loadAdmin2Config() {
  try {
    const response = await fetch(ADMIN2_PATH, { cache: 'no-store' });
    if (!response.ok) {
      console.warn('admin2.js load failed', response.status);
      return;
    }
    const content = await response.text();
    runtimeAdmin2Config = {
      BanForever: parseExportArray('BanForever', content),
      BlockCreateAds: parseExportArray('BlockCreateAds', content),
      BlockedUsersTelegramID: parseExportArray('BlockedUsersTelegramID', content),
      BlockedUsersIPadresses: parseExportArray('BlockedUsersIPadresses', content),
      CloseApp: parseExportValue('CloseApp', content),
      GASESES: parseExportValue('GASESES', content),
      Purchases2: parseExportValue('Purchases2', content),
      disableCreateAds2: parseExportValue('disableCreateAds2', content),
      disableEditingAds: parseExportValue('disableEditingAds', content)
    };
    runtimeAdmin2ConfigLoaded = true;
    const lang = localStorage.getItem(LS.lang) || 'ru';
    const token = localStorage.getItem(LS.token);
    const isAdmin = ADMIN_TOKENS.includes(token);
    if (isAppClosed() && !isAdmin) {
      hideAllScreens();
      showAppUnavailableModal(lang);
      return;
    }
    await applyRuntimeBlockings();
  } catch (e) {
    console.warn('Failed to load admin2 config', e);
  }
}

function getRuntimeConfig(name, fallback) {
  if (runtimeAdmin2ConfigLoaded && Object.prototype.hasOwnProperty.call(runtimeAdmin2Config, name)) {
    return runtimeAdmin2Config[name];
  }
  return fallback;
}

function runtimeArray(name, fallback) {
  const value = getRuntimeConfig(name, fallback);
  if (Array.isArray(value)) return value;
  return fallback || [];
}

function isRuntimeValue(name, expectedValue, fallback) {
  return getRuntimeConfig(name, fallback) === expectedValue;
}

function isAppClosed() {
  return isRuntimeValue('CloseApp', 'closed', closeApp);
}

function isGasDisabled() {
  if (isRuntimeValue('GASESES', 'no', GASES)) return true;

  const token = localStorage.getItem(LS.token);
  const isTokenBan = runtimeArray('BanForever', []).includes(token);
  const telegramId = String(tg?.initDataUnsafe?.user?.id || '');
  const isTelegramBan = telegramId && runtimeArray('BlockedUsersTelegramID', []).includes(telegramId);

  return isTokenBan || isTelegramBan || currentUserIpBlocked;
}

function isPaymentsDisabled() {
  return isRuntimeValue('Purchases2', 'no', '');
}

function isEditingDisabledGlobally() {
  return isRuntimeValue('disableEditingAds', 'disabled', '');
}

function punishmentEntryValue(entry) {
  if (entry && typeof entry === 'object') return String(entry.value || entry.token || entry.ip || entry.telegramId || '').trim();
  return String(entry || '').trim();
}
function findPunishmentEntry(arrayName, value) {
  const normalized = String(value || '').trim();
  return runtimeArray(arrayName, []).find(entry => punishmentEntryValue(entry) === normalized) || null;
}
function getPunishmentReason(arrayName, value) {
  const entry = findPunishmentEntry(arrayName, value);
  return entry && typeof entry === 'object' ? String(entry.reason || '').trim() : '';
}
function getPunishmentAdminName(arrayName, value) {
  const entry = findPunishmentEntry(arrayName, value);
  return entry && typeof entry === 'object' ? String(entry.adminName || '').trim() : '';
}
function isTokenCreateBlocked() {
  const token = localStorage.getItem(LS.token);
  return runtimeArray('BlockCreateAds', []).some(entry => punishmentEntryValue(entry) === String(token || ''));
}

function isTokenFullyBlocked() {
  const token = localStorage.getItem(LS.token);
  return !!findPunishmentEntry('BanForever', token);
}

function isCreateAdsDisabledGlobally() {
  return isRuntimeValue('disableCreateAds2', 'disabled', disableCreateAds) || isTokenCreateBlocked();
}

function isTelegramIdBlocked() {
  const telegramId = String(tg?.initDataUnsafe?.user?.id || '');
  return telegramId && !!findPunishmentEntry('BlockedUsersTelegramID', telegramId);
}

let cachedClientIp = null;
function getSavedUserAPIs() {
  try {
    const saved = JSON.parse(localStorage.getItem('userAPIs') || '[]');
    return Array.isArray(saved)
      ? [...new Set(saved.map(value => String(value || '').trim()).filter(Boolean))]
      : [];
  } catch (e) {
    return [];
  }
}

function saveUserAPI(ip) {
  const normalizedIp = String(ip || '').trim();
  if (!normalizedIp) return getSavedUserAPIs();

  const userAPIs = getSavedUserAPIs();
  if (!userAPIs.includes(normalizedIp)) {
    userAPIs.push(normalizedIp);
    try {
      localStorage.setItem('userAPIs', JSON.stringify(userAPIs));
    } catch (e) {
      console.warn('Could not save user IP history');
    }
  }
  return userAPIs;
}

async function getClientIp() {
  if (cachedClientIp) {
    saveUserAPI(cachedClientIp);
    return cachedClientIp;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    if (!data.ip) return null;
    cachedClientIp = String(data.ip).trim();
    saveUserAPI(cachedClientIp);
    return cachedClientIp;
  } catch (e) {
    console.warn('IP fetch failed', e);
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function isIpBlocked() {
  // Текущий IP добавляется в userAPIs, а блокировка проверяет всю историю IP.
  await getClientIp();
  const userAPIs = getSavedUserAPIs();
  const blockedIPs = runtimeArray('BlockedUsersIPadresses', []).map(punishmentEntryValue).filter(Boolean);
  return userAPIs.some(userIP => blockedIPs.includes(userIP));
}

function updateBlockedSubtitle(reason, lang) {
  const subtitle = $('screen-blocked')?.querySelector('.card__subtitle');
  if (!subtitle) return;

  if (reason === 'telegram') {
    subtitle.dataset.i18n = 'blockedSubtitleTelegram';
    subtitle.textContent = i18n[lang].blockedSubtitleTelegram || 'Your Telegram ID is blocked in the app';
  } else if (reason === 'ip') {
    subtitle.dataset.i18n = 'blockedSubtitleIp';
    subtitle.textContent = i18n[lang].blockedSubtitleIp || 'Your IP address is blocked in the app';
  } else {
    subtitle.dataset.i18n = 'blockedSubtitle';
    subtitle.textContent = i18n[lang].blockedSubtitle || 'You have been blocked';
  }
}

let specialModalType = null;
let currentUserIpBlocked = false;

function showSpecialModal(title, body, type) {
  openModal(title, body, [], {
    onClose: () => {
      specialModalType = null;
    }
  });
  const closeBtn = $('modal-close');
  if (closeBtn) closeBtn.hidden = true;
  specialModalType = type;
}

function showAppUnavailableModal(lang) {
  if (specialModalType === 'offline') return;
  showSpecialModal(i18n[lang].attentionTitle || 'Внимание', i18n[lang].appUnavailable || 'Приложение временно недоступно.', 'appUnavailable');
}

function hideAppUnavailableModal() {
  if (specialModalType !== 'appUnavailable') return;
  const closeBtn = $('modal-close');
  if (closeBtn) closeBtn.hidden = false;
  closeModal();
}

function showOfflineModal() {
  showSpecialModal('Нет подключения к интернету!', 'Подключитесь к интернету чтобы продолжить!', 'offline');
}

function hideOfflineModal() {
  if (specialModalType !== 'offline') return;
  const closeBtn = $('modal-close');
  if (closeBtn) closeBtn.hidden = false;
  closeModal();
}

function updateOnlineStatus() {
  if (!navigator.onLine) {
    showOfflineModal();
  } else {
    hideOfflineModal();
  }
}

async function applyRuntimeBlockings() {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const token = localStorage.getItem(LS.token);
  const isTokenBan = isTokenFullyBlocked();
  const isCreateBan = isTokenCreateBlocked();
  const isTelegramBan = isTelegramIdBlocked();
  const isIpBan = await isIpBlocked();

  const blockedByIpOrTelegram = isTelegramBan || isIpBan;
  const anyBlocked = isTokenBan || blockedByIpOrTelegram;

  const createAdsDisabledGlobally = isCreateAdsDisabledGlobally();
  currentUserIpBlocked = isIpBan;
  if ($('nav-create')) {
    $('nav-create').disabled = false;
  }
  if ($('btn-create-ad')) {
    $('btn-create-ad').disabled = false;
  }
  document.querySelectorAll('.edit-btn').forEach(btn => {
    btn.disabled = false;
  });

  if (anyBlocked) {
    hideAllScreens();
    show($('screen-blocked'));
    if ($('btn-open-settings')) {
      $('btn-open-settings').hidden = true;
    }
    if (tg?.SettingsButton) {
      tg.SettingsButton.hide();
    }
    let punishmentReason = '', punishmentAdminName = '';
    if (isTokenBan) {
      updateBlockedSubtitle('token', lang); $('user-token-blocked').textContent = token || '—';
      punishmentReason = getPunishmentReason('BanForever', token);
      punishmentAdminName = getPunishmentAdminName('BanForever', token);
    } else if (isTelegramBan) {
      const telegramId = String(tg?.initDataUnsafe?.user?.id || '');
      updateBlockedSubtitle('telegram', lang); $('user-token-blocked').textContent = telegramId || '—';
      punishmentReason = getPunishmentReason('BlockedUsersTelegramID', telegramId);
      punishmentAdminName = getPunishmentAdminName('BlockedUsersTelegramID', telegramId);
    } else if (isIpBan) {
      updateBlockedSubtitle('ip', lang); $('user-token-blocked').textContent = token || '—';
      const blockedIPs = runtimeArray('BlockedUsersIPadresses', []);
      const matchedIP = getSavedUserAPIs().find(ip => blockedIPs.some(entry => punishmentEntryValue(entry) === ip));
      punishmentReason = matchedIP ? getPunishmentReason('BlockedUsersIPadresses', matchedIP) : '';
      punishmentAdminName = matchedIP ? getPunishmentAdminName('BlockedUsersIPadresses', matchedIP) : '';
    }
    const reasonEl = $('blocked-reason');
    if (reasonEl) {
      if (punishmentReason) { reasonEl.textContent = (i18n[lang].blockedReasonPrefix || (lang === 'ru' ? 'Причина:' : 'Reason:')) + ' ' + punishmentReason; reasonEl.hidden = false; }
      else { reasonEl.textContent = ''; reasonEl.hidden = true; }
    }
    const blockedByEl = $('blocked-by-admin');
    if (blockedByEl) {
      const displayAdminName = punishmentAdminName || i18n[lang].adminNameHidden || (lang === 'ru' ? 'Администратор' : 'Administrator');
      blockedByEl.textContent = (lang === 'ru' ? 'Заблокировал админ: ' : 'Blocked by admin: ') + displayAdminName;
      blockedByEl.hidden = false;
    }
    $('btn-support').onclick = () => window.open(SUPPORT_URL, '_blank');
    $('btn-copy-token-blocked').onclick = () => {
      navigator.clipboard.writeText(token || '—').then(() => {
        const span = $('btn-copy-token-blocked').querySelector('span');
        if (span) {
          span.textContent = i18n[lang].copied;
          setTimeout(() => { span.textContent = i18n[lang].copy; }, 3000);
        }
      }).catch(() => {
        openModal(i18n[lang].failedToCopy, '');
      });
    };
    document.querySelectorAll('#blocked-lang-buttons .seg').forEach(b => {
      b.onclick = () => {
        document.querySelectorAll('#blocked-lang-buttons .seg').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const langVal = b.dataset.value;
        localStorage.setItem(LS.lang, langVal);
        applyLang(langVal);
      };
    });
    return true;
  }
  return false;
}

async function pollAdmin2Config() {
  await loadAdmin2Config();
  setInterval(loadAdmin2Config, 1000);
}

function applyLang(lang) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[lang]?.[key]) {
      el.textContent = i18n[lang][key];
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (i18n[lang]?.[key]) {
      el.placeholder = i18n[lang][key];
    }
  });
  document.title = i18n[lang].appTitle;
  if (! $('screen-main').hidden) showMainMenu();
  if (! $('screen-crystals').hidden) loadCrystals();
  if (! $('screen-myads').hidden) loadMyAds();
  if (! $('screen-settings').hidden) {
    // Initialize token display in settings
    initTokenDisplay();
    initTelegramIdDisplay();  }
  if (! $('screen-create').hidden) {
    const span = $('btn-create-ad').querySelector('span');
    span.dataset.i18n = editMode ? 'saveChanges' : 'createBtn';
    span.textContent = i18n[lang][editMode ? 'saveChanges' : 'createBtn'];
  }
}

/* ========== USER TOKEN / ID (исправленный) ========== */
function generateRandomString(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

let telegramUserId = tg?.initDataUnsafe?.user?.id;
let hasTelegramId = !!telegramUserId; // Отслеживаем, был ли реальный Telegram ID

// Если Telegram ID недоступен, используем сгенерированный ID (fallback)
if (!telegramUserId) {
  if (!localStorage.getItem('fallbackUserId')) {
    localStorage.setItem('fallbackUserId', generateRandomString(12));
  }
  telegramUserId = localStorage.getItem('fallbackUserId');
}

console.log('User ID:', telegramUserId);
console.log('Has Telegram ID:', hasTelegramId);

// Инициализируем TOKEN
if (!localStorage.getItem(LS.token)) {
  localStorage.setItem(LS.token, generateRandomString(16));
}

const USER_TOKEN = localStorage.getItem(LS.token);

// Функция для получения текущего ID пользователя
// Приоритет: Telegram ID > fallback ID
function getUserID() {
  if (telegramUserId) {
    return String(telegramUserId); // Преобразуем в строку для консистентности
  }
  return localStorage.getItem('fallbackUserId');
}

/* ========== SESSION MANAGEMENT ========== */
const SESSION_LS_KEY = 'device_session_id';
let sessionCheckIntervalId = null;

// Генерация уникального session_id для этого устройства
function generateSessionId() {
  return generateRandomString(24);
}

// Записать session_id на GAS (action: "write")
async function writeSessionToGAS(userID, sessionId) {
  if (isGasDisabled()) return true; // Пропускаем если GAS отключены
  try {
    const response = await fetch(GAS_SESSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'write',
        userID: userID,
        session_id: sessionId
      })
    });
    const text = await response.text();
    console.log('Session write response:', text);
    return text === 'Session ID written successfully';
  } catch (e) {
    console.error('Failed to write session to GAS:', e);
    return false;
  }
}

// Проверить session_id на GAS (action: "check")
async function checkSessionOnGAS(userID, sessionId) {
  if (isGasDisabled()) return 'No changes'; // Пропускаем если GAS отключены
  try {
    const response = await fetch(GAS_SESSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: 'check',
        userID: userID,
        session_id: sessionId
      })
    });
    const text = await response.text();
    console.log('Session check response:', text);
    return text;
  } catch (e) {
    console.error('Failed to check session on GAS:', e);
    return 'No changes'; // В случае ошибки не показываем модал
  }
}

// Инициализировать сессию при загрузке
async function initializeSession() {
  try {
    const userID = getUserID();
    let sessionId = localStorage.getItem(SESSION_LS_KEY);
    
    // Если session_id не существует, генерируем новый
    if (!sessionId) {
      sessionId = generateSessionId();
      localStorage.setItem(SESSION_LS_KEY, sessionId);
      console.log('New session created:', sessionId);
    }
    
    // Записываем/обновляем session_id на GAS
    const writeSuccess = await writeSessionToGAS(userID, sessionId);
    if (writeSuccess) {
      console.log('Session initialized successfully');
      // Начинаем периодическую проверку
      startSessionMonitoring();
    }
  } catch (e) {
    console.error('Failed to initialize session:', e);
  }
}

// Запустить периодическую проверку сессии
function startSessionMonitoring() {
  // Проверяем каждые 5 секунд
  sessionCheckIntervalId = setInterval(async () => {
    try {
      const userID = getUserID();
      const sessionId = localStorage.getItem(SESSION_LS_KEY);
      
      if (!sessionId) return;
      
      const checkResult = await checkSessionOnGAS(userID, sessionId);
      
      // Если session изменился - показываем модал
      if (checkResult === 'Session has been changed') {
        console.warn('Session changed detected! Another device connected.');
        stopSessionMonitoring();
        showSessionChangedModal();
      }
    } catch (e) {
      console.error('Error during session monitoring:', e);
    }
  }, 5000);
}

// Остановить периодическую проверку
function stopSessionMonitoring() {
  if (sessionCheckIntervalId !== null) {
    clearInterval(sessionCheckIntervalId);
    sessionCheckIntervalId = null;
  }
}

// Показать модал о смене устройства
function showSessionChangedModal() {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const title = SESSION_I18N[lang]?.sessionChangedTitle || 'Connection interrupted';
  const text = SESSION_I18N[lang]?.sessionChangedText || 'Another device has connected to your account';
  const btnText = SESSION_I18N[lang]?.sessionRestartBtn || 'Restart app';
  
  openModal(title, text, [
    {
      text: btnText,
      class: 'btn btn--primary',
      onClick: () => {
        window.location.reload();
      }
    }
  ]);
  
  // Запретить закрытие модала кликом на крестик
  const closeBtn = $('modal-close');
  if (closeBtn) closeBtn.hidden = true;
}

/* ========== THEME ========== */
function applyTheme(theme) {
  document.body.classList.remove('theme-dark', 'theme-light');
  if (theme === 'light') {
    document.body.classList.add('theme-light');
  } else if (theme === 'dark') {
    document.body.classList.add('theme-dark');
  } else {
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.add('theme-dark');
    }
  }
}

/* ========== CHECK USER STATUS (локально) ========== */
async function checkUserStatus(isAdmin) {
  const userID = getUserID();
  const token = localStorage.getItem(LS.token);
  const lang = localStorage.getItem(LS.lang) || 'ru';
  showPreloader();
  try {
    console.log('Checking user status - token:', token, 'blockInApp:', blockInApp);
    // Проверяем только blockInApp (полная блокировка приложения)
    const isBlockedInApp = blockInApp.includes(token);
    console.log('Is blocked in app:', isBlockedInApp);
    if (isBlockedInApp) {
      hideAllScreens();
      show($('screen-blocked'));
      const blockedByEl = $('blocked-by-admin');
      if (blockedByEl) {
        blockedByEl.textContent = (lang === 'ru' ? 'Заблокировал админ: ' : 'Blocked by admin: ') + (i18n[lang].adminNameHidden || (lang === 'ru' ? 'Администратор' : 'Administrator'));
        blockedByEl.hidden = false;
      }
      $('user-token-blocked').textContent = token;
      $('btn-support').onclick = () => window.open(SUPPORT_URL, '_blank');
      $('btn-copy-token-blocked').onclick = () => {
        navigator.clipboard.writeText(token).then(() => {
          const span = $('btn-copy-token-blocked').querySelector('span');
          span.textContent = i18n[lang].copied;
          setTimeout(() => { span.textContent = i18n[lang].copy; }, 3000);
        }).catch(() => {
          openModal(i18n[lang].failedToCopy, '');
        });
      };
      document.querySelectorAll('#blocked-lang-buttons .seg').forEach(b => {
        b.onclick = () => {
          document.querySelectorAll('#blocked-lang-buttons .seg').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          const langVal = b.dataset.value;
          localStorage.setItem(LS.lang, langVal);
          applyLang(langVal);
        };
      });
      return false;
    }
    return true;
  } finally {
    hidePreloader();
  }
}

/* ========== CHECK APP OPEN (локально) ========== */
function checkAppOpen(isAdmin) {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (isAppClosed() && !isAdmin) {
    hideAllScreens();
    showAppUnavailableModal(lang);
    return false;
  }
  if (specialModalType === 'appUnavailable') {
    hideAppUnavailableModal();
  }
  return true;
}

/* ========== FIRST ENTRY ========== */
function firstEntry(lang) {
  localStorage.setItem(LS.lang, lang);
  localStorage.setItem(LS.token, rand(16));
  localStorage.setItem('crystals', '50');
  localStorage.setItem('adsCount', '0');
  const pre = document.createElement('pre');
  pre.className = 'rules__text';
  pre.innerHTML = RULES_TEXT[lang];
  openModal(i18n[lang].rulesTitle, pre, [
    { text: i18n[lang].rulesAcceptBtn || 'OK' }
  ]);
  applyLang(lang);
  showMainMenu();
}

/* ========== MAIN MENU ========== */
let currentCrystals = 0;

async function updateAdsCount() {
  if (isGasDisabled()) {
    $('ads-count').textContent = localStorage.getItem('adsCount') || 0;
    return;
  }
  try {
    // Fetch pending and all ads, then count only non-rejected ads + pending
    const userID = getUserID();
    const [pendingRes, approvedRes] = await Promise.all([
      fetch(`${GAS_SYS_URL}?action=getMyPending&userID=${userID}`),
      fetch(`${GAS_ADS_URL}?action=getMyAds&userID=${userID}`)
    ]);
    const pending = await pendingRes.json();
    const approved = await approvedRes.json();
    // approved may include ads with status 'rejected' — exclude them
    const approvedCount = Array.isArray(approved) ? approved.filter(a => (a.status || 'approved') !== 'rejected').length : 0;
    const count = (Array.isArray(pending) ? pending.length : 0) + approvedCount;
    $('ads-count').textContent = count;
    localStorage.setItem('adsCount', String(count));
  } catch (e) {
    // Fallback: try legacy endpoint or localStorage
    try {
      const res = await fetch(`${GAS_SYS_URL}?action=getAdsCount&userID=${getUserID()}`);
      const data = await res.json();
      $('ads-count').textContent = data.ads;
      localStorage.setItem('adsCount', data.ads);
    } catch (err) {
      $('ads-count').textContent = localStorage.getItem('adsCount') || 0;
    }
  }
  $('nav-myads').disabled = parseInt(localStorage.getItem('adsCount')) === 0;
}

async function fetchCrystals() {
  if (isGasDisabled()) {
    currentCrystals = 0;
    localStorage.setItem('crystals', '0');
    return 0;
  }
  try {
    const userID = getUserID();
    const res = await fetch(`${GAS_SYS_URL}?action=getUserCrystals&userID=${userID}`);
    const data = await res.json();
    currentCrystals = data.crystals || 0;
    localStorage.setItem('crystals', String(currentCrystals));
    return currentCrystals;
  } catch (e) {
    console.warn('Failed to fetch crystals:', e);
    currentCrystals = 0;
    localStorage.setItem('crystals', '0');
    return 0;
  }
}

async function updateCrystalsInGAS(amount, isAdd = true) {
  if (isGasDisabled()) {
    // Локальный fallback: обновляем только localStorage
    currentCrystals = isAdd ? currentCrystals + amount : currentCrystals - amount;
    localStorage.setItem('crystals', String(currentCrystals));
    return true;
  }
  try {
    const userID = getUserID();
    const action = isAdd ? 'addCrystals' : 'deductCrystals';
    const res = await fetch(`${GAS_SYS_URL}?action=${action}&userID=${userID}&amount=${amount}`);
    const data = await res.json();
    if (data.success) {
      currentCrystals = data.newCrystals;
      localStorage.setItem('crystals', String(currentCrystals));
      return true;
    }
    return false;
  } catch (e) {
    console.warn('Failed to update crystals in GAS:', e);
    return false;
  }
}

async function showMainMenu(updateWhat = 'both') {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const token = localStorage.getItem(LS.token);
  const isAdmin = ADMIN_TOKENS.includes(token);

  if (!await checkUserStatus(isAdmin)) return;
  if (!checkAppOpen(isAdmin)) return;
  if (await applyRuntimeBlockings()) return;

  hideAllScreens();
  show($('screen-main'));
  $('nav-admin').hidden = !isAdmin;
  updateAdminLevelBadge();

  // Показываем состояние загрузки пока данные загружаются
  const loadingText = lang === 'ru' ? 'Загрузка...' : 'Loading...';
  
  // Отключаем кнопку "Создать рекламу" до загрузки кристаллов
  $('nav-create').disabled = true;

  // Отключаем кнопку "Кристаллы" пока загружаются кристаллы
  if (updateWhat === 'both' || updateWhat === 'crystals') {
    $('nav-crystals').disabled = true;
  }

  // Загружаем данные в зависимости от updateWhat параметра
  // 'both' - обновляем оба счетчика ОДНОВРЕМЕННО
  // 'ads' - только счетчик реклам
  // 'crystals' - только счетчик кристаллов
  // 'none' - не обновляем ничего
  if (updateWhat === 'both' || updateWhat === 'ads') {
    $('ads-count').textContent = loadingText;
  }
  if (updateWhat === 'both' || updateWhat === 'crystals') {
    $('crystals-count').textContent = loadingText;
    $('crystals-now').textContent = loadingText;
  }

  // Загружаем все необходимые данные одновременно
  const promises = [];
  if (updateWhat === 'both' || updateWhat === 'ads') {
    promises.push(updateAdsCount());
  }
  if (updateWhat === 'both' || updateWhat === 'crystals') {
    promises.push(
      fetchCrystals().then(crystals => {
        currentCrystals = crystals;
        $('crystals-count').textContent = formatNumber(currentCrystals);
        $('crystals-now').textContent = formatNumber(currentCrystals);
      })
    );
  }
  
  if (promises.length > 0) {
    await Promise.all(promises);
  }

  // Включаем кнопку "Кристаллы" после загрузки
  if (updateWhat === 'both' || updateWhat === 'crystals') {
    $('nav-crystals').disabled = false;
  }

  // Локальное отключение создания (после загрузки кристаллов)
  // Проверяем: 1) флаг disableCreateAds 2) забан на создание рекламы
  const isBannedFromAds = banForeverAds.includes(token) || isTokenCreateBlocked();
  $('nav-create').disabled = isCreateAdsDisabledGlobally() || isBannedFromAds;
}

/* ========== NAVIGATION ========== */
function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(s => hide(s));
  refreshBackButton();
}

$('btn-open-settings').onclick = () => {
  previousScreen = document.querySelector('.screen:not([hidden])').id || 'screen-main';
  hideAllScreens();
  $('btn-open-settings').disabled = true;
  if (tg?.SettingsButton) {
    tg.SettingsButton.hide();
  }
  show($('screen-settings'));
  initTokenDisplay(); // Initialize token display when opening settings
  initTelegramIdDisplay(); // Initialize Telegram ID display when opening settings  initSettingsScreen(); // Initialize new settings
};

let adminCurrentIpValue = '';
let adminCurrentIpVisible = false;
let adminUserAPIsVisible = false;
function maskIpList(values) { return values.length ? values.map(() => '••••••••').join(', ') : 'Не определено'; }
async function initAdminIpPanel() {
  if (!$('admin-current-ip') || !$('admin-user-apis')) return;
  const card = $('admin-ip-info-card');
  const allowed = !!getCurrentAdmin() && adminHasPermission('viewOwnIp');
  if (card) card.hidden = !allowed;
  if (!allowed) return;
  adminCurrentIpValue = await getClientIp() || '';
  const ips = getSavedUserAPIs().slice().reverse();
  $('admin-current-ip').textContent = adminCurrentIpVisible ? (adminCurrentIpValue || 'Не определено') : (adminCurrentIpValue ? '••••••••' : 'Не определено');
  $('admin-user-apis').textContent = adminUserAPIsVisible ? (ips.length ? ips.map((ip, index) => `${index + 1}. ${ip}`).join(', ') : 'Не определено') : maskIpList(ips);
}
$('admin-current-ip-show').onclick = async () => { adminCurrentIpVisible = !adminCurrentIpVisible; $('admin-current-ip-show').textContent = adminCurrentIpVisible ? 'Скрыть' : 'Показать'; await initAdminIpPanel(); };
$('admin-user-apis-show').onclick = async () => { adminUserAPIsVisible = !adminUserAPIsVisible; $('admin-user-apis-show').textContent = adminUserAPIsVisible ? 'Скрыть' : 'Показать'; await initAdminIpPanel(); };
$('admin-current-ip-copy').onclick = async () => {
  const ip = adminCurrentIpValue || await getClientIp();
  if (!ip) return openModal('Не удалось определить IP-адрес', '');
  try { await navigator.clipboard.writeText(ip); $('admin-current-ip-copy').textContent = 'Скопировано'; setTimeout(() => $('admin-current-ip-copy').textContent = 'Скопировать', 2000); }
  catch (e) { openModal('Не удалось скопировать IP-адрес', ''); }
};
$('admin-user-apis-copy').onclick = async () => {
  const ips = getSavedUserAPIs();
  if (!ips.length) return openModal('История IP-адресов пуста', '');
  try { await navigator.clipboard.writeText(ips.join(', ')); $('admin-user-apis-copy').textContent = 'Скопировано'; setTimeout(() => $('admin-user-apis-copy').textContent = 'Скопировать', 2000); }
  catch (e) { openModal('Не удалось скопировать IP-адреса', ''); }
};

$('nav-admin').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const token = localStorage.getItem(LS.token);
  if (!ADMIN_TOKENS.includes(token)) {
    openModal(i18n[lang].accessDenied, '');
    return;
  }
  hideAllScreens();
  show($('screen-admin'));
  updateAdminLevelBadge();
  initAdminIpPanel();
};

$('nav-create').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (isCreateAdsDisabledGlobally()) {
    showFeatureBlockedModal('create');
    return;
  }
  // Show create screen immediately
  editMode = false;
  resetCreateForm();
  hideAllScreens();
  show($('screen-create'));
  const createBtn = $('btn-create-ad');
  if (createBtn) {
    createBtn.disabled = true; // disable until pending-check completes
    const span = createBtn.querySelector('span');
    if (span) span.textContent = i18n[lang].loading;
  }
  $('crystals-in-create').textContent = formatNumber(currentCrystals);

  // Run pending check in background; if user has pending ad — inform and return to main
  (async () => {
    if (isGasDisabled()) {
      // Fallback: предположим, нет pending
      if (createBtn) {
        createBtn.disabled = isCreateAdsDisabledGlobally();
        const span = createBtn.querySelector('span');
        if (span) span.textContent = i18n[lang].createBtn;
      }
      return;
    }
    try {
      const userID = getUserID();
      const res = await fetch(`${GAS_SYS_URL}?action=hasPending&userID=${userID}`);
      const data = await res.json();
      if (data.hasPending) {
        openModal(i18n[lang].youHavePending, '');
        await showMainMenu();
        return;
      }
    } catch (e) {
      // network error — allow user to proceed but re-enable button
    } finally {
      if (createBtn) {
        createBtn.disabled = isCreateAdsDisabledGlobally();
        const span = createBtn.querySelector('span');
        if (span) span.textContent = i18n[lang].createBtn;
      }
    }
  })();
};

let myAdsLoadedOnce = false;
const MY_ADS_REFRESH_COOLDOWN = 120000;
const MY_ADS_REFRESH_STORAGE_KEY = 'myAdsLastManualRefreshAt';
function updateMyAdsRefreshButton() {
 const b = $('myads-refresh'); if (!b) return;
 const last = Number(localStorage.getItem(MY_ADS_REFRESH_STORAGE_KEY) || 0);
 const remaining = Math.max(0, MY_ADS_REFRESH_COOLDOWN - (Date.now() - last));
 const lang = localStorage.getItem(LS.lang) || 'ru';
 if (remaining > 0) {
   const totalSeconds = Math.ceil(remaining / 1000);
   const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
   const ss = String(totalSeconds % 60).padStart(2, '0');
   b.textContent = (lang === 'ru' ? 'Обновить' : 'Refresh') + '(' + mm + ':' + ss + ')';
   b.disabled = true;
   b.title = lang === 'ru' ? 'Обновление доступно через ' + mm + ':' + ss : 'Refresh available in ' + mm + ':' + ss;
 } else {
   b.textContent = lang === 'ru' ? 'Обновить' : 'Refresh';
   b.disabled = false;
   b.title = '';
 }
}
$('myads-refresh').onclick=async()=>{const last=Number(localStorage.getItem(MY_ADS_REFRESH_STORAGE_KEY)||0);if(Date.now()-last<MY_ADS_REFRESH_COOLDOWN){updateMyAdsRefreshButton();return;}localStorage.setItem(MY_ADS_REFRESH_STORAGE_KEY,String(Date.now()));updateMyAdsRefreshButton();await loadMyAds();};
setInterval(updateMyAdsRefreshButton,1000);
$('nav-myads').onclick=()=>{hideAllScreens();show($('screen-myads'));if(!myAdsLoadedOnce){myAdsLoadedOnce=true;loadMyAds();}updateMyAdsRefreshButton();};

let statisticsPreviousScreen = 'screen-myads';

$('back-from-ad-statistics').onclick = () => {
  hideAllScreens();
  show($(statisticsPreviousScreen));
};

// // nav-settings removed from main menu (available in topbar)
// if ($('nav-settings')) {
//   $('nav-settings').onclick = () => {
//     previousScreen = document.querySelector('.screen:not([hidden])').id || 'screen-main';
//     hideAllScreens();
//     show($('screen-settings'));
//   };
// }

$('nav-rules').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const pre = document.createElement('pre');
  pre.className = 'rules__text';
  pre.innerHTML = RULES_TEXT[lang];
  isRulesModalOpen = true;
  refreshBackButton();
  openModal(i18n[lang].rulesTitle, pre, [
    {
      text: i18n[lang].rulesAcceptBtn || 'Я принимаю все эти правила',
      onClick: () => {
        isRulesModalOpen = false;
        refreshBackButton();
      }
    }
  ], {
    onClose: () => {
      isRulesModalOpen = false;
      refreshBackButton();
    }
  });
};

$('nav-report').onclick = () => {
  window.open(REPORT_ERROR_URL, '_blank');
};

$('nav-crystals').onclick = () => {
  hideAllScreens();
  show($('screen-crystals'));
  loadCrystals();
};

/* BACK */
let previousScreen = 'screen-main';
let previousEditScreen = null; // To track where edit was opened from
['back-from-create','back-from-myads','back-from-crystals','back-from-admin'].forEach(id => {
  const el = $(id);
  if (el) el.onclick = () => {
    // Reset ad creation screen title and state
    if (id === 'back-from-create') {
      const screenTitle = document.querySelector('#screen-create .screen__title');
      if (screenTitle) {
        const lang = localStorage.getItem(LS.lang) || 'ru';
        screenTitle.textContent = i18n[lang].createTitle || 'Создать рекламу';
      }
      editMode = false;
      editName = '';
      editStatus = '';
      // Reset form fields
      $('ad-text').innerHTML = '';
      videoFile = null;
      currentVideoUrl = '';
      document.querySelectorAll('#priority-buttons .seg').forEach(x => x.classList.remove('active'));
      document.querySelectorAll('#platform-buttons .seg').forEach(x => x.classList.remove('active'));
      
      // Return to where edit was opened from, or to main menu
      if (previousEditScreen) {
        hideAllScreens();
        show($(previousEditScreen));
        if (previousEditScreen === 'screen-myads') {
          loadMyAds(true); // skipPreloader = true
        }
        previousEditScreen = null;
      } else {
        showMainMenu();
      }
    } else if (id === 'back-from-myads') {
      // When returning from ads menu - only update ads count
      showMainMenu('ads');
    } else if (id === 'back-from-crystals') {
      // When returning from crystals menu - only update crystals count
      showMainMenu('crystals');
    } else if (id === 'back-from-admin') {
      // When returning from admin menu - don't update any counts
      showMainMenu('none');
    }
  };
});

// Special handling for back-from-settings
$('back-from-settings').onclick = () => {
  hideAllScreens();
  if ($('btn-open-settings')) {
    $('btn-open-settings').disabled = false;
  }
  if (tg?.SettingsButton) {
    tg.SettingsButton.show();
  }
  show($(previousScreen));
};

/* ========== CREATE AD LOGIC ========== */
let editMode = false;
let editName = '';
let editStatus = '';
let editCost = 0; // Cost of the current ad being edited
let commentsEnabled = false;
let selectedPriority = null;
let selectedPlatform = null;
let videoFile = null;
let videoSizeUpgrade = false;
let editingFrozenAd = false;
let footer = 'top';
let currentVideoUrl = '';
let originalAdData = {}; // Для отслеживания изменений при редактировании rejected

function resetCreateForm() {
  const adTextField = $('ad-text')?.closest('.field');
  if (adTextField) { adTextField.hidden = false; adTextField.style.display = ''; }
  document.querySelectorAll('.format-toolbar-modern').forEach(toolbar => { toolbar.hidden = false; toolbar.style.display = 'flex'; });
  $('ad-text').hidden = false;
  $('ad-text').style.display = 'block';
  videoSizeUpgrade = false;
  editingFrozenAd = false;
  const upgradeBtn = $('btn-video-size-upgrade');
  if (upgradeBtn) { upgradeBtn.classList.remove('active'); upgradeBtn.textContent = '+250 мб (200💎)'; }
  document.querySelectorAll('#platform-buttons .seg').forEach(btn => { btn.disabled = false; btn.title = ''; });
  $('ad-text').innerHTML = '';
  videoFile = null;
  $('video-input').value = '';
  editCost = 0;
  hide($('video-meta'));
  hide($('btn-remove-video'));
  hide($('current-video'));
  commentsEnabled = false;
  $('toggle-comments-ico').className = 'fa-solid fa-toggle-off fa-2xl';
  document.querySelectorAll('#priority-buttons .seg').forEach(x => x.classList.remove('active'));
  const prioFirst = document.querySelector('#priority-buttons .seg:first-child');
  if (prioFirst) prioFirst.classList.add('active');
  selectedPriority = prioFirst ? prioFirst.dataset.value : null;
  document.querySelectorAll('#platform-buttons .seg').forEach(x => x.classList.remove('active'));
  const platFirst = document.querySelector('#platform-buttons .seg:first-child');
  if (platFirst) platFirst.classList.add('active');
  selectedPlatform = platFirst ? platFirst.dataset.value : null;
  document.querySelectorAll('#ad-footer-controls .btn').forEach(x => x.classList.remove('active'));
  const footerTop = $('footer-top');
  if (footerTop) footerTop.classList.add('active');
  footer = 'top';
  show($('ad-footer-empty'));
  hide($('ad-footer-controls'));
}

// Функция для проверки изменений при редактировании rejected рекламы
function checkForChanges() {
  if (editStatus !== 'rejected') return;
  
  const currentData = {
    text: getFormattedText($('ad-text')).trim(),
    priority: selectedPriority,
    platform: selectedPlatform,
    comments: commentsEnabled,
    footer: footer,
    videoUrl: currentVideoUrl
  };
  
  const hasChanges = 
    currentData.text !== originalAdData.text ||
    currentData.priority !== originalAdData.priority ||
    currentData.platform !== originalAdData.platform ||
    currentData.comments !== originalAdData.comments ||
    currentData.footer !== originalAdData.footer ||
    currentData.videoUrl !== originalAdData.videoUrl ||
    videoFile !== null; // Новое видео загружено
  
  $('btn-create-ad').disabled = !hasChanges;
}

// Обновляет превью текста с учётом позиции рекламного текста
function updatePreview() {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const adFooterText = i18n[lang].adFooterText || 'Эта реклама создана на площадке: @buyAdss_bot .';
  const text = getPlainText($('ad-text')) || '';
  const previewEl = $('preview-text');
  if (!previewEl) return;
  let out = '';
  if (footer === 'top') {
    out = adFooterText + '\n\n' + text;
  } else if (footer === 'bottom') {
    out = text + '\n\n' + adFooterText;
  } else { // 'none'
    out = text;
  }
  previewEl.textContent = out;
}

$('toggle-comments').onclick = () => {
  commentsEnabled = !commentsEnabled;
  $('toggle-comments-ico').className = commentsEnabled ? 'fa-solid fa-toggle-on fa-2xl' : 'fa-solid fa-toggle-off fa-2xl';
  checkForChanges();
};

const commentsLabel = document.querySelector('.row--between .field__label[data-i18n="commentsLabel"]');
if (commentsLabel) commentsLabel.onclick = () => $('toggle-comments').click();

function calculateAdCost(priority, platform, footer) {
  const prioCost = document.querySelector(`#priority-buttons .seg[data-value="${priority}"]`)?.dataset.cost || 0;
  const platCost = document.querySelector(`#platform-buttons .seg[data-value="${platform}"]`)?.dataset.cost || 0;
  const footerCost = footer === 'none' ? 10 : 0;
  return parseInt(prioCost) + parseInt(platCost) + footerCost;
}

document.querySelectorAll('#priority-buttons .seg').forEach(b => {
  b.onclick = async () => {
    const lang = localStorage.getItem(LS.lang) || 'ru';
    const cost = parseInt(b.dataset.cost) || 0;
    let confirmed = true;
    if (cost > 0) {
      // When editing, need to check if user has enough crystals (considering what was already spent)
      const availableCrystals = editMode ? currentCrystals + editCost : currentCrystals;
      if (cost > availableCrystals) {
        openModal(i18n[lang].notEnoughCrystals, '');
        return;
      }
      confirmed = await new Promise(resolve => {
        openModal(i18n[lang].confirmTitle, `${i18n[lang].confirmSelect}${b.textContent}${i18n[lang].confirmSelectEnd}${i18n[lang].confirmFor}${formatNumber(cost)}${i18n[lang].confirmCrystals}`, [
          { text: i18n[lang].cancel, class: 'btn btn--ghost', onClick: () => resolve(false) },
          { text: i18n[lang].yes, class: 'btn btn--primary', onClick: () => resolve(true) }
        ]);
      });
    }
    if (!confirmed) return;
    document.querySelectorAll('#priority-buttons .seg').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    selectedPriority = b.dataset.value;
    checkForChanges();
  };
});

document.querySelectorAll('#platform-buttons .seg').forEach(b => {
  b.onclick = async () => {
    if (editingFrozenAd) { const lang = localStorage.getItem(LS.lang) || 'ru'; openModal(i18n[lang].frozenPlatformChange, ''); return; }
    const lang = localStorage.getItem(LS.lang) || 'ru';
    const cost = parseInt(b.dataset.cost) || 0;
    let confirmed = true;
    if (cost > 0) {
      // When editing, need to check if user has enough crystals (considering what was already spent)
      const availableCrystals = editMode ? currentCrystals + editCost : currentCrystals;
      if (cost > availableCrystals) {
        openModal(i18n[lang].notEnoughCrystals, '');
        return;
      }
      confirmed = await new Promise(resolve => {
        openModal(i18n[lang].confirmTitle, `${i18n[lang].confirmSelect}${b.textContent}${i18n[lang].confirmSelectEnd}${i18n[lang].confirmFor}${formatNumber(cost)}${i18n[lang].confirmCrystals}`, [
          { text: i18n[lang].cancel, class: 'btn btn--ghost', onClick: () => resolve(false) },
          { text: i18n[lang].yes, class: 'btn btn--primary', onClick: () => resolve(true) }
        ]);
      });
    }
    if (!confirmed) return;
    document.querySelectorAll('#platform-buttons .seg').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    selectedPlatform = b.dataset.value;
    // Синхронизируем визуальный список площадок
    updatePlatformListActive();
    checkForChanges();
  };
});

// Обновляет визуальный список площадок, добавляет класс selected у выбранного элемента
function updatePlatformListActive() {
  const rows = document.querySelectorAll('#platform-list .platform-row');
  rows.forEach(r => r.classList.remove('selected'));
  if (!selectedPlatform) return;
  const match = Array.from(rows).find(r => r.dataset.value === selectedPlatform);
  if (match) match.classList.add('selected');
}

// Клики по строкам визуального списка: триггерят скрытые кнопки для логики
document.addEventListener('click', (e) => {
  const row = e.target.closest && e.target.closest('.platform-row');
  if (!row || row.classList.contains('platform-header')) return;
  const val = row.dataset.value;
  if (!val) return;
  const btn = document.querySelector(`#platform-buttons .seg[data-value="${val}"]`);
  if (btn) btn.click();
});

$('btn-pick-video').onclick = () => $('video-input').click();
$('btn-video-size-upgrade').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (!videoSizeUpgrade) {
    const availableCrystals = editMode ? currentCrystals + editCost : currentCrystals;
    if (availableCrystals < 200) { openModal(i18n[lang].notEnoughCrystals || 'Недостаточно кристаллов', ''); return; }
    videoSizeUpgrade = true;
    $('btn-video-size-upgrade').classList.add('active');
    $('btn-video-size-upgrade').textContent = i18n[lang].videoUpgradeActive;
  } else {
    videoSizeUpgrade = false;
    $('btn-video-size-upgrade').classList.remove('active');
    $('btn-video-size-upgrade').textContent = '+250 мб (200💎)';
    const file = $('video-input').files[0];
    if (file && file.size > 250 * 1024 * 1024) {
      videoFile = null; $('video-input').value = ''; hide($('video-meta')); hide($('btn-remove-video'));
      openModal(i18n[localStorage.getItem(LS.lang) || 'ru'].videoMaxSizeDefault, '');
    }
  }
};
$('video-input').onchange = e => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const f = e.target.files[0];
  if (!f) return;
  if (!f.type.startsWith('video/')) {
    openModal(i18n[lang].onlyVideoFiles, '');
    return;
  }
  const maxVideoSize = videoSizeUpgrade ? 500 * 1024 * 1024 : 250 * 1024 * 1024;
  if (f.size > maxVideoSize) {
    openModal(videoSizeUpgrade ? i18n[lang].videoMaxSizeUpgraded : i18n[lang].videoMaxSizeDefault, '');
    e.target.value = '';
    return;
  }
  const video = document.createElement('video');
  video.src = URL.createObjectURL(f);
  video.onloadedmetadata = () => {
    const dur = Math.round(video.duration);
    if (dur < 5 || dur > 60) {
      openModal(i18n[lang].duration5to60, '');
      return;
    }
    $('video-duration').textContent = dur + 's';
  };
  videoFile = f;
  $('video-name').textContent = f.name;
  $('video-size').textContent = (f.size / 1024 / 1024).toFixed(1) + ' MB';
  show($('video-meta'));
  show($('btn-remove-video'));
  hide($('current-video'));
};

$('btn-remove-video').onclick = () => {
  videoFile = null;
  $('video-input').value = '';
  hide($('video-meta'));
  hide($('btn-remove-video'));
  if (editMode && currentVideoUrl) show($('current-video'));
};

/* ========== TEXT FORMATTING (MODERN) ========== */
const FORMAT_SYMBOLS = {
  bold: { open: '**', close: '**' },
  italic: { open: '//*', close: '**//' },
  monospace: { open: '``', close: '``' },
  strikethrough: { open: '~~', close: '~~' },
  underline: { open: '++', close: '++' }
};

function getPlainText(element) {
  return element.innerText || element.textContent || '';
}

function getFormattedText(element) {
  let text = '';
  for (let node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const format = node.getAttribute('data-format');
      if (format) {
        const symbols = FORMAT_SYMBOLS[format];
        text += symbols.open + node.textContent + symbols.close;
      } else {
        text += node.textContent;
      }
    }
  }
  return text;
}

// Parse formatted text with symbols into HTML with styled spans
function parseFormattedText(text) {
  if (!text) return '';
  
  let html = text;
  
  // Replace bold: **text** → <span data-format="bold">text</span>
  html = html.replace(/\*\*(.+?)\*\*/g, '<span data-format="bold">$1</span>');
  
  // Replace italic: //*text*// → <span data-format="italic">text</span>
  html = html.replace(/\/\/\*(.+?)\*\/\//g, '<span data-format="italic">$1</span>');
  
  // Replace monospace: ``text`` → <span data-format="monospace">text</span>
  html = html.replace(/``(.+?)``/g, '<span data-format="monospace">$1</span>');
  
  // Replace strikethrough: ~~text~~ → <span data-format="strikethrough">text</span>
  html = html.replace(/~~(.+?)~~/g, '<span data-format="strikethrough">$1</span>');
  
  // Replace underline: ++text++ → <span data-format="underline">text</span>
  html = html.replace(/\+\+(.+?)\+\+/g, '<span data-format="underline">$1</span>');
  
  return html;
}

function updateFormatButtonsState() {
  const editor = $('ad-text');
  const selection = window.getSelection();

  if (!editor || !selection || selection.rangeCount === 0 || selection.isCollapsed) {
    document.querySelectorAll('.format-btn-modern').forEach(btn => {
      btn.disabled = true;
      btn.classList.remove('active');
    });
    return;
  }

  const range = selection.getRangeAt(0);
  const activeFormats = new Set();

  if (range.toString().trim()) {
    const formattedNodes = editor.querySelectorAll('[data-format]');

    formattedNodes.forEach(node => {
      if (!node || !node.textContent) return;

      try {
        if (range.intersectsNode(node)) {
          const format = node.getAttribute('data-format');
          if (format) activeFormats.add(format);
        }
      } catch (e) {
        // Ignore edge cases for partial/off-by-one selection boundaries.
      }
    });
  }

  document.querySelectorAll('.format-btn-modern').forEach(btn => {
    const formatType = btn.dataset.format;
    const isActive = activeFormats.has(formatType);
    btn.disabled = !range.toString().trim();
    btn.classList.toggle('active', isActive);
  });
}

function applyFormatting(formatType) {
  const editor = $('ad-text');
  const selection = window.getSelection();
  
  if (!selection.rangeCount) return;
  
  const range = selection.getRangeAt(0);
  const selectedText = selection.toString();
  
  if (!selectedText) return;
  
  const format = FORMAT_SYMBOLS[formatType];
  if (!format) return;
  
  // Find all format spans that intersect with the selection
  const allFormattedNodes = Array.from(editor.querySelectorAll('[data-format]'));
  const intersectingFormats = new Set();
  
  allFormattedNodes.forEach(node => {
    try {
      if (range.intersectsNode(node)) {
        const fmt = node.getAttribute('data-format');
        if (fmt) intersectingFormats.add(fmt);
      }
    } catch (e) {
      // ignore edge cases
    }
  });
  
  // Check if we need to REMOVE or ADD the format
  const formatExists = intersectingFormats.has(formatType);
  
  if (formatExists) {
    // REMOVE the format: unwrap all spans with this format that intersect selection
    allFormattedNodes.forEach(node => {
      if (node.getAttribute('data-format') === formatType) {
        try {
          if (range.intersectsNode(node)) {
            // Unwrap: move all children up to parent level, preserving other formats
            while (node.firstChild) {
              node.parentElement.insertBefore(node.firstChild, node);
            }
            node.remove();
          }
        } catch (e) {
          // ignore
        }
      }
    });
  } else {
    // ADD the format: wrap selection in a new span, preserving existing formats
    const span = document.createElement('span');
    span.setAttribute('data-format', formatType);
    
    try {
      const contents = range.extractContents();
      span.appendChild(contents);
      range.insertNode(span);
      
      // Keep text selected after adding format
      const newRange = document.createRange();
      newRange.selectNodeContents(span);
      selection.removeAllRanges();
      selection.addRange(newRange);
    } catch (e) {
      console.warn('Formatting error:', e);
    }
  }
  
  editor.dispatchEvent(new Event('input', { bubbles: true }));
  updateFormatButtonsState();
}

document.querySelectorAll('.format-btn-modern').forEach(btn => {
  btn.onclick = (e) => {
    e.preventDefault();
    const formatType = btn.dataset.format;
    applyFormatting(formatType);
    $('ad-text').focus();
  };
});

document.addEventListener('selectionchange', updateFormatButtonsState);
$('ad-text').addEventListener('mouseup', updateFormatButtonsState);
$('ad-text').addEventListener('keyup', updateFormatButtonsState);
$('ad-text').addEventListener('input', () => {
  const text = getPlainText($('ad-text'));
  const count = text.length;
  const charCountEl = document.getElementById('char-count');
  if (charCountEl) {
    charCountEl.textContent = Math.min(count, 500);
  }
});

$('ad-text').oninput = () => {
  const text = getPlainText($('ad-text')).trim();
  const valid = text.length > 0 && text.length <= 500 && /(https:\/\/|t\.me\/|@)/i.test(text);
  if (valid) {
    hide($('ad-footer-empty'));
    show($('ad-footer-controls'));
    updatePreview();
  } else {
    show($('ad-footer-empty'));
    hide($('ad-footer-controls'));
  }
  checkForChanges();
  updateFormatButtonsState();
};
$('footer-top').onclick = () => {
  document.querySelectorAll('#ad-footer-controls .btn').forEach(x => x.classList.remove('active'));
  $('footer-top').classList.add('active');
  footer = 'top';
  updatePreview();
  checkForChanges();
};
$('footer-bottom').onclick = () => {
  document.querySelectorAll('#ad-footer-controls .btn').forEach(x => x.classList.remove('active'));
  $('footer-bottom').classList.add('active');
  footer = 'bottom';
  updatePreview();
  checkForChanges();
};
$('footer-remove').onclick = async () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const cost = 10;
  let confirmed = true;
  const availableCrystals = editMode ? currentCrystals + editCost : currentCrystals;
  if (cost > availableCrystals) {
    openModal(i18n[lang].notEnoughCrystals, '');
    return;
  }
  confirmed = await new Promise(resolve => {
    openModal(i18n[lang].confirmTitle, `${i18n[lang].confirmSelect}${$('footer-remove').textContent}${i18n[lang].confirmSelectEnd}${i18n[lang].confirmFor}${cost}${i18n[lang].confirmCrystals}`, [
      { text: i18n[lang].cancel, class: 'btn btn--ghost', onClick: () => resolve(false) },
      { text: i18n[lang].yes, class: 'btn btn--primary', onClick: () => resolve(true) }
    ]);
  });
  if (!confirmed) return;
  document.querySelectorAll('#ad-footer-controls .btn').forEach(x => x.classList.remove('active'));
  $('footer-remove').classList.add('active');
  footer = 'none';
  updatePreview();
};

$('btn-create-ad').onclick = async () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';

  if (isCreateAdsDisabledGlobally()) {
    showFeatureBlockedModal('create');
    return;
  }

  const plainText = getPlainText($('ad-text')).trim();
  if (!plainText) return openModal(i18n[lang].adTextRequired, '');
  if (!/(https:\/\/|t\.me\/|@)/i.test(plainText)) return openModal(i18n[lang].linkRequired, '');
  if (!videoFile && !editMode) return openModal(i18n[lang].videoRequired, '');
  if (!selectedPriority || !selectedPlatform) return openModal(i18n[lang].selectPrioAndPlat, '');

  const newTotalCost = calculateAdCost(selectedPriority, selectedPlatform, footer) + (videoSizeUpgrade ? 200 : 0);

  let costDifference = 0;
  if (editMode) {
    costDifference = newTotalCost - editCost;
    if (costDifference > currentCrystals) return openModal(i18n[lang].notEnoughCrystals, '');
  } else {
    if (newTotalCost > currentCrystals) return openModal(i18n[lang].notEnoughCrystals, '');
  }

  showPreloader();

  let adName = (editMode && editStatus !== 'rejected') ? editName : 'Ad_' + rand(12);
  let url = editMode && editStatus !== 'rejected' ? (editStatus === 'pending' ? GAS_SYS_URL : GAS_ADS_URL) : GAS_SYS_URL;
  let action = editMode && editStatus !== 'rejected' ? (editStatus === 'pending' ? 'updatePending' : 'updateAd') : 'saveAd';

  try {
    if (!editMode) {
      const userIp = await getClientIp();
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: BOT_CHAT_ID,
          text: `🆕 Новая реклама! \n
          Название рекламы: ${adName} \n
          Telegram ID создателя этой рекламы: ${getUserID()} \n
          IP-адрес создателя этой рекламы: ${userIp || 'unknown'}. \n
          Токен создателя этой рекламы: ${localStorage.getItem('get_UserToken')}`
        })
      });
    }

    let base64 = null;
    if (videoFile) {
      base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(videoFile);
      });
    }

    // Get formatted text with symbols
    const text = getFormattedText($('ad-text'));

    const params = new URLSearchParams({
      action, text, platform: selectedPlatform, name: adName,
      comments: commentsEnabled ? 1 : 0,
      userID: getUserID(), token: USER_TOKEN,
      priority: selectedPriority, footer, cost: newTotalCost
    });

    if (videoFile) {
      params.append('videoMimeType', videoFile.type);
      params.append('videoFilename', videoFile.name);
    }

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'   // ← это решает проблему CORS preflight
      },
      body: base64 || ''   // если видео нет — отправляем пустую строку
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.error || 'Failed to save');

    if (editMode && editStatus !== 'rejected') {
      if (costDifference > 0) {
        if (!await updateCrystalsInGAS(costDifference, false)) {
          throw new Error('Failed to deduct crystals');
        }
      }
    } else {
      if (!await updateCrystalsInGAS(newTotalCost, false)) {
        throw new Error('Failed to deduct crystals');
      }
    }

    $('crystals-count').textContent = formatNumber(currentCrystals);
    $('crystals-now').textContent = formatNumber(currentCrystals);
    $('crystals-in-create').textContent = formatNumber(currentCrystals);

    // ✅ Правильный вызов: OK и закрытие модалки → вернуться на нужный экран
    const successMsg = editMode ? i18n[lang].adEdited : i18n[lang].adSentForReview;
    const returnCallback = () => {
      if (editMode && previousEditScreen === 'screen-myads') {
        hidePreloader(); // Явно скрываем прелоадер перед показом экрана
        hideAllScreens();
        show($('screen-myads'));
        loadMyAds(true); // skipPreloader = true
        previousEditScreen = null;
      } else {
        hidePreloader();
        showMainMenu();
      }
    };
    openModal(
      i18n[lang].doneTitle,
      successMsg,
      [{ text: 'OK', onClick: returnCallback }],
      { onClose: returnCallback }
    );

  } catch (e) {
    openModal(i18n[lang].failedToSaveAd + (e.message ? `: ${e.message}` : ''), '');
  } finally {
    hidePreloader();
  }
};

async function loadEditAd(ad) {
  editingFrozenAd = String(ad.platform) === '2';
  document.querySelectorAll('#platform-buttons .seg').forEach(btn => { btn.disabled = false; btn.title = ''; });
  selectedPlatform = editingFrozenAd ? '2' : ad.platform;
  editCost = ad.cost || 0; // Store the cost of the current ad being edited
  
  // Сохраняем оригинальные данные для отслеживания изменений
  originalAdData = {
    text: ad.text,
    priority: ad.priority,
    platform: ad.platform,
    comments: ad.comments == 1,
    footer: ad.footer || 'top',
    videoUrl: ad.videoUrl || ''
  };
  
  // Set ad name in the screen title or create a display element
  const screenTitle = document.querySelector('#screen-create .screen__title');
  if (screenTitle) {
    const lang = localStorage.getItem(LS.lang) || 'ru';
    screenTitle.textContent = `${i18n[lang].editTitle || 'Редактировать рекламу'}: ${ad.name}`;
  }
  
  const adTextEditor = $('ad-text');
  const adTextField = adTextEditor.closest('.field');
  if (adTextField) adTextField.hidden = false;
  adTextEditor.hidden = false;
  adTextEditor.style.display = 'block';
  adTextEditor.innerHTML = parseFormattedText(ad.text || '');
  document.querySelectorAll('.format-toolbar-modern, .format-toolbar').forEach(toolbar => {
    toolbar.hidden = false;
    toolbar.style.display = 'flex';
  });
  currentVideoUrl = ad.videoUrl || '';
  const currentVideo = $('current-video') || document.createElement('div');
  currentVideo.id = 'current-video';
  if (currentVideoUrl) {
    currentVideo.innerHTML = `<a href="${currentVideoUrl}" target="_blank">${i18n[localStorage.getItem(LS.lang) || 'ru'].videoLabel}</a>`;
    const videoField = document.querySelector('.field [data-i18n="videoLabel"]').parentNode;
    videoField.appendChild(currentVideo);
    show(currentVideo);
  }
  commentsEnabled = ad.comments == 1;
  $('toggle-comments-ico').className = commentsEnabled ? 'fa-solid fa-toggle-on fa-2xl' : 'fa-solid fa-toggle-off fa-2xl';
  const prioBtn = document.querySelector(`#priority-buttons .seg[data-value="${ad.priority}"]`);
  if (prioBtn) {
    document.querySelectorAll('#priority-buttons .seg').forEach(x => x.classList.remove('active'));
    prioBtn.classList.add('active');
    selectedPriority = ad.priority;
  }
  const platBtn = document.querySelector(`#platform-buttons .seg[data-value="${ad.platform}"]`);
  if (platBtn) {
    document.querySelectorAll('#platform-buttons .seg').forEach(x => x.classList.remove('active'));
    platBtn.classList.add('active');
    selectedPlatform = ad.platform;
  }
  document.querySelectorAll('#ad-footer-controls .btn').forEach(x => x.classList.remove('active'));
  if (ad.footer) {
    const footerBtn = $(`footer-${ad.footer}`);
    if (footerBtn) footerBtn.classList.add('active');
    footer = ad.footer;
  } else {
    const footerTop = $('footer-top');
    if (footerTop) footerTop.classList.add('active');
    footer = 'top';
  }
  if (editStatus === 'approved') {
    const footerField = document.querySelector('.field [data-i18n="adFooterLabel"]').parentNode;
    if (footerField) footerField.hidden = true;
  }
  if (getPlainText($('ad-text'))) {
    hide($('ad-footer-empty'));
    show($('ad-footer-controls'));
  }
  
  // Для rejected рекламы отключаем кнопку, пока нет изменений
  if (editStatus === 'rejected') {
    $('btn-create-ad').disabled = true;
  }
}

// Helper to initialize token display in settings
function initTokenDisplay() {
  const token = localStorage.getItem(LS.token);
  const tokenEl = $('user-token');
  const btnCopy = $('btn-copy-token');
  if (!tokenEl || !btnCopy) return;
  
  // Show masked token with dots
  const masked = '•'.repeat(token.length);
  tokenEl.textContent = masked;
  tokenEl.dataset.revealed = 'false';
  
  // Update button text to "Show"
  const span = btnCopy.querySelector('span');
  if (span) {
    const lang = localStorage.getItem(LS.lang) || 'ru';
    span.textContent = i18n[lang].show || 'Показать';
    span.dataset.isShow = 'true';
  }
}

// Helper to initialize Telegram ID display in settings
function initTelegramIdDisplay() {
  const telegramIdEl = $('user-telegram-id');
  const btnCopyTelegramId = $('btn-copy-telegram-id');
  const lang = localStorage.getItem(LS.lang) || 'ru';
  
  if (!telegramIdEl || !btnCopyTelegramId) return;
  
  if (!hasTelegramId) {
    // Show "Not defined" when Telegram ID doesn't exist (only fallback)
    telegramIdEl.textContent = i18n[lang].notDefined || 'Не определено';
    telegramIdEl.dataset.revealed = 'true';
    btnCopyTelegramId.disabled = true;
    const span = btnCopyTelegramId.querySelector('span');
    if (span) span.textContent = i18n[lang].copy || 'Копировать';
  } else {
    // Show masked Telegram ID with dots
    const masked = '•'.repeat(String(telegramUserId).length);
    telegramIdEl.textContent = masked;
    telegramIdEl.dataset.revealed = 'false';
    btnCopyTelegramId.disabled = false;
    
    // Update button text to "Show"
    const span = btnCopyTelegramId.querySelector('span');
    if (span) {
      span.textContent = i18n[lang].show || 'Показать';
      span.dataset.isShow = 'true';
    }
  }
}

/* ========== SETTINGS ========== */
$('btn-copy-token').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const token = localStorage.getItem(LS.token);
  const tokenEl = $('user-token');
  const span = $('btn-copy-token').querySelector('span');
  const isRevealed = tokenEl.dataset.revealed === 'true';
  
  if (!isRevealed) {
    // Show token
    tokenEl.textContent = token;
    tokenEl.dataset.revealed = 'true';
    if (span) span.textContent = i18n[lang].copy || 'Скопировать';
  } else {
    // Copy token to clipboard
    navigator.clipboard.writeText(token).then(() => {
      if (span) {
        span.textContent = i18n[lang].copied || 'Скопировано';
        setTimeout(() => { 
          span.textContent = i18n[lang].copy || 'Скопировать'; 
        }, 3000);
      }
    }).catch(() => {
      openModal(i18n[lang].failedToCopy, '');
    });
  }
};

$('btn-copy-telegram-id').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const telegramId = String(telegramUserId);
  const telegramIdEl = $('user-telegram-id');
  const span = $('btn-copy-telegram-id').querySelector('span');
  const isRevealed = telegramIdEl.dataset.revealed === 'true';
  
  // If Telegram ID is not defined (only fallback), do nothing
  if (!hasTelegramId) return;
  
  if (!isRevealed) {
    // Show Telegram ID
    telegramIdEl.textContent = telegramId;
    telegramIdEl.dataset.revealed = 'true';
    if (span) span.textContent = i18n[lang].copy || 'Скопировать';
  } else {
    // Copy Telegram ID to clipboard
    navigator.clipboard.writeText(telegramId).then(() => {
      if (span) {
        span.textContent = i18n[lang].copied || 'Скопировано';
        setTimeout(() => { 
          span.textContent = i18n[lang].copy || 'Скопировать'; 
        }, 3000);
      }
    }).catch(() => {
      openModal(i18n[lang].failedToCopy, '');
    });
  }
};

document.querySelectorAll('#settings-lang-buttons .seg').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#settings-lang-buttons .seg').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const lang = b.dataset.value;
    localStorage.setItem(LS.lang, lang);
    applyLang(lang);
  };
});

document.querySelectorAll('#settings-theme-buttons .seg').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#settings-theme-buttons .seg').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const theme = b.dataset.value;
    localStorage.setItem(LS.theme, theme);
    applyTheme(theme);
  };
});

// App size (fullscreen) setting
const APP_SIZE_LS = 'appSize';

function applyAppSize(size) {
  if (!tg) return;
  const isiPhone = /iPhone/i.test(navigator.userAgent);
  if (size === 'fullscreen') {
    try {
      // use modern requestFullscreen if available
      if (typeof tg.requestFullscreen === 'function') {
        tg.requestFullscreen();
      } else if (typeof tg.web_app_request_fullscreen === 'function') {
        tg.web_app_request_fullscreen();
      } else if (typeof tg.request_fullscreen === 'function') {
        tg.request_fullscreen();
      }
    } catch (e) {
      console.warn('fullscreen request failed', e);
    }
    if (isiPhone) document.body.classList.add('iphone-fullscreen');
  } else {
    try {
      // exit: first try expand to restore original size, then exitFullscreen
      if (typeof tg.expand === 'function') {
        tg.expand();
      }
      if (typeof tg.exitFullscreen === 'function') {
        tg.exitFullscreen();
      } else if (typeof tg.exit_fullscreen === 'function') {
        tg.exit_fullscreen();
      } else if (typeof tg.exitFullScreen === 'function') {
        tg.exitFullScreen();
      }
    } catch (e) {
      console.warn('exit fullscreen failed', e);
    }
    if (isiPhone) document.body.classList.remove('iphone-fullscreen');
  }
}

document.querySelectorAll('#settings-size-buttons .seg').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#settings-size-buttons .seg').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const size = b.dataset.value;
    localStorage.setItem(APP_SIZE_LS, size);
    applyAppSize(size);
  };
});

/* ========== CLOSING CONFIRMATION SETTING ========== */
const CLOSING_CONFIRMATION_LS = 'closingConfirmationEnabled';

function applyClosingConfirmation(enabled) {
  if (!tg) return;
  if (enabled) {
    tg.enableClosingConfirmation();
  } else {
    tg.disableClosingConfirmation();
  }
}

document.querySelectorAll('#settings-closing-confirmation-buttons .seg').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#settings-closing-confirmation-buttons .seg').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const enabled = b.dataset.value === 'enable';
    localStorage.setItem(CLOSING_CONFIRMATION_LS, enabled ? 'true' : 'false');
    applyClosingConfirmation(enabled);
  };
});

/* ========== SETTINGS BUTTON POSITION SETTING ========== */
const SETTINGS_BTN_POSITION_LS = 'settingsButtonPosition';

function applySettingsButtonPosition(offset) {
  const btn = $('btn-open-settings');
  if (!btn) return;
  btn.style.marginRight = (-offset) + 'px';
}

const settingsButtonPositionInput = $('settings-button-position');
const settingsButtonPositionNumber = $('settings-button-position-number');
if (settingsButtonPositionInput) {
  settingsButtonPositionInput.oninput = () => {
    const offset = parseInt(settingsButtonPositionInput.value);
    const valueSpan = $('settings-button-position-value');
    if (valueSpan) valueSpan.textContent = offset + 'px';
    if (settingsButtonPositionNumber) settingsButtonPositionNumber.value = offset;
    localStorage.setItem(SETTINGS_BTN_POSITION_LS, offset);
    applySettingsButtonPosition(offset);
  };
}

if (settingsButtonPositionNumber) {
  settingsButtonPositionNumber.onchange = () => {
    const min = parseInt(settingsButtonPositionNumber.min);
    const max = parseInt(settingsButtonPositionNumber.max);
    const offset = Math.min(max, Math.max(min, parseInt(settingsButtonPositionNumber.value) || 0));
    settingsButtonPositionNumber.value = offset;
    settingsButtonPositionInput.value = offset;
    localStorage.setItem(SETTINGS_BTN_POSITION_LS, offset);
    applySettingsButtonPosition(offset);
  };
}

/* ========== APP TITLE POSITION SETTING ========== */
const APP_TITLE_POSITION_LS = 'appTitlePosition';

function applyAppTitlePosition(offset) {
  const appmark = $('app-title')?.closest('.appmark');
  if (!appmark) return;
  appmark.style.marginLeft = offset + 'px';
}

const appTitlePositionInput = $('app-title-position');
const appTitlePositionNumber = $('app-title-position-number');
if (appTitlePositionInput) {
  appTitlePositionInput.oninput = () => {
    const offset = parseInt(appTitlePositionInput.value);
    const valueSpan = $('app-title-position-value');
    if (valueSpan) valueSpan.textContent = offset + 'px';
    if (appTitlePositionNumber) appTitlePositionNumber.value = offset;
    localStorage.setItem(APP_TITLE_POSITION_LS, offset);
    applyAppTitlePosition(offset);
  };
}

if (appTitlePositionNumber) {
  appTitlePositionNumber.onchange = () => {
    const min = parseInt(appTitlePositionNumber.min);
    const max = parseInt(appTitlePositionNumber.max);
    const offset = Math.min(max, Math.max(min, parseInt(appTitlePositionNumber.value) || 0));
    appTitlePositionNumber.value = offset;
    appTitlePositionInput.value = offset;
    localStorage.setItem(APP_TITLE_POSITION_LS, offset);
    applyAppTitlePosition(offset);
  };
}

/* ========== INIT SETTINGS SCREEN ========== */
function initSettingsScreen() {
  // Initialize closing confirmation setting
  const closingConfirmationEnabled = localStorage.getItem(CLOSING_CONFIRMATION_LS) === 'true';
  const closingConfirmationValue = closingConfirmationEnabled ? 'enable' : 'disable';
  document.querySelectorAll('#settings-closing-confirmation-buttons .seg').forEach(b => {
    if (b.dataset.value === closingConfirmationValue) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });

  // Initialize settings button position
  const settingsButtonPosition = parseInt(localStorage.getItem(SETTINGS_BTN_POSITION_LS) || '0');
  const settingsButtonInput = $('settings-button-position');
  if (settingsButtonInput) {
    settingsButtonInput.value = settingsButtonPosition;
    if (settingsButtonPositionNumber) settingsButtonPositionNumber.value = settingsButtonPosition;
    const valueSpan = $('settings-button-position-value');
    if (valueSpan) valueSpan.textContent = settingsButtonPosition + 'px';
    applySettingsButtonPosition(settingsButtonPosition);
  }

  // Initialize app title position
  const appTitlePosition = parseInt(localStorage.getItem(APP_TITLE_POSITION_LS) || '0');
  const appTitleInput = $('app-title-position');
  if (appTitleInput) {
    appTitleInput.value = appTitlePosition;
    if (appTitlePositionNumber) appTitlePositionNumber.value = appTitlePosition;
    const valueSpan = $('app-title-position-value');
    if (valueSpan) valueSpan.textContent = appTitlePosition + 'px';
    applyAppTitlePosition(appTitlePosition);
  }
}

/* ========== MY ADS ========== */
const FREEZE_AD_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyHpEYf3sv7CGlAJ6c3vTdMw4TfLjCeeli90dtQFiA4EDc_ua30JEFPq7aAqV4wvDdG/exec';
const FROZEN_AD_PLATFORMS_LS = 'frozenAdPlatforms';

function getFrozenAdPlatforms() {
  try {
    return JSON.parse(localStorage.getItem(FROZEN_AD_PLATFORMS_LS) || '{}');
  } catch {
    return {};
  }
}

function saveFrozenAdPlatform(adName, platform) {
  const platforms = getFrozenAdPlatforms();
  platforms[adName] = platform;
  localStorage.setItem(FROZEN_AD_PLATFORMS_LS, JSON.stringify(platforms));
}

async function sendFreezeRequest(payload) {
  const response = await fetch(FREEZE_AD_WEB_APP_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'follow'
  });
  const data = await response.json();
  if (data.status !== 'success') {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

async function toggleAdFreeze(ad, button) {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const frozen = String(ad.platform) === '2';
  button.disabled = true;
  showPreloader();

  try {
    if (frozen) {
      const originalPlatform = getFrozenAdPlatforms()[ad.name];
      if (!originalPlatform) {
        throw new Error(i18n[lang].originalPlatformUnavailable);
      }
      await sendFreezeRequest({
        action: 'getBack',
        search: getUserID(),
        change: originalPlatform
      });
      ad.platform = originalPlatform;
      const platforms = getFrozenAdPlatforms();
      delete platforms[ad.name];
      localStorage.setItem(FROZEN_AD_PLATFORMS_LS, JSON.stringify(platforms));
      button.textContent = i18n[lang].freeze;
      const platformText = button.closest('.ad-card')?.querySelector('.ad-platform-value');
      if (platformText) platformText.textContent = originalPlatform;
    } else {
      saveFrozenAdPlatform(ad.name, ad.platform);
      await sendFreezeRequest({ searchValue: getUserID() });
      ad.platform = '2';
      button.textContent = i18n[lang].unfreeze;
      const platformText = button.closest('.ad-card')?.querySelector('.ad-platform-value');
      if (platformText) platformText.textContent = i18n[lang].nowhere;
    }
    const statusText = button.closest('.ad-card')?.querySelector('.ad-status-value');
    if (statusText) {
      statusText.textContent = String(ad.platform) === '2'
        ? i18n[lang].frozenStatus
        : i18n[lang].approvedStatus;
    }
    openModal(i18n[lang].doneTitle, i18n[lang].freezeSuccess);
  } catch (error) {
    openModal(i18n[lang].attentionTitle, `${i18n[lang].freezeError}: ${error.message}`);
  } finally {
    button.disabled = false;
    hidePreloader();
  }
}

function openAdStatistics(ad) {
  statisticsPreviousScreen = document.querySelector('.screen:not([hidden])')?.id || 'screen-myads';
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const views = ad.views || 0;
  const clicks = ad.linkClicks || 0;
  $('ad-statistics-name').textContent = ad.name || '—';
  const createdField = $('ad-statistics-created-field');
  const createdLabel = $('ad-statistics-created');
  const rawCreatedDate = ad.createdAt || ad.created_at || ad.createdDate || ad.dateCreated || ad.creationDate || ad.timestamp || ad.created || ad.date || '';
  let createdDate = null;
  if (rawCreatedDate !== '') {
    const candidate = typeof rawCreatedDate === 'number' && rawCreatedDate < 1000000000000 ? new Date(rawCreatedDate * 1000) : new Date(rawCreatedDate);
    if (!Number.isNaN(candidate.getTime())) createdDate = candidate;
  }
  if (createdDate && createdField && createdLabel) {
    createdLabel.textContent = 'Реклама создана в: ' + String(createdDate.getDate()).padStart(2, '0') + '.' + String(createdDate.getMonth() + 1).padStart(2, '0') + '.' + createdDate.getFullYear();
    createdField.hidden = false;
  } else if (createdField) createdField.hidden = true;
  $('ad-statistics-views').textContent = formatNumber(views);
  $('ad-statistics-clicks').textContent = `${formatNumber(clicks)} ${pluralClicks(clicks, lang)}`;
  hideAllScreens();
  show($('screen-ad-statistics'));
}

async function loadMyAds(skipPreloader = false) {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (!skipPreloader) showPreloader();
  const list = $('myads-list');
  if (isGasDisabled()) {
    list.innerHTML = '';
    show($('myads-empty'));
    if (!skipPreloader) hidePreloader();
    return;
  }
  
  // Не очищаем список если это скрытая загрузка в фоне
  if (!skipPreloader) {
    list.innerHTML = '';
  }
  
  try {
    const pendingRes = await fetch(`${GAS_SYS_URL}?action=getMyPending&userID=${getUserID()}`);
    const pending = await pendingRes.json();
    const approvedRes = await fetch(`${GAS_ADS_URL}?action=getMyAds&userID=${getUserID()}`);
    const approved = await approvedRes.json();
    const allAds = [...pending, ...approved];
    
    // Теперь обновляем список (очищаем только перед заполнением)
    list.innerHTML = '';
    
    if (allAds.length === 0) {
      show($('myads-empty'));
    } else {
      hide($('myads-empty'));
      allAds.forEach(ad => {
        const status = ad.status || 'approved';
        const statusClass = status === 'pending' ? 'pill--pending' : (status === 'rejected' ? 'pill--danger' : 'pill--success');
        const frozen = String(ad.platform) === '2';
        const statusText = frozen && status === 'approved'
          ? i18n[lang].frozenStatus
          : (i18n[lang][status + 'Status'] || status);
        const commentsText = ad.comments == 1 ? i18n[lang].enabled : i18n[lang].disabled;
        const footerText = !ad.footer ? i18n[lang].noFooter : (ad.footer === 'top' ? i18n[lang].footerTop : i18n[lang].footerBottom);
        const platformDisplay = frozen ? i18n[lang].nowhere : ad.platform;
        const platformRow = document.querySelector(`#platform-list .platform-row[data-value="${ad.platform}"]`);
        const platformUsers = platformRow ? ` (${platformRow.querySelector('div:last-child').textContent})` : '';
        const rejectionReason = String(ad.rejectionReason || ad.rejectReason || ad.reasonOfRejection || '').trim();
        const reviewerName = String(ad.reviewedBy || ad.checkedBy || ad.adminName || '').trim() || (i18n[lang].adminNameHidden || (lang === 'ru' ? 'Администратор' : 'Administrator'));

        const card = document.createElement('div');
        card.className = 'card ad-card';
        card.innerHTML = `
          <p><strong>${i18n[lang].adName}:</strong> <span>${ad.name}</span>
            <button class="btn btn--ghost copy-name-btn" type="button" style="padding: 4px 8px; font-size: 12px; margin-left: 8px;">
              <i class="fa-solid fa-copy"></i>
            </button>
          </p>
          <p><strong>${i18n[lang].adTextLabel}:</strong> <span class="ad-text-formatted">${parseFormattedText(ad.text)}</span></p>
          <p><strong>${i18n[lang].videoLabel}:</strong> <a href="${ad.videoUrl}" target="_blank">ссылка</a></p>
          <p><strong>${i18n[lang].footerLabel}:</strong> ${footerText}</p>
          <p><strong>${i18n[lang].platformLabel}:</strong> <span class="ad-platform-value">${platformDisplay}</span> ${frozen ? '' : platformUsers}</p>
          <p><strong>${i18n[lang].priorityLabel}:</strong> ${ad.priority}</p>
          <p><strong>${i18n[lang].commentsLabel}:</strong> ${commentsText}</p>
          <p><strong>${i18n[lang].status}:</strong> <span class="ad-status-value">${statusText}</span></p>
${status === 'rejected' && rejectionReason ? `<p><strong>${i18n[lang].rejectedReasonLabel || 'Причина отказа'}:</strong> ${rejectionReason}</p><p><strong>${i18n[lang].reviewedByLabel || 'Проверен админом'}:</strong> ${reviewerName}</p>` : ''}
          <div class="row" style="gap: 8px; margin-top: 12px;">
            <button class="btn btn--ghost edit-btn" style="flex: 1;">${i18n[lang].edit}</button>
            <button class="btn btn--danger delete-btn" style="flex: 1;" ${status === 'pending' ? 'disabled' : ''}>${i18n[lang].delete}</button>
          </div>
          ${status === 'approved' ? `<div class="row row--wrap ad-actions-secondary"><button class="btn statistics-btn" type="button">${i18n[lang].statistics}</button><button class="btn freeze-btn" type="button">${frozen ? i18n[lang].unfreeze : i18n[lang].freeze}</button></div>` : ''}
        `;
        
        // Copy name button
        card.querySelector('.copy-name-btn').onclick = () => {
          navigator.clipboard.writeText(ad.name).then(() => {
            const btn = card.querySelector('.copy-name-btn');
            const originalHTML = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => {
              btn.innerHTML = originalHTML;
            }, 2000);
          });
        };
        
        card.querySelector('.edit-btn').onclick = () => {
          const token = localStorage.getItem(LS.token);
          const isBannedFromAds = banForeverAds.includes(token) || runtimeArray('BlockCreateAds', []).includes(token);
          if (isEditingDisabledGlobally()) {
            showFeatureBlockedModal('edit');
            return;
          }
          if (isBannedFromAds) {
            showFeatureBlockedModal('create');
            return;
          }
          editMode = true;
          editName = ad.name;
          editStatus = status;
          previousEditScreen = 'screen-myads'; // Remember we came from My Ads
          hideAllScreens();
          show($('screen-create'));
          $('btn-create-ad').querySelector('span').textContent = i18n[lang].saveChanges;
          $('crystals-in-create').textContent = formatNumber(currentCrystals);
          loadEditAd(ad);
        };
        if (status === 'approved') {
          card.querySelector('.statistics-btn').onclick = () => openAdStatistics(ad);
          card.querySelector('.freeze-btn').onclick = () => toggleAdFreeze(ad, card.querySelector('.freeze-btn'));
        }
        card.querySelector('.delete-btn').onclick = async () => {
          const confirmed = await new Promise(resolve => {
            openModal(i18n[lang].confirmTitle, i18n[lang].delete + '?', [
              { text: i18n[lang].cancel, class: 'btn btn--ghost', onClick: () => resolve(false) },
              { text: i18n[lang].yes, class: 'btn btn--danger', onClick: () => resolve(true) }
            ]);
          });
          if (!confirmed) return;
          showPreloader();
          try {
            // Pass rejected status: true if rejected, false if accepted
            const isRejected = status === 'rejected';
            const payload = {
              // GAS script expects elements to be an array
              elements: [ad.name],
              rejected: isRejected
            };
            console.log('Deleting ad:', payload);
            // choose correct GAS endpoint based on rejection status
            const deleteUrl = isRejected ? DELETE_REJECTED_ADS_GAS_URL : DELETE_ALL_MY_ADS_GAS_URL;
            if (isRejected) {
              console.log(`[REJECTED AD DELETION] Removing rejected ad: "${ad.name}" using special URL`);
            }
            
            // send plain text JSON to avoid preflight
            const response = await fetch(deleteUrl, {
              method: 'POST',
              mode: 'cors',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            if (result.status === 'success') {
              console.log(`[SUCCESS] Ad "${ad.name}" deleted successfully`);
              await updateAdsCount();
              loadMyAds();
            } else {
              throw new Error(result.message || 'Delete failed');
            }
          } catch (e) {
            console.error('Failed to delete ad:', e);
            if (status === 'rejected') {
              console.error(`[ERROR] Failed to delete rejected ad "${ad.name}":`, e);
            }
          } finally {
            hidePreloader();
          }
        };
        list.appendChild(card);
      });
      
      // Add "Delete All" button if there are ads
      if (allAds.length > 0) {
        const hasPending = allAds.some(ad => ad.status === 'pending');
        const hasNonRejected = allAds.some(ad => ad.status !== 'rejected');
        const deleteAllCard = document.createElement('div');
        deleteAllCard.className = 'card';
        deleteAllCard.innerHTML = `
          <button id="delete-all-btn" class="btn btn--danger btn--full" type="button" ${hasPending || !hasNonRejected ? 'disabled' : ''}>
            ${i18n[lang].deleteAll || 'Удалить все рекламы'}
          </button>
        `;
        list.appendChild(deleteAllCard);
        
        $('delete-all-btn').onclick = async () => {
          const confirmed = await new Promise(resolve => {
            openModal(i18n[lang].confirmTitle, i18n[lang].deleteAll + '?', [
              { text: i18n[lang].cancel, class: 'btn btn--ghost', onClick: () => resolve(false) },
              { text: i18n[lang].yes, class: 'btn btn--danger', onClick: () => resolve(true) }
            ]);
          });
          if (!confirmed) return;
          showPreloader();
          try {
            // Удаляем только те рекламы, которые не отклонены
            // Для каждой рекламы передаем rejected флаг: false (так как они не отклонены)
            const adsToDelete = allAds
              .filter(ad => ad.status !== 'rejected')
              .map(ad => ad.name);
            
            const payload = {
              elements: adsToDelete,
              rejected: false
            };
            
            console.log('[DELETE ALL] Ads to delete:', adsToDelete);
            const rejectedAdsInfo = allAds.filter(ad => ad.status === 'rejected').map(ad => ad.name);
            if (rejectedAdsInfo.length > 0) {
              console.log('[DELETE ALL] Skipping rejected ads:', rejectedAdsInfo);
            }
            
            // send plain text JSON to avoid preflight
            const payloadAll = {
              elements: adsToDelete,
              rejected: false
            };
            const response = await fetch(DELETE_ALL_MY_ADS_GAS_URL, {
              method: 'POST',
              mode: 'cors',
              headers: { 'Content-Type': 'text/plain;charset=utf-8' },
              body: JSON.stringify(payloadAll)
            });
            
            const result = await response.json();
            if (result.status === 'success') {
              console.log('[SUCCESS] All non-rejected ads deleted successfully');
              await updateAdsCount();
              loadMyAds();
            } else {
              throw new Error(result.message || 'Delete all failed');
            }
          } catch (e) {
            console.error('Failed to delete all ads:', e);
          } finally {
            hidePreloader();
          }
        };
      }
    }
  } catch (e) {
    console.warn('Failed to fetch my ads:', e);
    show($('myads-empty'));
  } finally {
    hidePreloader();
  }
}

/* ========== APPROVE/REJECT ADS ========== */
async function approveAd(adName, status) {
  if (isGasDisabled()) {
    throw new Error(i18n[localStorage.getItem(LS.lang) || 'ru'].gasDisabled || 'GAS отключён');
  }
  const action = status === 'pending' ? 'approvePending' : 'approveAd';
  const url = status === 'pending' ? GAS_SYS_URL : GAS_ADS_URL;
  const response = await fetch(`${url}?action=${action}&adName=${encodeURIComponent(adName)}`);
  if (!response.ok) throw new Error('Failed to approve ad');
  return response.json();
}

async function rejectAd(adName, status) {
  if (isGasDisabled()) {
    throw new Error(i18n[localStorage.getItem(LS.lang) || 'ru'].gasDisabled || 'GAS отключён');
  }
  const action = status === 'pending' ? 'rejectPending' : 'rejectAd';
  const url = status === 'pending' ? GAS_SYS_URL : GAS_ADS_URL;
  const response = await fetch(`${url}?action=${action}&adName=${encodeURIComponent(adName)}`);
  if (!response.ok) throw new Error('Failed to reject ad');
  return response.json();
}

/* ========== CRYSTALS ========== */
async function loadCrystals() {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  currentCrystals = await fetchCrystals();
  $('crystals-now').textContent = formatNumber(currentCrystals);
  const container = $('crystals-buttons');
  container.innerHTML = '';
  CRYSTALS_BUTTONS.forEach(item => {
    const b = document.createElement('button');
    b.className = 'btn btn--primary btn--full';
    b.innerHTML = i18n[lang].buyCrystalsBtn.replace('{crystals}', formatNumber(item.crystals)).replace('{price}', formatNumber(item.price));
    b.onclick = () => buyCrystals(item.crystals, item.price);
    container.appendChild(b);
  });
}

async function buyCrystals(amount, stars) {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  // Если платежи отключены в конфиге
  if (isPaymentsDisabled()) {
    openModal(i18n[lang].paymentsDisabled || 'Платежи временно отключены', '');
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        title: `${amount} Crystals`,
        description: `Purchase ${amount} crystals for ${stars} Telegram Stars`,
        payload: `${getUserID()}:${amount}`,
        currency: 'XTR',
        prices: [{label: 'Crystals', amount: stars}]
      })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.description);
    const link = data.result;
    tg.openInvoice(link, async (status) => {
      if (status.status === 'paid') {
        showPreloader();
        try {
          await updateCrystalsInGAS(amount, true);
          $('crystals-now').textContent = formatNumber(currentCrystals);
          $('crystals-count').textContent = formatNumber(currentCrystals);
          if ($('crystals-in-create')) $('crystals-in-create').textContent = formatNumber(currentCrystals);
          openModal(i18n[lang].doneTitle, i18n[lang].crystalsAdded);
        } catch (e) {
          openModal(i18n[lang].failedToAddCrystals, '');
        } finally {
          hidePreloader();
        }
      }
    });
  } catch (e) {
    openModal(`${i18n[lang].failedToCreateInvoice}: ${e.message}`, '');
  }
}

/* ========== ADMIN FUNCTIONS ========== */
$('admin-check').onclick = async () => {
  if (!adminGuard('reviewAds')) return;
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (isGasDisabled()) {
    const list = $('admin-check-list');
    list.innerHTML = '';
    return;
  }
  showPreloader();
  show($('admin-panel-check'));
  const list = $('admin-check-list');
  list.innerHTML = '';
  try {
    const res = await fetch(`${GAS_SYS_URL}?action=getPendingAds`);
    const data = await res.json();
    data.forEach(ad => {
      const card = document.createElement('div');
      card.className = 'card ad-card';
      card.innerHTML = `
        <div class="ad-card__head">
          <div class="ad-card__name">${ad.name}</div>
          <div class="pill pill--pending">${i18n[lang].pendingStatus}</div>
        </div>
        <p>${i18n[lang].adTextLabel}: ${ad.text}</p>
        <p>${i18n[lang].videoLabel}: <a href="${ad.videoUrl}" target="_blank">View</a></p>
        <p>${i18n[lang].platformLabel}: ${ad.platform}</p>
        <p>Name: ${ad.name}</p>
        <p>Comments: ${ad.comments ? i18n[lang].enabled : i18n[lang].disabled}</p>
        <p>${i18n[lang].telegramID}: ${ad.userID}</p>
        <p>${i18n[lang].tokenLabel}: ${ad.token}</p>
        <p>${i18n[lang].footerLabel}: ${ad.footer}</p>
        <p>${i18n[lang].priorityLabel}: ${ad.priority}</p>
        <div class="row">
          <button class="btn btn--primary approve" data-i18n="approveBtn">Approve</button>
          <button class="btn btn--ghost reject" data-i18n="rejectBtn" style="background:red;">Reject</button>
        </div>
      `;
      card.querySelector('.approve').onclick = () => handleAdAction(ad.name, 'approve');
      card.querySelector('.reject').onclick = () => handleAdAction(ad.name, 'reject', ad.userID);
      
      list.appendChild(card);
    });
    applyLang(lang);
  } catch (e) {
    console.warn('Failed to fetch pending ads:', e);
  } finally {
    hidePreloader();
  }
};

async function handleAdAction(adName, action, userID = null, rejectionReason = '', confirmed = false) {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (action === 'reject' && !confirmed) {
    const admin = getCurrentAdmin();
    const body = document.createElement('div'); body.style.display = 'grid'; body.style.gap = '10px';
    const label = document.createElement('label'); label.textContent = lang === 'ru' ? 'Причина отказа' : 'Rejection reason'; body.appendChild(label);
    const input = document.createElement('textarea'); input.rows = 3; input.placeholder = lang === 'ru' ? 'Укажите причину отказа' : 'Enter rejection reason'; input.style.width = '100%'; body.appendChild(input);
    openModal(lang === 'ru' ? 'Отклонить рекламу' : 'Reject ad', body, [
      { text: lang === 'ru' ? 'Отклонить' : 'Reject', onClick: () => { if (Number(admin?.admin_level) === 1 && !input.value.trim()) { openModal(lang === 'ru' ? 'Причина обязательна' : 'Reason required', i18n[lang].rejectionReasonRequired); return; } handleAdAction(adName, action, userID, input.value.trim(), true); } },
      { text: lang === 'ru' ? 'Отмена' : 'Cancel', class: 'btn btn--ghost' }
    ]);
    return;
  }
  if (!adminGuard('reviewAds')) return;
  if (isGasDisabled()) { openModal(i18n[lang].gasDisabled || 'GAS отключён', ''); return; }
  showPreloader();
  try {
    let url = `${GAS_SYS_URL}?action=${action}&adName=${encodeURIComponent(adName)}`;
    if (action === 'reject' || action === 'banUser') url += `&userID=${encodeURIComponent(userID || '')}`;
    if (action === 'reject') {
      const admin = getCurrentAdmin();
      url += `&reason=${encodeURIComponent(rejectionReason || '')}&adminName=${encodeURIComponent(getAdminDisplayName(admin, 'rejection'))}&adminLevel=${encodeURIComponent(admin?.admin_level || '')}`;
    }
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to process ad');
    if (action === 'reject') recordAdminAction('rejectAd');
    openModal(i18n[lang].doneTitle, i18n[lang].actionPerformed);
    $('admin-check').click();
  } catch (e) { openModal(i18n[lang].failedToPerform, ''); }
  finally { hidePreloader(); }
}

$('admin-restricted').onclick = async () => {
  if (!adminGuard('viewRestricted')) return;
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (isGasDisabled()) {
    const list = $('admin-restricted-list');
    list.innerHTML = '';
    return;
  }
  showPreloader();
  show($('admin-panel-restricted'));
  const list = $('admin-restricted-list');
  list.innerHTML = '';
  try {
    const res = await fetch(`${GAS_SYS_URL}?action=getBannedUsers`);
    const data = await res.json();
    data.forEach(u => {
      const item = document.createElement('div');
      item.className = 'note';
      item.innerHTML = `
        ID: ${u.id}<br>
        Token: ${u.token}<br>
        Type: ${u.type}<br>
        End: ${u.end_time || 'Permanent'}<br>
        <button class="btn btn--primary unban">Unban</button>
      `;
      item.querySelector('.unban').onclick = () => handleUnban(u.id, u.token || '');
      list.appendChild(item);
    });
  } catch (e) {
    console.warn('Failed to fetch banned users:', e);
  } finally {
    hidePreloader();
  }
};

async function handleUnban(userID, userToken = '') {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (!adminGuard('unbanToken', userToken)) return;
  if (isGasDisabled()) {
    openModal(i18n[lang].gasDisabled || 'GAS отключён', '');
    return;
  }
  showPreloader();
  try {
    const response = await fetch(`${GAS_SYS_URL}?action=unbanUser&userID=${userID}`);
    if (!response.ok) throw new Error('Failed to unban user');
    recordAdminAction((ADMINS || []).some(admin => admin.admin_token === userToken) ? 'banAdmin' : 'banToken');
    openModal(i18n[lang].doneTitle, i18n[lang].banRemoved);
    $('admin-restricted').click();
  } catch (e) {
    openModal(i18n[lang].failedToUnban, '');
  } finally {
    hidePreloader();
  }
}

async function updateVariable(action, value) {
    const response2 = await fetch(
        "https://script.google.com/macros/s/AKfycbzTDNI5q2qAUWHoXsm5KJWlnrv0ivvK5LI6Gbevp9A-u31L48D0wZbWuDnD-X52vo-MOA/exec"
    );

    if (!response2.ok) {
        throw new Error("Ошибка получения токена");
    }

    const data = await response2.json();

    const token = data.token;

    const url =
        "https://api.github.com/repos/hello23445/buyAd/contents/admin2.js";

    // =====================================================
    // ПОЛУЧАЕМ ФАЙЛ
    // =====================================================

    const response = await fetch(url, {
        headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));

        throw new Error(
            `Ошибка получения файла: ${response.status} — ${error.message || ""}`
        );
    }

    const file = await response.json();

    // =====================================================
    // ДЕКОДИРУЕМ ФАЙЛ
    // =====================================================

    const content = decodeURIComponent(
        escape(
            atob(file.content.replace(/\n/g, ""))
        )
    );

    let variableName;
    let newValue;

    // =====================================================
    // ОПРЕДЕЛЯЕМ ПЕРЕМЕННУЮ
    // =====================================================

    switch (action) {

        // -------------------------
        // BAN FOREVER
        // -------------------------

        case "BanForever":
            variableName = "BanForever";
            newValue = value;
            break;

        case "UnBanForever":
            variableName = "BanForever";
            newValue = value;
            break;


        // -------------------------
        // BLOCK CREATE ADS
        // -------------------------

        case "BlockCreateAds":
            variableName = "BlockCreateAds";
            newValue = value;
            break;

        case "UnBlockCreateAds":
            variableName = "BlockCreateAds";
            newValue = value;
            break;


        // -------------------------
        // CLOSE APP
        // -------------------------

        case "CloseApp":
            variableName = "CloseApp";
            newValue = value;
            break;

        case "UnCloseApp":
            variableName = "CloseApp";
            newValue = value;
            break;


        // -------------------------
        // GAS
        // -------------------------

        case "GASESES":
            variableName = "GASESES";
            newValue = value;
            break;

        case "UnGASESES":
            variableName = "GASESES";
            newValue = value;
            break;


        // -------------------------
        // PURCHASES
        // -------------------------

        case "Purchases2":
            variableName = "Purchases2";
            newValue = value;
            break;

        case "UnPurchases2":
            variableName = "Purchases2";
            newValue = value;
            break;


        // -------------------------
        // CREATE ADS
        // -------------------------

        case "disableCreateAds2":
            variableName = "disableCreateAds2";
            newValue = value;
            break;

        case "UndisableCreateAds2":
            variableName = "disableCreateAds2";
            newValue = value;
            break;


        // -------------------------
        // EDIT ADS
        // -------------------------

        case "disableEditingAds":
            variableName = "disableEditingAds";
            newValue = value;
            break;

        case "UndisableEditingAds":
            variableName = "disableEditingAds";
            newValue = value;
            break;


        // -------------------------
        // TELEGRAM ID
        // -------------------------

        case "BlockedUsersTelegramID":
            variableName = "BlockedUsersTelegramID";
            newValue = value;
            break;

        case "UnBlockedUsersTelegramID":
            variableName = "BlockedUsersTelegramID";
            newValue = value;
            break;


        // -------------------------
        // IP ADDRESS
        // -------------------------

        case "BlockedUsersIPadresses":
            variableName = "BlockedUsersIPadresses";
            newValue = value;
            break;

        case "UnBlockedUsersIPadresses":
            variableName = "BlockedUsersIPadresses";
            newValue = value;
            break;


        default:
            throw new Error(
                `Неизвестное действие: ${action}`
            );
    }

    let newContent;

    // =====================================================
    // ПРОВЕРЯЕМ, ЯВЛЯЕТСЯ ЛИ ПЕРЕМЕННАЯ МАССИВОМ
    // =====================================================

    const isArrayVariable =
        variableName === "BanForever" ||
        variableName === "BlockCreateAds" ||
        variableName === "BlockedUsersTelegramID" ||
        variableName === "BlockedUsersIPadresses";

    // =====================================================
    // МАССИВЫ
    // =====================================================

    if (isArrayVariable) {

        const regex = new RegExp(
            `(^\\s*(?:export\\s+)?(?:let|const|var)\\s+${variableName}\\s*=\\s*)(\\[[\\s\\S]*?\\])(\\s*;)`,
            "m"
        );

        const match = content.match(regex);

        if (!match) {
            throw new Error(
                `Массив ${variableName} не найден`
            );
        }

        let oldArray;

        try {
            oldArray = JSON.parse(match[2]);
        } catch {
            throw new Error(
                `Не удалось прочитать массив ${variableName}: ${match[2]}`
            );
        }

        if (!Array.isArray(oldArray)) {
            throw new Error(
                `${variableName} не является массивом`
            );
        }

        oldArray = oldArray.filter(item => item !== "");
        const isPunishmentArray = ["BanForever", "BlockedUsersTelegramID", "BlockedUsersIPadresses"].includes(variableName);
        const entryValue = item => item && typeof item === "object" ? String(item.value || item.token || item.ip || item.telegramId || "").trim() : String(item || "").trim();
        if (isPunishmentArray) oldArray = oldArray.map(item => typeof item === "string" ? { value: item, reason: "" } : item);

        // =================================================
        // ДОБАВЛЕНИЕ
        // =================================================

        const isAddAction =
            action === "BanForever" ||
            action === "BlockCreateAds" ||
            action === "BlockedUsersTelegramID" ||
            action === "BlockedUsersIPadresses";

        if (isAddAction) {

            const valuesToAdd =
                Array.isArray(value)
                    ? value
                    : [value];

            for (const item of valuesToAdd) {
                if (isPunishmentArray) {
                    const normalized = item && typeof item === "object" ? { value: String(item.value || "").trim(), reason: String(item.reason || "").trim(), adminName: String(item.adminName || "").trim() } : { value: String(item || "").trim(), reason: "", adminName: "" };
                    if (!normalized.value) continue;
                    const idx = oldArray.findIndex(entry => entryValue(entry) === normalized.value);
                    if (idx >= 0) oldArray[idx] = normalized; else oldArray.push(normalized);
                } else if (item !== "" && !oldArray.includes(item)) oldArray.push(item);
            }
        }

        // =================================================
        // УДАЛЕНИЕ
        // =================================================

        const isRemoveAction =
            action === "UnBanForever" ||
            action === "UnBlockCreateAds" ||
            action === "UnBlockedUsersTelegramID" ||
            action === "UnBlockedUsersIPadresses";

        if (isRemoveAction) {

            const valuesToRemove =
                Array.isArray(value)
                    ? value
                    : [value];

            const normalizedValues = valuesToRemove.map(item => item && typeof item === "object" ? entryValue(item) : String(item || "").trim());
            oldArray = oldArray.filter(item => !normalizedValues.includes(entryValue(item)));
        }

        // Если массив пустой — оставляем [""]
        if (oldArray.length === 0) oldArray = isPunishmentArray ? [] : [""];

        const newArrayText =
            JSON.stringify(oldArray);

        newContent = content.replace(
            regex,
            `$1${newArrayText}$3`
        );
    }

    // =====================================================
    // ОБЫЧНЫЕ ПЕРЕМЕННЫЕ
    // =====================================================

    else {

        const regex = new RegExp(
            `(^\\s*(?:export\\s+)?(?:let|const|var)\\s+${variableName}\\s*=\\s*)([^;]+)(\\s*;)`,
            "m"
        );

        const match = content.match(regex);

        if (!match) {
            throw new Error(
                `Переменная ${variableName} не найдена`
            );
        }

        newContent = content.replace(
            regex,
            `$1${JSON.stringify(newValue)}$3`
        );
    }

    // =====================================================
    // ПРОВЕРКА
    // =====================================================

    if (newContent === content) {
        throw new Error(
            `Содержимое ${variableName} не изменилось`
        );
    }

    // =====================================================
    // КОДИРУЕМ В BASE64
    // =====================================================

    const encodedContent = btoa(
        unescape(
            encodeURIComponent(newContent)
        )
    );

    // =====================================================
    // ОБНОВЛЯЕМ GITHUB
    // =====================================================

    const updateResponse = await fetch(url, {
        method: "PUT",

        headers: {
            "Accept": "application/vnd.github+json",
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },

        body: JSON.stringify({
            message: `${action}: ${variableName}`,
            content: encodedContent,
            sha: file.sha
        })
    });

    const result =
        await updateResponse.json();

    if (!updateResponse.ok) {
        throw new Error(
            result.message ||
            `Ошибка GitHub: ${updateResponse.status}`
        );
    }

    alert(
        `${variableName} успешно изменена`
    );

    return result;
}

function openAdminPunishmentModal(title, onSubmit, placeholder = 'Введите токен пользователя') {
  const body = document.createElement('div'); body.style.display = 'grid'; body.style.gap = '0.75rem';
  const label = document.createElement('label'); label.textContent = title; label.style.fontWeight = '600'; body.appendChild(label);
  const input = document.createElement('input'); input.type = 'text'; input.placeholder = placeholder; input.style.width = '100%'; input.style.padding = '0.75rem'; input.style.border = '1px solid #ccc'; input.style.borderRadius = '0.5rem'; input.style.fontSize = '1rem'; body.appendChild(input);
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const admin = getCurrentAdmin();
  const reasonLabel = document.createElement('label'); reasonLabel.textContent = lang === 'ru' ? 'Причина блокировки' + (Number(admin?.admin_level) === 1 ? ' (обязательно)' : ' (необязательно)') : 'Reason for block' + (Number(admin?.admin_level) === 1 ? ' (required)' : ' (optional)'); reasonLabel.style.fontWeight = '600'; body.appendChild(reasonLabel);
  const reason = document.createElement('textarea'); reason.placeholder = lang === 'ru' ? 'Введите причину блокировки' : 'Enter the reason for the block'; reason.rows = 3; reason.style.width = '100%'; reason.style.padding = '0.75rem'; reason.style.border = '1px solid #ccc'; reason.style.borderRadius = '0.5rem'; reason.style.fontSize = '1rem'; reason.style.resize = 'vertical'; body.appendChild(reason);
  if (Number(admin?.admin_level) === 5 && adminHasPermission('hideNameOnBan')) {
    const wrap = document.createElement('label'); wrap.style.display = 'flex'; wrap.style.gap = '0.5rem'; wrap.style.alignItems = 'center';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = localStorage.getItem('hideAdminNameOnBan') === 'true';
    checkbox.addEventListener('change', () => localStorage.setItem('hideAdminNameOnBan', checkbox.checked ? 'true' : 'false'));
    wrap.appendChild(checkbox); wrap.appendChild(document.createTextNode(lang === 'ru' ? 'Скрывать моё имя при блокировке' : 'Hide my name when blocking')); body.appendChild(wrap);
  }
  openModal(title, body, [
    { text: lang === 'ru' ? 'Отправить' : 'Submit', onClick: () => {
      if (Number(admin?.admin_level) === 1 && !reason.value.trim()) { openModal(lang === 'ru' ? 'Причина обязательна' : 'Reason required', lang === 'ru' ? 'Укажите причину блокировки.' : 'Please enter a reason for the block.'); return; }
      if (onSubmit) onSubmit(input.value.trim(), reason.value.trim());
    } },
    { text: lang === 'ru' ? 'Отмена' : 'Cancel', class: 'btn btn--ghost' }
  ]);
}

function openAdminTokenModal(title, onSubmit, placeholder = 'Введите токен пользователя') {
  const body = document.createElement('div');
  body.style.display = 'grid';
  body.style.gap = '0.75rem';

  const label = document.createElement('label');
  label.textContent = title;
  label.style.fontWeight = '600';
  body.appendChild(label);

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = placeholder;
  input.style.width = '100%';
  input.style.padding = '0.75rem';
  input.style.border = '1px solid #ccc';
  input.style.borderRadius = '0.5rem';
  input.style.fontSize = '1rem';
  body.appendChild(input);

  openModal(title, body, [
    {
      text: 'Отправить',
      onClick: () => {
        if (onSubmit) onSubmit(input.value.trim());
      }
    },
    {
      text: 'Отмена',
      class: 'btn btn--ghost'
    }
  ]);
}

$('admin-block-user').onclick = () => {
  openAdminPunishmentModal('Заблокировать пользователя по токену', async (token, reason) => {
    if (!token) {
      alert('Введите токен пользователя');
      return;
    }
    try {
      showPreloader();
      if (!adminGuard('banToken', token)) return;
      await updateVariable('BanForever', { value: token, reason, adminName: getAdminDisplayName() });
      recordAdminAction((ADMINS || []).some(admin => admin.admin_token === token) ? 'banAdmin' : 'banToken');
    } catch (e) {
      alert(e.message || 'Ошибка при обновлении переменной');
    } finally {
      hidePreloader();
    }
  });
};

$('admin-unblock-user').onclick = () => {
  openAdminTokenModal('Разблокировать пользователя по токену', async token => {
    if (!token) {
      alert('Введите токен пользователя');
      return;
    }
    try {
      showPreloader();
      if (!adminGuard('unbanToken', token)) return;
      await updateVariable('UnBanForever', token);
      recordAdminAction((ADMINS || []).some(admin => admin.admin_token === token) ? 'banAdmin' : 'banToken');
    } catch (e) {
      alert(e.message || 'Ошибка при обновлении переменной');
    } finally {
      hidePreloader();
    }
  });
};

$('admin-ban-create-edit').onclick = () => {
  openAdminTokenModal('Заблокировать пользователю возможность создавать и редактировать рекламы', async token => {
    if (!token) {
      alert('Введите токен пользователя');
      return;
    }
    try {
      showPreloader();
      if (!adminGuard('restrictAds', token)) return;
      await updateVariable('BlockCreateAds', token);
      recordAdminAction((ADMINS || []).some(admin => admin.admin_token === token) ? 'banAdmin' : 'restrictAds');
    } catch (e) {
      alert(e.message || 'Ошибка при обновлении переменной');
    } finally {
      hidePreloader();
    }
  });
};

$('admin-unban-create-edit').onclick = () => {
  openAdminTokenModal('Разблокировать пользователю возможность создавать и редактировать рекламы', async token => {
    if (!token) {
      alert('Введите токен пользователя');
      return;
    }
    try {
      showPreloader();
      if (!adminGuard('unrestrictAds', token)) return;
      await updateVariable('UnBlockCreateAds', token);
      recordAdminAction((ADMINS || []).some(admin => admin.admin_token === token) ? 'banAdmin' : 'restrictAds');
    } catch (e) {
      alert(e.message || 'Ошибка при обновлении переменной');
    } finally {
      hidePreloader();
    }
  });
};

$('admin-ban-ip').onclick = () => {
  openAdminPunishmentModal('Забанить пользователя по его IP-адресу', async (ip, reason) => {
    if (!ip) {
      alert('Введите IP-адрес пользователя');
      return;
    }
    try {
      showPreloader();
      if (!adminGuard('banIp', ip)) return;
      await updateVariable('BlockedUsersIPadresses', { value: ip, reason, adminName: getAdminDisplayName() });
      recordAdminAction('banIp');
    } catch (e) {
      alert(e.message || 'Ошибка при обновлении переменной');
    } finally {
      hidePreloader();
    }
  }, 'Введите IP-адрес пользователя');
};

$('admin-unban-ip').onclick = () => {
  openAdminTokenModal('Разбанить пользователя по его IP-адресу', async ip => {
    if (!ip) {
      alert('Введите IP-адрес пользователя');
      return;
    }
    try {
      showPreloader();
      if (!adminGuard('unbanIp', ip)) return;
      await updateVariable('UnBlockedUsersIPadresses', ip);
      recordAdminAction('banIp');
    } catch (e) {
      alert(e.message || 'Ошибка при обновлении переменной');
    } finally {
      hidePreloader();
    }
  }, 'Введите IP-адрес пользователя');
};

$('admin-ban-telegram-id').onclick = () => {
  openAdminPunishmentModal('Забанить пользователя по его Telegram ID', async (telegramId, reason) => {
    if (!telegramId) {
      alert('Введите Telegram ID пользователя');
      return;
    }
    try {
      showPreloader();
      if (!adminGuard('banTelegramId', telegramId)) return;
      await updateVariable('BlockedUsersTelegramID', { value: telegramId, reason, adminName: getAdminDisplayName() });
      recordAdminAction((ADMINS || []).some(admin => admin.admin_token === telegramId) ? 'banAdmin' : 'banTelegramId');
    } catch (e) {
      alert(e.message || 'Ошибка при обновлении переменной');
    } finally {
      hidePreloader();
    }
  }, 'Введите Telegram ID пользователя');
};

$('admin-unban-telegram-id').onclick = () => {
  openAdminTokenModal('Разбанить пользователя по его Telegram ID', async telegramId => {
    if (!telegramId) {
      alert('Введите Telegram ID пользователя');
      return;
    }
    try {
      showPreloader();
      if (!adminGuard('unbanTelegramId', telegramId)) return;
      await updateVariable('UnBlockedUsersTelegramID', telegramId);
      recordAdminAction('banTelegramId');
    } catch (e) {
      alert(e.message || 'Ошибка при обновлении переменной');
    } finally {
      hidePreloader();
    }
  }, 'Введите Telegram ID пользователя');
};

$('admin-close-app').onclick = async () => {
  if (!adminGuard('globalCreateToggle')) return;
  try {
    showPreloader();
    await updateVariable('CloseApp', 'closed');
  } catch (e) {
    alert(e.message || 'Ошибка при обновлении переменной');
  } finally {
    hidePreloader();
  }
};

$('admin-open-app').onclick = async () => {
  if (!adminGuard('globalCreateToggle')) return;
  try {
    showPreloader();
    await updateVariable('UnCloseApp', 'not_closed');
  } catch (e) {
    alert(e.message || 'Ошибка при обновлении переменной');
  } finally {
    hidePreloader();
  }
};

$('admin-disable-gas').onclick = async () => {
  try {
    showPreloader();
    await updateVariable('GASESES', 'no');
  } catch (e) {
    alert(e.message || 'Ошибка при обновлении переменной');
  } finally {
    hidePreloader();
  }
};

$('admin-enable-gas').onclick = async () => {
  try {
    showPreloader();
    await updateVariable('UnGASESES', 'true');
  } catch (e) {
    alert(e.message || 'Ошибка при обновлении переменной');
  } finally {
    hidePreloader();
  }
};

$('admin-disable-payments').onclick = async () => {
  try {
    showPreloader();
    await updateVariable('Purchases2', 'no');
  } catch (e) {
    alert(e.message || 'Ошибка при обновлении переменной');
  } finally {
    hidePreloader();
  }
};

$('admin-enable-payments').onclick = async () => {
  try {
    showPreloader();
    await updateVariable('UnPurchases2', 'enabled');
  } catch (e) {
    alert(e.message || 'Ошибка при обновлении переменной');
  } finally {
    hidePreloader();
  }
};

$('admin-disable-create-all').onclick = async () => {
  try {
    showPreloader();
    await updateVariable('disableCreateAds2', 'disabled');
  } catch (e) {
    alert(e.message || 'Ошибка при обновлении переменной');
  } finally {
    hidePreloader();
  }
};

$('admin-enable-create-all').onclick = async () => {
  try {
    showPreloader();
    await updateVariable('UndisableCreateAds2', 'enabled');
  } catch (e) {
    alert(e.message || 'Ошибка при обновлении переменной');
  } finally {
    hidePreloader();
  }
};

$('admin-disable-edit-all').onclick = async () => {
  try {
    showPreloader();
    await updateVariable('disableEditingAds', 'disabled');
  } catch (e) {
    alert(e.message || 'Ошибка при обновлении переменной');
  } finally {
    hidePreloader();
  }
};

$('admin-enable-edit-all').onclick = async () => {
  try {
    showPreloader();
    await updateVariable('UndisableEditingAds', 'enabled');
  } catch (e) {
    alert(e.message || 'Ошибка при обновлении переменной');
  } finally {
    hidePreloader();
  }
};

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', async () => {
  // Отключаем кнопку настроек при входе
  $('btn-open-settings').disabled = true;
  // Включаем через 7 секунд
  setTimeout(() => {
    $('btn-open-settings').disabled = false;
  }, 7000);

  showPreloader();
  const startupPreloaderWatchdog = setTimeout(() => {
    if ($('preloader') && !$('preloader').hidden) {
      console.warn('Startup took too long; hiding preloader to avoid an infinite loading screen.');
      hidePreloader();
    }
  }, 15000);
// Инициализация пользователя в таблице Users
(async () => {
  if (isGasDisabled()) return; // Пропускаем GAS
  try {
    await fetch(`${GAS_SYS_URL}?action=initUser&userID=${getUserID()}&token=${USER_TOKEN}`);
  } catch (e) {
    console.warn('Failed to init user in Users sheet');
  }
})();
  const lang = localStorage.getItem(LS.lang);
  const theme = localStorage.getItem(LS.theme) || 'system';
  applyTheme(theme);

  currentUserIpBlocked = await Promise.race([isIpBlocked(), new Promise(resolve => setTimeout(() => resolve(false), 5500))]);
  await Promise.race([pollAdmin2Config(), new Promise(resolve => setTimeout(resolve, 5500))]);

  // Не продолжаем запуск приложения, если пользователь заблокирован по IP или Telegram ID.
  // loadAdmin2Config() уже загрузил конфигурацию и применил блокировки.
  if (await applyRuntimeBlockings()) {
    updateOnlineStatus();
    hidePreloader();
    return;
  }

  updateOnlineStatus();
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);

  if (!lang) {
    hideAllScreens();
    show($('screen-first'));
    $('lang-ru').onclick = () => firstEntry('ru');
    $('lang-en').onclick = () => firstEntry('en');
  } else {
    applyLang(lang);
    const isAdmin = ADMIN_TOKENS.includes(localStorage.getItem(LS.token));
    if (await checkUserStatus(isAdmin) && checkAppOpen(isAdmin)) {
      // load crystals and ads count simultaneously on entry
      await showMainMenu('both');
      // Инициализируем сессию после загрузки главного меню
      await initializeSession();
    }
    const langBtn = document.querySelector(`#settings-lang-buttons .seg[data-value="${lang}"]`);
    if (langBtn) langBtn.classList.add('active');
    const themeBtn = document.querySelector(`#settings-theme-buttons .seg[data-value="${theme}"]`);
    if (themeBtn) themeBtn.classList.add('active');
    // initialize app size
    const size = localStorage.getItem(APP_SIZE_LS) || 'normal';
    const sizeBtn = document.querySelector(`#settings-size-buttons .seg[data-value="${size}"]`);
    if (sizeBtn) sizeBtn.classList.add('active');
    applyAppSize(size);
    
    // Apply saved settings
    const closingConfirmationEnabled = localStorage.getItem(CLOSING_CONFIRMATION_LS) === 'true';
    applyClosingConfirmation(closingConfirmationEnabled);
    
    const settingsButtonPosition = parseInt(localStorage.getItem(SETTINGS_BTN_POSITION_LS) || '0');
    applySettingsButtonPosition(settingsButtonPosition);
    
    const appTitlePosition = parseInt(localStorage.getItem(APP_TITLE_POSITION_LS) || '0');
    applyAppTitlePosition(appTitlePosition);
  }

  const prioFirst = document.querySelector('#priority-buttons .seg:first-child');
  if (prioFirst) {
    prioFirst.classList.add('active');
    selectedPriority = prioFirst.dataset.value;
  }
  const platFirst = document.querySelector('#platform-buttons .seg:first-child');
  if (platFirst) {
    platFirst.classList.add('active');
    selectedPlatform = platFirst.dataset.value;
    updatePlatformListActive();
  }
  
  // Initialize token display on page load
  initTokenDisplay();
  initTelegramIdDisplay();

  clearTimeout(startupPreloaderWatchdog);
  hidePreloader();
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('input, textarea, select, button, [contenteditable]')) {
    document.activeElement?.blur();
  }
});