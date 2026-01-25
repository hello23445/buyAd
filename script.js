/* ======================================================
   script.js
====================================================== */

/* ========== PLACEHOLDERS (НЕ УДАЛЯТЬ) ========== */
const BOT_TOKEN = '7633424551:AAH8JptpFazBaf7FlfCVrDjhquI1JYxf3RM';
const BOT_CHAT_ID = '6434781065';
const REPORT_ERROR_URL = 'https://t.me/Clickerstart_bot';
const SUPPORT_URL = 'https://t.me/Clickerstart_bot';
const ADMIN_TOKENS = ['HMS7Q00JOXWSVMUW'];

const RULES_TEXT = {
  ru: `📌 ПРАВИЛА РАЗМЕЩЕНИЯ РЕКЛАМЫ

🔹 1. Общие положения
1.1. Размещая рекламу через бота, вы соглашаетесь с данными правилами.
1.2. Администрация оставляет за собой право отказать в размещении без объяснения причин.

🔹 2. Требования к рекламе
2.1. Реклама не должна нарушать законодательство и правила Telegram.
2.2. Запрещена реклама мошеннических схем, ставок, пирамид, наркотиков, оружия, контента 18+ и прочих запрещённых тем.

🔹 3. Размещение и оплата
3.1. Изменение платного контента на бесплатный не вернёт вам утерянные средства.
3.2. В случае удаления поста по вине рекламодателя (например, из-за жалоб пользователей) утерянные средства не возвращаются.

🔹 4. Отказ и блокировка
4.1. При нарушении правил администрация вправе отказать в размещении или заблокировать рекламодателя без возврата средств.
4.2. При повторных нарушениях аккаунт рекламодателя может быть заблокирован без права восстановления.

🔹 5. Обратная связь
5.1. По всем вопросам обращайтесь в поддержку: @Clickerstart_bot.`,

  en: `📌 ADVERTISEMENT PLACEMENT RULES

🔹 1. General Provisions
1.1. By placing advertisements through the bot, you agree to these rules.
1.2. The administration reserves the right to refuse advertisement placement without providing any reason.

🔹 2. Advertising Requirements
2.1. Advertisements must comply with applicable laws and Telegram rules.
2.2. Advertising of fraudulent schemes, betting, pyramid schemes, drugs, weapons, 18+ content, and other prohibited topics is strictly forbidden.

🔹 3. Placement and Payment
3.1. Changing paid content to free content does not entitle you to a refund of the spent funds.
3.2. If an advertisement is removed due to the advertiser’s fault (for example, because of user complaints), the paid amount is non-refundable.

🔹 4. Refusal and Blocking
4.1. In case of violation of these rules, the administration has the right to refuse placement or block the advertiser without a refund.
4.2. Repeated violations may result in permanent account blocking without the right to restoration.

🔹 5. Feedback
5.1. For all inquiries, please contact support: @Clickerstart_bot.`
};

const CRYSTALS_BUTTONS = [
  { crystals: 10, price: 10 },
  { crystals: 50, price: 50 },
];

const GAS_SYS_URL =
  'https://script.google.com/macros/s/AKfycbz-_mGdrZ5_EhllBCbYcqm0F22N89xocvK11Iz7gqGFXTGr3ki00CZed91jsYiYZ9r9Tw/exec';

const GAS_ADS_URL =
  'https://script.google.com/macros/s/AKfycbxYdza5qUzIoCie-wMl-d0gBFQDgiy1jLf3jHAvJnt_H1hIeGL88M6JRn-lJhNnA3MVWg/exec';

/* ========== TELEGRAM ========== */
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

/* ========== HELPERS ========== */
const $ = id => document.getElementById(id);

function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }

function showPreloader() { show($('preloader')); }
function hidePreloader() { hide($('preloader')); }

function rand(len) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
}

/* ========== MODAL ========== */
function openModal(title, body, actions = []) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = '';
  if (typeof body === 'string') {
    $('modal-body').textContent = body;
  } else {
    $('modal-body').appendChild(body);
  }

  const actionsBox = $('modal-actions');
  actionsBox.innerHTML = '';
  actions.forEach(a => {
    const b = document.createElement('button');
    b.className = a.class || 'btn btn--primary';
    b.textContent = a.text;
    b.disabled = a.disabled || false;
    b.onclick = () => {
      if (a.onClick) a.onClick();
      closeModal();
    };
    actionsBox.appendChild(b);
  });

  show($('modal-overlay'));
}

function closeModal() {
  hide($('modal-overlay'));
}

$('modal-close').onclick = closeModal;

/* ========== STORAGE ========== */
const LS = {
  lang: 'lang',
  token: 'get_UserToken',
  id: 'get_UserID',
  theme: 'theme'
};

