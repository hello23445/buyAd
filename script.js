// script.js 
/* ========== TELEGRAM ========== */
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  
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
  // Показываем кнопку Settings
  tg.SettingsButton.show();
  // Обработчик клика на кнопку Settings
  tg.SettingsButton.onClick(() => {
    const previousScreen = document.querySelector('.screen:not([hidden])').id || 'screen-main';
    hideAllScreens();
    show($('screen-settings'));
  });
  
  // Telegram BackButton handler
  tg.BackButton.onClick(() => {
    const currentScreen = document.querySelector('.screen:not([hidden])').id || 'screen-main';
    
    if (currentScreen === 'screen-create' && document.getElementById('back-from-create')) {
      document.getElementById('back-from-create').click();
    } else if (currentScreen === 'screen-myads' && document.getElementById('back-from-myads')) {
      document.getElementById('back-from-myads').click();
    } else if (currentScreen === 'screen-crystals' && document.getElementById('back-from-crystals')) {
      document.getElementById('back-from-crystals').click();
    } else if (currentScreen === 'screen-admin' && document.getElementById('back-from-admin')) {
      document.getElementById('back-from-admin').click();
    } else if (currentScreen === 'screen-settings' && document.getElementById('back-from-settings')) {
      document.getElementById('back-from-settings').click();
    }
  });
}

/* ========== HELPERS ========== */
const $ = id => document.getElementById(id);
function show(el) { 
  if (!el) return; 
  try { 
    el.hidden = false;
    // Show BackButton when showing a non-main screen
    if (tg?.BackButton && el.classList?.contains('screen')) {
      if (el.id !== 'screen-main' && el.id !== 'screen-first' && el.id !== 'screen-blocked') {
        tg.BackButton.show();
      }
    }
  } catch (e) { /* ignore */ } 
}
function hide(el) { if (!el) return; try { el.hidden = true; } catch (e) { /* ignore */ } }
function showPreloader() { 
  show($('preloader')); 
  // Отключаем кнопку кристаллов во время загрузки
  $('nav-crystals').disabled = true;
  $('nav-crystals').style.pointerEvents = 'none';
}
function hidePreloader() { 
  hide($('preloader')); 
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

/* ========== STORAGE ========== */
const LS = {
  lang: 'lang',
  token: 'get_UserToken',
  theme: 'theme'
};

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
    initTelegramIdDisplay();
  }
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
  if (GASES === 'no') return true; // Пропускаем если GAS отключены
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
  if (GASES === 'no') return 'No changes'; // Пропускаем если GAS отключены
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
  if (closeApp === 'closed' && !isAdmin) {
    hideAllScreens();
    openModal(i18n[lang].attentionTitle, i18n[lang].appClosed, []);
    $('modal-close').hidden = true;
    return false;
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
  // Если GASES === 'no', можно добавить проверку: return или fallback на localStorage
  if (GASES === 'no') {
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
  if (GASES === 'no') {
    return parseInt(localStorage.getItem('crystals')) || 0;
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
    return parseInt(localStorage.getItem('crystals')) || 0;
  }
}

async function updateCrystalsInGAS(amount, isAdd = true) {
  if (GASES === 'no') {
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

  hideAllScreens();
  show($('screen-main'));
  $('nav-admin').hidden = !isAdmin;

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
  const isBannedFromAds = banForeverAds.includes(token);
  $('nav-create').disabled = disableCreateAds === 'disabled' || isBannedFromAds;
}

/* ========== NAVIGATION ========== */
function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(s => hide(s));
  // Hide BackButton when no screen is shown
  if (tg?.BackButton) {
    tg.BackButton.hide();
  }
}

$('btn-open-settings').onclick = () => {
  previousScreen = document.querySelector('.screen:not([hidden])').id || 'screen-main';
  hideAllScreens();
  show($('screen-settings'));
  initTokenDisplay(); // Initialize token display when opening settings
  initTelegramIdDisplay(); // Initialize Telegram ID display when opening settings
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
};

$('nav-create').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (disableCreateAds === 'disabled') {
    openModal(i18n[lang].createDisabled, '');
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
    if (GASES === 'no') {
      // Fallback: предположим, нет pending
      if (createBtn) {
        createBtn.disabled = disableCreateAds === 'disabled';
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
        createBtn.disabled = disableCreateAds === 'disabled';
        const span = createBtn.querySelector('span');
        if (span) span.textContent = i18n[lang].createBtn;
      }
    }
  })();
};