/* ========== I18N (МИНИМАЛЬНО) ========== */
const i18n = {
  ru: {
    appTitle: 'Покупка рекламы',
    loading: 'Загрузка…',
    btnCreateAd: 'Создать рекламу',
    btnMyAds: 'Мои рекламы',
    btnSettings: 'Настройки',
    appClosed: 'Приложение закрыто на техническое обслуживание',
    createDisabled: 'Создание реклам отключено',
    chooseLangTitle: 'Выберите язык',
    chooseLangSubtitle: 'Язык можно будет изменить в настройках.',
    adsCreatedLabel: 'Создано реклам',
    crystalsLabel: 'Кристаллы',
    btnReport: 'Сообщить об ошибке',
    btnAdmin: 'Меню админа',
    btnRules: 'Правила бота',
    btnCrystals: 'Кристаллы',
    btnSettings: 'Настройки',
    createTitle: 'Создать рекламу',
    adTextLabel: 'Текст рекламы (обязательно)',
    adTextHint: 'До 500 символов. Нужна ссылка вида https://, t.me/ или @...',
    videoLabel: 'Видео-реклама (обязательно)',
    pickFile: 'Выберите файл',
    removeVideo: 'Удалить видео-рекламу',
    videoHint: 'Только видео. Макс. 50 МБ. Длительность: 5–60 сек.',
    priorityLabel: 'Приоритет',
    prioWeak: 'Слабый',
    prioNormal: 'Нормальный',
    prioGood: 'Хороший (10)',
    prioHigh: 'Высокий (20)',
    prioVeryHigh: 'Очень высокий (40)',
    prioUltra: 'УЛЬТРА (60)',
    platformLabel: 'Площадка рекламы',
    plAny: 'Не важно',
    plChNick: 'Канал “Создать никнейм”',
    plChMCN: 'Канал “Millioner City News”',
    plChGameNews: 'Канал “НОВОСТИ ИГРОВОГО БОТА”',
    plBotNick: 'Бот “Создать никнейм”',
    plBotCity: 'Бот “Создай свой город”',
    plBotGame: 'Бот “Игровой бот”',
    plMiniPhoto: 'Мини-приложение “Сгенерировать фото”',
    plSupport: 'Бот “Служба поддержки” (20)',
    adFooterLabel: 'Рекламный текст',
    adFooterNeedText: 'Сначала добавьте текст рекламы',
    adFooterInfoTitle: 'Текст приписки:',
    adFooterText: 'Эта реклама создана на площадке: @buyAdss_bot .',
    footerTop: 'Сверху',
    footerBottom: 'Снизу',
    footerRemove: 'Убрать текст рекламы',
    commentsLabel: 'Включить комментарии',
    createBtn: 'Создать рекламу',
    createHint: 'После создания реклама уйдёт на проверку.',
    myAdsTitle: 'Мои рекламы',
    noAdsTitle: 'Пока нет реклам',
    noAdsText: 'Создайте первую рекламу в главном меню.',
    crystalsTitle: 'Кристаллы',
    crystalsNow: 'Текущее количество ваших кристаллов:',
    buyCrystalsTitle: 'Выберите сколько кристаллов вы хотите купить.',
    starsOnly: '(Принимаются только Telegram Stars🌟)',
    settingsTitle: 'Настройки',
    langSetting: 'Язык',
    themeSetting: 'Тема',
    themeSystem: 'Как на устройстве',
    themeDark: 'Тёмная',
    themeLight: 'Светлая',
    tokenTitle: 'Ваш токен',
    copy: 'Копировать',
    copied: 'Скопировано!',
    adminTitle: 'Меню админа',
    adminCheck: 'Проверить рекламу',
    adminRestricted: 'Список ограниченных',
    adminToggleCreate: 'Включить/Выключить создание реклам',
    adminBanForever: 'Запретить создавать рекламы (навсегда)',
    adminBlockApp: 'Заблокировать в приложении',
    adminCloseApp: 'Закрыть/Открыть приложение',
    adminCheckTitle: 'Проверка рекламы',
    adminCheckHint: 'Выберите рекламу и решение.',
    adminRestrictedTitle: 'Список ограниченных',
    cancel: 'Отмена',
    yes: 'Да',
    blockedTitle: 'Вы заблокированы',
    blockedSubtitle: 'You have been blocked',
    supportBtn: 'Служба поддержки / Support',
    approveBtn: 'Одобрить',
    rejectBtn: 'Отклонить',
    blockCreatorBtn: 'Заблокировать создателя',
    blockUser: 'Заблокировать',
    errorTitle: 'Ошибка',
    attentionTitle: 'Внимание',
    confirmTitle: 'Подтверждение',
    doneTitle: 'Готово',
    rulesTitle: 'Правила',
    adTextRequired: 'Текст рекламы обязателен',
    linkRequired: 'Нужна ссылка',
    videoRequired: 'Видео обязательно',
    selectPrioAndPlat: 'Выберите приоритет и площадку',
    onlyVideoFiles: 'Только видео файлы',
    maxFileSize: 'Максимальный размер 50 МБ',
    duration5to60: 'Длительность должна быть от 5 до 60 секунд',
    accessDenied: 'Доступ запрещён',
    youHavePending: 'У вас есть реклама на проверке. Дождитесь решения.',
    failedToSaveAd: 'Не удалось сохранить рекламу',
    adSentForReview: 'Реклама отправлена на проверку',
    actionPerformed: 'Действие выполнено',
    failedToPerform: 'Не удалось выполнить действие',
    userBanned: 'Пользователь заблокирован',
    failedToBan: 'Не удалось заблокировать',
    banRemoved: 'Блокировка снята',
    failedToUnban: 'Не удалось снять блокировку',
    settingChanged: 'Настройка изменена',
    failedToChangeSetting: 'Не удалось изменить настройку',
    enterID: 'Введите ID',
    notEnoughCrystals: 'Недостаточно кристаллов',
    confirmSelect: 'Выбрать "',
    confirmSelectEnd: '"',
    confirmFor: ' за ',
    confirmCrystals: ' кристаллов💎?',
    failedToCopy: 'Не удалось скопировать',
    adminEnableCreate: 'Включить создание реклам',
    adminDisableCreate: 'Выключить создание реклам',
    adminOpenApp: 'Открыть приложение',
    adminCloseApp: 'Закрыть приложение',
    pendingStatus: 'На проверке',
    approvedStatus: 'Одобрено',
    rejectedStatus: 'Отклонено',
    comingSoon: 'Скоро',
    paymentNotImplemented: 'Платежи пока не реализованы.',
    buyCrystals: 'Купить кристаллы',
    crystalsAdded: 'Кристаллы добавлены!',
    failedToAddCrystals: 'Не удалось добавить кристаллы',
    failedToCreateInvoice: 'Не удалось создать инвойс'
  },
  en: {
    appTitle: 'Ad Purchase',
    loading: 'Loading…',
    btnCreateAd: 'Create ad',
    btnMyAds: 'My ads',
    btnSettings: 'Settings',
    appClosed: 'App is closed for maintenance',
    createDisabled: 'Ad creation is disabled',
    chooseLangTitle: 'Choose language',
    chooseLangSubtitle: 'Language can be changed in settings.',
    adsCreatedLabel: 'Ads created',
    crystalsLabel: 'Crystals',
    btnReport: 'Report error',
    btnAdmin: 'Admin menu',
    btnRules: 'Bot rules',
    btnCrystals: 'Crystals',
    btnSettings: 'Settings',
    createTitle: 'Create ad',
    adTextLabel: 'Ad text (required)',
    adTextHint: 'Up to 500 characters. Need a link like https://, t.me/ or @...',
    videoLabel: 'Video ad (required)',
    pickFile: 'Pick file',
    removeVideo: 'Remove video ad',
    videoHint: 'Only video. Max 50MB. Duration: 5-60 sec.',
    priorityLabel: 'Priority',
    prioWeak: 'Weak',
    prioNormal: 'Normal',
    prioGood: 'Good (10)',
    prioHigh: 'High (20)',
    prioVeryHigh: 'Very high (40)',
    prioUltra: 'ULTRA (60)',
    platformLabel: 'Ad platform',
    plAny: 'Any',
    plChNick: 'Channel “Create nickname”',
    plChMCN: 'Channel “Millioner City News”',
    plChGameNews: 'Channel “GAME BOT NEWS”',
    plBotNick: 'Bot “Create nickname”',
    plBotCity: 'Bot “Create your city”',
    plBotGame: 'Bot “Game bot”',
    plMiniPhoto: 'Mini-app “Generate photo”',
    plSupport: 'Bot “Support” (20)',
    adFooterLabel: 'Ad footer',
    adFooterNeedText: 'Add ad text first',
    adFooterInfoTitle: 'Footer text:',
    adFooterText: 'This ad was created on the platform: @buyAdss_bot .',
    footerTop: 'Top',
    footerBottom: 'Bottom',
    footerRemove: 'Remove ad text',
    commentsLabel: 'Enable comments',
    createBtn: 'Create ad',
    createHint: 'After creation, the ad will go for review.',
    myAdsTitle: 'My ads',
    noAdsTitle: 'No ads yet',
    noAdsText: 'Create your first ad in the main menu.',
    crystalsTitle: 'Crystals',
    crystalsNow: 'Your current crystals:',
    buyCrystalsTitle: 'Choose how many crystals to buy.',
    starsOnly: '(Only Telegram Stars🌟 accepted)',
    settingsTitle: 'Settings',
    langSetting: 'Language',
    themeSetting: 'Theme',
    themeSystem: 'System',
    themeDark: 'Dark',
    themeLight: 'Light',
    tokenTitle: 'Your token',
    copy: 'Copy',
    copied: 'Copied!',
    adminTitle: 'Admin menu',
    adminCheck: 'Check ad',
    adminRestricted: 'Restricted list',
    adminToggleCreate: 'Enable/Disable ad creation',
    adminBanForever: 'Ban ad creation (forever)',
    adminBlockApp: 'Block in app',
    adminCloseApp: 'Close/Open app',
    adminCheckTitle: 'Ad review',
    adminCheckHint: 'Select ad and decision.',
    adminRestrictedTitle: 'Restricted list',
    cancel: 'Cancel',
    yes: 'Yes',
    blockedTitle: 'You are blocked',
    blockedSubtitle: 'You have been blocked',
    supportBtn: 'Support / Support',
    approveBtn: 'Approve',
    rejectBtn: 'Reject',
    blockCreatorBtn: 'Block creator',
    blockUser: 'Block',
    errorTitle: 'Error',
    attentionTitle: 'Attention',
    confirmTitle: 'Confirmation',
    doneTitle: 'Done',
    rulesTitle: 'Rules',
    adTextRequired: 'Ad text required',
    linkRequired: 'Link required',
    videoRequired: 'Video required',
    selectPrioAndPlat: 'Select priority and platform',
    onlyVideoFiles: 'Only video files',
    maxFileSize: 'Max size 50MB',
    duration5to60: 'Duration 5-60 sec',
    accessDenied: 'Access denied',
    youHavePending: 'You have a pending ad. Wait for review.',
    failedToSaveAd: 'Failed to save ad',
    adSentForReview: 'Ad sent for review',
    actionPerformed: 'Action performed',
    failedToPerform: 'Failed to perform action',
    userBanned: 'User banned',
    failedToBan: 'Failed to ban',
    banRemoved: 'Ban removed',
    failedToUnban: 'Failed to unban',
    settingChanged: 'Setting changed',
    failedToChangeSetting: 'Failed to change setting',
    enterID: 'Enter ID',
    notEnoughCrystals: 'Not enough crystals',
    confirmSelect: 'Choose "',
    confirmSelectEnd: '"',
    confirmFor: ' for ',
    confirmCrystals: ' crystals💎?',
    failedToCopy: 'Failed to copy',
    adminEnableCreate: 'Enable ad creation',
    adminDisableCreate: 'Disable ad creation',
    adminOpenApp: 'Open app',
    adminCloseApp: 'Close app',
    pendingStatus: 'Pending',
    approvedStatus: 'Approved',
    rejectedStatus: 'Rejected',
    comingSoon: 'Coming soon',
    paymentNotImplemented: 'Payments not implemented yet.',
    buyCrystals: 'Buy crystals',
    crystalsAdded: 'Crystals added!',
    failedToAddCrystals: 'Failed to add crystals',
    failedToCreateInvoice: 'Failed to create invoice'
  }
};

function applyLang(lang) {
// Перевод элементов с data-i18n
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[lang]?.[key]) {
      el.textContent = i18n[lang][key];
    }
  });

  // Перевод placeholder'ов
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (i18n[lang]?.[key]) {
      el.placeholder = i18n[lang][key];
    }
  });

  // Перевод <title>
  const titleElement = document.querySelector('title[data-i18n="appTitle"]');
  if (titleElement && i18n[lang]?.appTitle) {
    titleElement.textContent = i18n[lang].appTitle;
  } else if (i18n[lang]?.appTitle) {
    document.title = i18n[lang].appTitle;
  }
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (i18n[lang] && i18n[lang][key]) {
      el.textContent = i18n[lang][key];
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (i18n[lang] && i18n[lang][key]) {
      el.placeholder = i18n[lang][key];
    }
  });
}

/* ========== THEME ========== */
function applyTheme(theme) {
  document.body.classList.remove('theme-dark', 'theme-light');
  if (theme === 'light') {
    document.body.classList.add('theme-light');
  } else if (theme === 'dark') {
    document.body.classList.add('theme-dark');
  } else { // system
    if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      document.body.classList.add('theme-light');
    } else {
      document.body.classList.add('theme-dark');
    }
  }
}

/* ========== SYSTEM SETTINGS ========== */
let systemSettings = { appOpen: true, createEnabled: true };