$('nav-myads').onclick = () => {
  hideAllScreens();
  show($('screen-myads'));
  loadMyAds();
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
  openModal(i18n[lang].rulesTitle, pre, [
    { text: i18n[lang].rulesAcceptBtn || 'Я принимаю все эти правила' }
  ]);
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
      $('ad-text').value = '';
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
let footer = 'top';
let currentVideoUrl = '';
let originalAdData = {}; // Для отслеживания изменений при редактировании rejected

function resetCreateForm() {
  $('ad-text').value = '';
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
    text: $('ad-text').value.trim(),
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
  const text = ($('ad-text') && $('ad-text').value) ? $('ad-text').value : '';
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
$('video-input').onchange = e => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const f = e.target.files[0];
  if (!f) return;
  if (!f.type.startsWith('video/')) {
    openModal(i18n[lang].onlyVideoFiles, '');
    return;
  }
  if (f.size > 50 * 1024 * 1024) {
    openModal(i18n[lang].maxFileSize, '');
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

$('ad-text').oninput = () => {
  const text = $('ad-text').value.trim();
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

  if (disableCreateAds === 'disabled') {
    openModal(i18n[lang].createDisabled, '');
    return;
  }

  const text = $('ad-text').value.trim();
  if (!text) return openModal(i18n[lang].adTextRequired, '');
  if (!/(https:\/\/|t\.me\/|@)/i.test(text)) return openModal(i18n[lang].linkRequired, '');
  if (!videoFile && !editMode) return openModal(i18n[lang].videoRequired, '');
  if (!selectedPriority || !selectedPlatform) return openModal(i18n[lang].selectPrioAndPlat, '');

  const newTotalCost = calculateAdCost(selectedPriority, selectedPlatform, footer);

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
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: BOT_CHAT_ID, text: `🆕 New ad\n${adName}\nID: ${getUserID()}` })
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
  
  $('ad-text').value = ad.text;
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
  if ($('ad-text').value) {
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
    // reload so all text nodes and backend state refresh cleanly
    location.reload();
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

/* ========== MY ADS ========== */
async function loadMyAds(skipPreloader = false) {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (!skipPreloader) showPreloader();
  const list = $('myads-list');
  
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
        const statusText = i18n[lang][status + 'Status'] || status;
        const commentsText = ad.comments == 1 ? i18n[lang].enabled : i18n[lang].disabled;
        const footerText = !ad.footer ? i18n[lang].noFooter : (ad.footer === 'top' ? i18n[lang].footerTop : i18n[lang].footerBottom);
        const platformRow = document.querySelector(`#platform-list .platform-row[data-value="${ad.platform}"]`);
        const platformUsers = platformRow ? ` (${platformRow.querySelector('div:last-child').textContent})` : '';
        
        const card = document.createElement('div');
        card.className = 'card ad-card';
        card.innerHTML = `
          <p><strong>${i18n[lang].adName}:</strong> <span>${ad.name}</span>
            <button class="btn btn--ghost copy-name-btn" type="button" style="padding: 4px 8px; font-size: 12px; margin-left: 8px;">
              <i class="fa-solid fa-copy"></i>
            </button>
          </p>
          <p><strong>${i18n[lang].adTextLabel}:</strong> ${ad.text}</p>
          <p><strong>${i18n[lang].videoLabel}:</strong> <a href="${ad.videoUrl}" target="_blank">ссылка</a></p>
          <p><strong>${i18n[lang].footerLabel}:</strong> ${footerText}</p>
          <p><strong>${i18n[lang].platformLabel}:</strong> ${ad.platform} ${platformUsers}</p>
          <p><strong>${i18n[lang].priorityLabel}:</strong> ${ad.priority}</p>
          <p><strong>${i18n[lang].commentsLabel}:</strong> ${commentsText}</p>
          <p><strong>${i18n[lang].status}:</strong> ${statusText}</p>
          <div class="row" style="gap: 8px; margin-top: 12px;">
            <button class="btn btn--ghost edit-btn" style="flex: 1;">${i18n[lang].edit}</button>
            <button class="btn btn--danger delete-btn" style="flex: 1;" ${status === 'pending' ? 'disabled' : ''}>${i18n[lang].delete}</button>
          </div>
          ${status === 'approved' ? `<p class="muted" style="font-size:12px; margin-top:8px;">${i18n[lang].viewsLabel || 'Рекламу посмотрели'}: ${formatNumber(ad.views || 0)} ${pluralPeople(ad.views || 0)}.<br>${i18n[lang].linkClicksLabel || 'По ссылке(ссылкам) перешли'}: ${formatNumber(ad.linkClicks || 0)} ${pluralPeople(ad.linkClicks || 0)}.</p>` : ''}
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
          if (banForeverAds.includes(token)) {
            openModal(i18n[lang].createDisabled, '');
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
  const action = status === 'pending' ? 'approvePending' : 'approveAd';
  const url = status === 'pending' ? GAS_SYS_URL : GAS_ADS_URL;
  const response = await fetch(`${url}?action=${action}&adName=${encodeURIComponent(adName)}`);
  if (!response.ok) throw new Error('Failed to approve ad');
  return response.json();
}

async function rejectAd(adName, status) {
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
  if (typeof PURCHASES !== 'undefined' && PURCHASES === 'no') {
    openModal(i18n[lang].paymentsDisabled || 'Платежи отключены', '');
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
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (GASES === 'no') {
    // Fallback: показываем пустой список
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

async function handleAdAction(adName, action, userID = null) {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (GASES === 'no') {
    openModal('GAS отключён', '');
    return;
  }
  showPreloader();
  try {
    let url = `${GAS_SYS_URL}?action=${action}&adName=${adName}`;
    if (action === 'reject' || action === 'banUser') url += `&userID=${userID}`;
    await fetch(url);
    openModal(i18n[lang].doneTitle, i18n[lang].actionPerformed);
    $('admin-check').click();
  } catch (e) {
    openModal(i18n[lang].failedToPerform, '');
  } finally {
    hidePreloader();
  }
}

$('admin-restricted').onclick = async () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (GASES === 'no') {
    // Fallback: пустой список
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
      item.querySelector('.unban').onclick = () => handleUnban(u.id);
      list.appendChild(item);
    });
  } catch (e) {
    console.warn('Failed to fetch banned users:', e);
  } finally {
    hidePreloader();
  }
};

async function handleUnban(userID) {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (GASES === 'no') {
    openModal('GAS отключён', '');
    return;
  }
  showPreloader();
  try {
    await fetch(`${GAS_SYS_URL}?action=unbanUser&userID=${userID}`);
    openModal(i18n[lang].doneTitle, i18n[lang].banRemoved);
    $('admin-restricted').click();
  } catch (e) {
    openModal(i18n[lang].failedToUnban, '');
  } finally {
    hidePreloader();
  }
}

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', async () => {
  // Отключаем кнопку настроек при входе
  $('btn-open-settings').disabled = true;
  // Включаем через 7 секунд
  setTimeout(() => {
    $('btn-open-settings').disabled = false;
  }, 7000);

  showPreloader();
// Инициализация пользователя в таблице Users
(async () => {
  if (GASES === 'no') return; // Пропускаем GAS
  try {
    await fetch(`${GAS_SYS_URL}?action=initUser&userID=${getUserID()}&token=${USER_TOKEN}`);
  } catch (e) {
    console.warn('Failed to init user in Users sheet');
  }
})();
  const lang = localStorage.getItem(LS.lang);
  const theme = localStorage.getItem(LS.theme) || 'system';
  applyTheme(theme);

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

  hidePreloader();
});
if (ADMIN_TOKENS.includes(localStorage.getItem(LS.token))){
  localStorage.setItem('crystals', '999');
}


document.addEventListener('click', (e) => {
  if (!e.target.closest('input, textarea, select, button, [contenteditable]')) {
    document.activeElement?.blur();
  }
});