async function fetchSystemSettings() {
  showPreloader();
  try {
    const res = await fetch(`${GAS_SYS_URL}?action=getSystemSettings`, { method: 'GET', mode: 'cors' });
    const data = await res.json();
    systemSettings = data;
  } catch (e) {
    console.warn('Failed to fetch system settings:', e);
  } finally {
    hidePreloader();
  }
}

/* ========== CHECK USER STATUS ========== */
async function checkUserStatus(isAdmin) {
  const userID = localStorage.getItem(LS.id);
  const token = localStorage.getItem(LS.token);
  const lang = localStorage.getItem(LS.lang) || 'ru';
  showPreloader();
  try {
    const res = await fetch(`${GAS_SYS_URL}?action=checkBan&userID=${userID}`, { method: 'GET', mode: 'cors' });
    const data = await res.json();
    if (data.banned) {
      hideAllScreens();
      show($('screen-blocked'));
      $('user-token-blocked').textContent = token;
      $('btn-support').onclick = () => window.open(SUPPORT_URL, '_blank');
      $('btn-copy-token-blocked').onclick = () => {
        navigator.clipboard.writeText(token).then(() => {
          const span = $('btn-copy-token-blocked').querySelector('span');
          const originalText = span.textContent;
          span.dataset.i18n = 'copied';
          span.textContent = i18n[lang].copied;
          setTimeout(() => {
            span.dataset.i18n = 'copy';
            span.textContent = i18n[lang].copy;
          }, 3000);
        }).catch(() => {
          openModal(i18n[lang].errorTitle, i18n[lang].failedToCopy);
        });
      };
      document.querySelectorAll('#blocked-lang-buttons .seg').forEach(b => {
        b.onclick = () => {
          document.querySelectorAll('#blocked-lang-buttons .seg').forEach(x => x.classList.remove('active'));
          b.classList.add('active');
          const lang = b.dataset.value;
          localStorage.setItem(LS.lang, lang);
          applyLang(lang);
        };
      });
      return false;
    }
    return true;
  } catch (e) {
    console.warn('Failed to check ban:', e);
    return true;
  } finally {
    hidePreloader();
  }
}

/* ========== CHECK APP OPEN ========== */
async function checkAppOpen(isAdmin) {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  await fetchSystemSettings();
  if (!systemSettings.appOpen && !isAdmin) {
    hideAllScreens();
    openModal(i18n[lang].attentionTitle, i18n[lang].appClosed, []);
    $('modal-close').hidden = true; // Can't close
    return false;
  }
  return true;
}

/* ========== FIRST ENTRY ========== */
function firstEntry(lang) {
  localStorage.setItem(LS.lang, lang);
  localStorage.setItem(LS.token, rand(16));
  localStorage.setItem(LS.id, rand(8));

  openModal(
    i18n[lang].rulesTitle,
    RULES_TEXT[lang],
    [{ text: 'OK' }]
  );

  applyLang(lang);
  showMainMenu();
}

/* ========== MAIN MENU ========== */
let currentCrystals = 0;

async function showMainMenu() {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const token = localStorage.getItem(LS.token);
  const isAdmin = ADMIN_TOKENS.includes(token);

  if (!await checkUserStatus(isAdmin)) return;
  if (!await checkAppOpen(isAdmin)) return;

  hideAllScreens();
  show($('screen-main'));

  $('user-token').textContent = token;

  $('nav-admin').hidden = !isAdmin;

  showPreloader();
  try {
    const url = `${GAS_SYS_URL}?action=getAdsCount&userID=${localStorage.getItem(LS.id)}`;
    const res = await fetch(url, { method: 'GET', mode: 'cors' });
    const data = await res.json();
    $('ads-count').textContent = data.ads || 0;
    currentCrystals = data.crystals || 0;
    $('crystals-count').textContent = currentCrystals;
    $('crystals-now').textContent = currentCrystals;

    $('nav-myads').disabled = (data.ads || 0) === 0;
  } catch (e) {
    console.warn('GAS fetch error (CORS):', e);
    $('ads-count').textContent = '0';
    currentCrystals = 0;
    $('crystals-count').textContent = '0';
    $('nav-myads').disabled = true;
  } finally {
    hidePreloader();
  }

  // Disable create if not enabled
  $('nav-create').disabled = !systemSettings.createEnabled;
}

/* ========== NAVIGATION ========== */
function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(s => hide(s));
}

$('btn-open-settings').onclick = () => {
  hideAllScreens();
  show($('screen-settings'));
};

$('nav-admin').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const token = localStorage.getItem(LS.token);
  if (!ADMIN_TOKENS.includes(token)) {
    openModal(i18n[lang].errorTitle, i18n[lang].accessDenied);
    return;
  }
  hideAllScreens();
  show($('screen-admin'));
  updateAdminToggles(); // Update toggle texts
};

$('nav-create').onclick = async () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (!systemSettings.createEnabled) {
    openModal(i18n[lang].errorTitle, i18n[lang].createDisabled);
    return;
  }
  // Check if has pending
  const userID = localStorage.getItem(LS.id);
  showPreloader();
  try {
    const res = await fetch(`${GAS_SYS_URL}?action=hasPending&userID=${userID}`, { method: 'GET', mode: 'cors' });
    const data = await res.json();
    if (data.hasPending) {
      openModal(i18n[lang].errorTitle, i18n[lang].youHavePending);
      return;
    }
  } catch (e) {
    console.warn('Failed to check pending:', e);
  } finally {
    hidePreloader();
  }
  hideAllScreens();
  show($('screen-create'));
  $('btn-create-ad').disabled = !systemSettings.createEnabled;
  if ($('crystals-in-create')) {
    $('crystals-in-create').textContent = currentCrystals;
  }
};

$('nav-myads').onclick = () => {
  hideAllScreens();
  show($('screen-myads'));
  loadMyAds();
};

$('nav-settings').onclick = () => {
  hideAllScreens();
  show($('screen-settings'));
};

$('nav-rules').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  openModal(i18n[lang].rulesTitle, RULES_TEXT[lang], [
    { text: 'OK' }
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
[
  'back-from-create',
  'back-from-myads',
  'back-from-settings',
  'back-from-crystals',
  'back-from-admin'
].forEach(id => {
  const el = $(id);
  if (el) el.onclick = showMainMenu;
});

/* ========== CREATE AD LOGIC ========== */
let commentsEnabled = false;
let selectedPriority = null;
let selectedPlatform = null;
let videoFile = null;
let footer = 'top';

/* toggle comments */
$('toggle-comments').onclick = () => {
  commentsEnabled = !commentsEnabled;
  $('toggle-comments-ico').className =
    commentsEnabled
      ? 'fa-solid fa-toggle-on fa-2xl'
      : 'fa-solid fa-toggle-off fa-2xl';
  $('toggle-comments-ico').style.color = '#343ca2';
};

/* priority buttons */
document.querySelectorAll('#priority-buttons .seg').forEach(b => {
  b.onclick = async () => {
    const lang = localStorage.getItem(LS.lang) || 'ru';
    const cost = parseInt(b.dataset.cost) || 0;
    if (cost > currentCrystals) {
      openModal(i18n[lang].errorTitle, i18n[lang].notEnoughCrystals);
      return;
    }
    let confirmed = true;
    if (cost > 0) {
      confirmed = await new Promise(resolve => {
        openModal(i18n[lang].confirmTitle, `${i18n[lang].confirmSelect}${b.textContent}${i18n[lang].confirmSelectEnd}${i18n[lang].confirmFor}${cost}${i18n[lang].confirmCrystals}`, [
          { text: i18n[lang].cancel, class: 'btn btn--ghost', onClick: () => resolve(false) },
          { text: i18n[lang].yes, class: 'btn btn--primary', onClick: () => resolve(true) }
        ]);
      });
    }
    if (!confirmed) return;
    document.querySelectorAll('#priority-buttons .seg')
      .forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    selectedPriority = b.dataset.value;
  };
});

/* platform buttons */
document.querySelectorAll('#platform-buttons .seg').forEach(b => {
  b.onclick = async () => {
    const lang = localStorage.getItem(LS.lang) || 'ru';
    const cost = parseInt(b.dataset.cost) || 0;
    if (cost > currentCrystals) {
      openModal(i18n[lang].errorTitle, i18n[lang].notEnoughCrystals);
      return;
    }
    let confirmed = true;
    if (cost > 0) {
      confirmed = await new Promise(resolve => {
        openModal(i18n[lang].confirmTitle, `${i18n[lang].confirmSelect}${b.textContent}${i18n[lang].confirmSelectEnd}${i18n[lang].confirmFor}${cost}${i18n[lang].confirmCrystals}`, [
          { text: i18n[lang].cancel, class: 'btn btn--ghost', onClick: () => resolve(false) },
          { text: i18n[lang].yes, class: 'btn btn--primary', onClick: () => resolve(true) }
        ]);
      });
    }
    if (!confirmed) return;
    document.querySelectorAll('#platform-buttons .seg')
      .forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    selectedPlatform = b.dataset.value;
  };
});

/* video */
$('btn-pick-video').onclick = () => $('video-input').click();

$('video-input').onchange = e => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const f = e.target.files[0];
  if (!f) return;

  if (!f.type.startsWith('video/')) {
    openModal(i18n[lang].errorTitle, i18n[lang].onlyVideoFiles);
    return;
  }

  if (f.size > 50 * 1024 * 1024) {
    openModal(i18n[lang].errorTitle, i18n[lang].maxFileSize);
    return;
  }

  // Get duration
  const video = document.createElement('video');
  video.src = URL.createObjectURL(f);
  video.onloadedmetadata = () => {
    const dur = Math.round(video.duration);
    if (dur < 5 || dur > 60) {
      openModal(i18n[lang].errorTitle, i18n[lang].duration5to60);
      return;
    }
    $('video-duration').textContent = dur + 's';
  };

  videoFile = f;
  $('video-name').textContent = f.name;
  $('video-size').textContent = (f.size / 1024 / 1024).toFixed(1) + ' MB';
  show($('video-meta'));
  show($('btn-remove-video'));
};

$('btn-remove-video').onclick = () => {
  videoFile = null;
  $('video-input').value = '';
  hide($('video-meta'));
  hide($('btn-remove-video'));
};

/* ad text input */
$('ad-text').oninput = () => {
  const text = $('ad-text').value.trim();
  const valid = text.length > 0 && text.length <= 500 && /(https:\/\/|t\.me\/|@)/i.test(text);
  if (valid) {
    hide($('ad-footer-empty'));
    show($('ad-footer-controls'));
  } else {
    show($('ad-footer-empty'));
    hide($('ad-footer-controls'));
  }
};

/* footer buttons */
$('footer-top').onclick = () => {
  document.querySelectorAll('#ad-footer-controls .btn')
    .forEach(x => x.classList.remove('active'));
  $('footer-top').classList.add('active');
  footer = 'top';
};

$('footer-bottom').onclick = () => {
  document.querySelectorAll('#ad-footer-controls .btn')
    .forEach(x => x.classList.remove('active'));
  $('footer-bottom').classList.add('active');
  footer = 'bottom';
};

$('footer-remove').onclick = async () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (10 > currentCrystals) {
    openModal(i18n[lang].errorTitle, i18n[lang].notEnoughCrystals);
    return;
  }
  let confirmed = false;
  await new Promise(resolve => {
    openModal(i18n[lang].confirmTitle, `${i18n[lang].confirmSelect}${$('footer-remove').textContent}${i18n[lang].confirmSelectEnd}${i18n[lang].confirmFor}10${i18n[lang].confirmCrystals}`, [
      { text: i18n[lang].cancel, class: 'btn btn--ghost', onClick: () => resolve(false) },
      { text: i18n[lang].yes, class: 'btn btn--primary', onClick: () => resolve(true) }
    ]);
  });
  if (!confirmed) return;
  document.querySelectorAll('#ad-footer-controls .btn')
    .forEach(x => x.classList.remove('active'));
  $('footer-remove').classList.add('active');
  footer = 'none';
};

// Default footer top active
if ($('footer-top')) $('footer-top').classList.add('active');

/* CREATE */
$('btn-create-ad').onclick = async () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (!systemSettings.createEnabled) {
    openModal(i18n[lang].errorTitle, i18n[lang].createDisabled);
    return;
  }

  const text = $('ad-text').value.trim();

  if (!text) {
    openModal(i18n[lang].errorTitle, i18n[lang].adTextRequired);
    return;
  }

  if (!/(https:\/\/|t\.me\/|@)/i.test(text)) {
    openModal(i18n[lang].errorTitle, i18n[lang].linkRequired);
    return;
  }

  if (!videoFile) {
    openModal(i18n[lang].errorTitle, i18n[lang].videoRequired);
    return;
  }

  if (!selectedPriority || !selectedPlatform) {
    openModal(i18n[lang].errorTitle, i18n[lang].selectPrioAndPlat);
    return;
  }

  showPreloader();

  const adName = 'Ad_' + rand(12);

  try {
    // Upload video to Telegram bot
    const formData = new FormData();
    formData.append('chat_id', BOT_CHAT_ID);
    formData.append('video', videoFile);
    const uploadRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendVideo`, {
      method: 'POST',
      body: formData
    });
    const uploadData = await uploadRes.json();
    if (!uploadData.ok) {
      throw new Error('Video upload failed');
    }
    const fileId = uploadData.result.video.file_id;

    // Get file path
    const fileRes = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    if (!fileData.ok) {
      throw new Error('Get file failed');
    }
    const filePath = fileData.result.file_path;
    const videoUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;

    // Notify admin
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: BOT_CHAT_ID,
        text: `🆕 New ad\n${adName}\nID: ${localStorage.getItem(LS.id)}`
      })
    });

    // Save to GAS (pending)
    const params = new URLSearchParams({
      action: 'saveAd',
      text,
      videoUrl,
      platform: selectedPlatform,
      name: adName,
      comments: commentsEnabled ? 1 : 0,
      userID: localStorage.getItem(LS.id),
      token: localStorage.getItem(LS.token),
      priority: selectedPriority,
      footer
    });

    await fetch(`${GAS_SYS_URL}?${params.toString()}`, {
      method: 'GET',
      mode: 'cors'
    });

    openModal(
      i18n[lang].doneTitle,
      i18n[lang].adSentForReview,
      [{ text: 'OK', onClick: showMainMenu }]
    );

    // After create, check if app still open
    await fetchSystemSettings();
    checkAppOpen(ADMIN_TOKENS.includes(localStorage.getItem(LS.token)));

  } catch (e) {
    openModal(i18n[lang].errorTitle, i18n[lang].failedToSaveAd);
  } finally {
    hidePreloader();
  }
};

/* ========== SETTINGS ========== */
$('btn-copy-token').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  navigator.clipboard.writeText(localStorage.getItem(LS.token)).then(() => {
    const span = $('btn-copy-token').querySelector('span');
    const originalText = span.textContent;
    span.dataset.i18n = 'copied';
    span.textContent = i18n[lang].copied;
    setTimeout(() => {
      span.dataset.i18n = 'copy';
      span.textContent = i18n[lang].copy;
    }, 3000);
  }).catch(() => {
    openModal(i18n[lang].errorTitle, i18n[lang].failedToCopy);
  });
};

// Language buttons
document.querySelectorAll('#settings-lang-buttons .seg').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#settings-lang-buttons .seg').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const lang = b.dataset.value;
    localStorage.setItem(LS.lang, lang);
    applyLang(lang);
  };
});

// Theme buttons
document.querySelectorAll('#settings-theme-buttons .seg').forEach(b => {
  b.onclick = () => {
    document.querySelectorAll('#settings-theme-buttons .seg').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    const theme = b.dataset.value;
    localStorage.setItem(LS.theme, theme);
    applyTheme(theme);
  };
});

/* ========== MY ADS ========== */
async function loadMyAds() {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  showPreloader();
  const list = $('myads-list');
  list.innerHTML = '';
  try {
    const res = await fetch(`${GAS_SYS_URL}?action=getMyAds&userID=${localStorage.getItem(LS.id)}`, { method: 'GET', mode: 'cors' });
    const data = await res.json();
    if (data.length === 0) {
      show($('myads-empty'));
    } else {
      hide($('myads-empty'));
      data.forEach(ad => {
        const status = ad.status || 'pending';
        const statusClass = status === 'pending' ? 'pill--pending' : status === 'approved' ? 'pill--success' : 'pill--danger';
        const statusText = i18n[lang][status + 'Status'];
        const card = document.createElement('div');
        card.className = 'card ad-card';
        card.innerHTML = `
          <div class="ad-card__head">
            <div class="ad-card__name">${ad.name}</div>
            <div class="pill ${statusClass}">${statusText}</div>
          </div>
          <div class="ad-card__meta">Platform: ${ad.platform} • Priority: ${ad.priority}</div>
        `;
        list.appendChild(card);
      });
    }
  } catch (e) {
    console.warn('Failed to fetch my ads:', e);
    show($('myads-empty'));
  } finally {
    hidePreloader();
  }
}

/* ========== CRYSTALS ========== */
function loadCrystals() {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  $('crystals-now').textContent = currentCrystals;
  const container = $('crystals-buttons');
  container.innerHTML = '';
  CRYSTALS_BUTTONS.forEach(item => {
    const b = document.createElement('button');
    b.className = 'btn btn--primary btn--full';
    b.innerHTML = `${item.crystals} 💎 за ${item.price} ⭐`;
    b.onclick = () => buyCrystals(item.crystals, item.price);
    container.appendChild(b);
  });
}

async function buyCrystals(amount, stars) {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        title: `${amount} Crystals`,
        description: `Purchase ${amount} crystals for ${stars} Telegram Stars`,
        payload: `${localStorage.getItem(LS.id)}:${amount}`,
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
          await fetch(`${GAS_SYS_URL}?action=addCrystals&userID=${localStorage.getItem(LS.id)}&amount=${amount}`, {method: 'GET', mode: 'cors'});
          currentCrystals += amount;
          $('crystals-now').textContent = currentCrystals;
          $('crystals-count').textContent = currentCrystals;
          if ($('crystals-in-create')) $('crystals-in-create').textContent = currentCrystals;
          openModal(i18n[lang].doneTitle, i18n[lang].crystalsAdded);
        } catch (e) {
          openModal(i18n[lang].errorTitle, i18n[lang].failedToAddCrystals);
        } finally {
          hidePreloader();
        }
      }
    });
  } catch (e) {
    openModal(i18n[lang].errorTitle, `${i18n[lang].failedToCreateInvoice}: ${e.message}`);
  }
}

/* ========== ADMIN FUNCTIONS ========== */
async function updateAdminToggles() {
  await fetchSystemSettings();
  const lang = localStorage.getItem(LS.lang) || 'ru';
  $('admin-toggle-create-text').textContent = systemSettings.createEnabled ? i18n[lang].adminDisableCreate : i18n[lang].adminEnableCreate;
  $('admin-close-app-text').textContent = systemSettings.appOpen ? i18n[lang].adminCloseApp : i18n[lang].adminOpenApp;
}

$('admin-check').onclick = async () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  showPreloader();
  show($('admin-panel-check'));
  const list = $('admin-check-list');
  list.innerHTML = '';
  try {
    const res = await fetch(`${GAS_SYS_URL}?action=getPendingAds`, { method: 'GET', mode: 'cors' });
    const data = await res.json();
    data.forEach(ad => {
      const card = document.createElement('div');
      card.className = 'card ad-card';
      card.innerHTML = `
        <div class="ad-card__head">
          <div class="ad-card__name">${ad.name}</div>
          <div class="pill pill--pending">Pending</div>
        </div>
        <div class="ad-card__meta">Platform: ${ad.platform} • Priority: ${ad.priority}</div>
        <div class="row">
          <button class="btn btn--primary approve" data-i18n="approveBtn">Approve</button>
          <button class="btn btn--ghost reject" data-i18n="rejectBtn">Reject</button>
          <button class="btn btn--danger ban-creator" data-i18n="blockCreatorBtn">Block creator</button>
        </div>
      `;
      card.querySelector('.approve').onclick = () => handleAdAction(ad.name, 'approve');
      card.querySelector('.reject').onclick = () => handleAdAction(ad.name, 'reject', ad.userID);
      card.querySelector('.ban-creator').onclick = () => handleAdAction(ad.name, 'banUser', ad.userID);
      list.appendChild(card);
    });
    applyLang(lang); // Reapply lang for dynamic elements
  } catch (e) {
    console.warn('Failed to fetch pending ads:', e);
  } finally {
    hidePreloader();
  }
};

async function handleAdAction(adName, action, userID = null) {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  showPreloader();
  try {
    let url = `${GAS_SYS_URL}?action=${action}&adName=${adName}`;
    if (action === 'banUser' || action === 'reject') {
      url += `&userID=${userID}`;
    }
    await fetch(url, { method: 'GET', mode: 'cors' });
    openModal(i18n[lang].doneTitle, i18n[lang].actionPerformed);
    // Refresh list
    $('admin-check').click();
  } catch (e) {
    openModal(i18n[lang].errorTitle, i18n[lang].failedToPerform);
  } finally {
    hidePreloader();
  }
}

$('admin-restricted').onclick = async () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  showPreloader();
  show($('admin-panel-restricted'));
  const list = $('admin-restricted-list');
  list.innerHTML = '';
  try {
    const res = await fetch(`${GAS_SYS_URL}?action=getBannedUsers`, { method: 'GET', mode: 'cors' });
    const data = await res.json();
    data.forEach(user => {
      const item = document.createElement('div');
      item.className = 'note';
      item.innerHTML = `
        Token: ${user.token}<br>
        ID: ${user.id}<br>
        Type: ${user.type} ${user.end_time ? '(ends ' + user.end_time + ')' : ''}<br>
        <button class="btn btn--primary unban">Unban</button>
      `;
      item.querySelector('.unban').onclick = () => handleUnban(user.id);
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
  showPreloader();
  try {
    await fetch(`${GAS_SYS_URL}?action=unbanUser&userID=${userID}`, { method: 'GET', mode: 'cors' });
    openModal(i18n[lang].doneTitle, i18n[lang].banRemoved);
    // Refresh list
    $('admin-restricted').click();
  } catch (e) {
    openModal(i18n[lang].errorTitle, i18n[lang].failedToUnban);
  } finally {
    hidePreloader();
  }
}

$('admin-toggle-create').onclick = async () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  showPreloader();
  try {
    await fetch(`${GAS_SYS_URL}?action=toggleCreate`, { method: 'GET', mode: 'cors' });
    await fetchSystemSettings();
    updateAdminToggles();
    openModal(i18n[lang].doneTitle, i18n[lang].settingChanged);
  } catch (e) {
    openModal(i18n[lang].errorTitle, i18n[lang].failedToChangeSetting);
  } finally {
    hidePreloader();
  }
};

$('admin-ban-forever').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const body = document.createElement('div');
  body.innerHTML = `
    <input id="ban-user-id" type="text" placeholder="User ID" class="textarea">
  `;
  openModal(i18n[lang].confirmTitle, body, [
    { text: i18n[lang].cancel, class: 'btn btn--ghost', onClick: () => { } },
    { text: i18n[lang].blockUser, class: 'btn btn--danger', onClick: async () => {
      const userID = $('ban-user-id').value.trim();
      if (!userID) {
        openModal(i18n[lang].errorTitle, i18n[lang].enterID);
        return;
      }
      showPreloader();
      try {
        await fetch(`${GAS_SYS_URL}?action=banUser&userID=${userID}&type=perm`, { method: 'GET', mode: 'cors' });
        openModal(i18n[lang].doneTitle, i18n[lang].userBanned);
      } catch (e) {
        openModal(i18n[lang].errorTitle, i18n[lang].failedToBan);
      } finally {
        hidePreloader();
      }
    }, disabled: true } // Initially disabled
  ]);
  $('ban-user-id').oninput = () => {
    const btn = document.querySelector('.modal__actions .btn--danger');
    btn.disabled = !$('ban-user-id').value.trim();
  };
};

$('admin-block-app').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const body = document.createElement('div');
  body.innerHTML = `
    <input id="block-user-id" type="text" placeholder="User ID" class="textarea">
  `;
  openModal(i18n[lang].confirmTitle, body, [
    { text: i18n[lang].cancel, class: 'btn btn--ghost', onClick: () => { } },
    { text: i18n[lang].blockUser, class: 'btn btn--danger', onClick: async () => {
      const userID = $('block-user-id').value.trim();
      if (!userID) {
        openModal(i18n[lang].errorTitle, i18n[lang].enterID);
        return;
      }
      showPreloader();
      try {
        await fetch(`${GAS_SYS_URL}?action=banUser&userID=${userID}&type=perm`, { method: 'GET', mode: 'cors' });
        openModal(i18n[lang].doneTitle, i18n[lang].userBanned);
      } catch (e) {
        openModal(i18n[lang].errorTitle, i18n[lang].failedToBan);
      } finally {
        hidePreloader();
      }
    }, disabled: true } // Initially disabled
  ]);
  $('block-user-id').oninput = () => {
    const btn = document.querySelector('.modal__actions .btn--danger');
    btn.disabled = !$('block-user-id').value.trim();
  };
};

$('admin-close-app').onclick = async () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  showPreloader();
  try {
    await fetch(`${GAS_SYS_URL}?action=toggleAppOpen`, { method: 'GET', mode: 'cors' });
    await fetchSystemSettings();
    updateAdminToggles();
    openModal(i18n[lang].doneTitle, i18n[lang].settingChanged);
  } catch (e) {
    openModal(i18n[lang].errorTitle, i18n[lang].failedToChangeSetting);
  } finally {
    hidePreloader();
  }
};

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', async () => {
  showPreloader();

  const lang = localStorage.getItem(LS.lang);
  const theme = localStorage.getItem(LS.theme) || 'system';
  applyTheme(theme);

  await fetchSystemSettings();

  if (!lang) {
    hideAllScreens();
    show($('screen-first'));
    $('lang-ru').onclick = () => firstEntry('ru');
    $('lang-en').onclick = () => firstEntry('en');
  } else {
    applyLang(lang);
    const isAdmin = ADMIN_TOKENS.includes(localStorage.getItem(LS.token));
    if (await checkUserStatus(isAdmin) && await checkAppOpen(isAdmin)) {
      await showMainMenu();
    }

    // Set active lang button
    const langBtn = document.querySelector(`#settings-lang-buttons .seg[data-value="${lang}"]`);
    if (langBtn) langBtn.classList.add('active');
  }

  // Default active buttons
  const prioFirst = document.querySelector('#priority-buttons .seg:first-child');
  if (prioFirst) {
    prioFirst.classList.add('active');
    selectedPriority = prioFirst.dataset.value;
  }

  const platFirst = document.querySelector('#platform-buttons .seg:first-child');
  if (platFirst) {
    platFirst.classList.add('active');
    selectedPlatform = platFirst.dataset.value;
  }

  hidePreloader();
});