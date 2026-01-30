/* ======================================================
   script.js
====================================================== */

/* ========== PLACEHOLDERS (НЕ УДАЛЯТЬ) ========== */
const BOT_TOKEN = '7633424551:AAH8JptpFazBaf7FlfCVrDjhquI1JYxf3RM';
const BOT_CHAT_ID = '6434781065';
const REPORT_ERROR_URL = 'https://t.me/Clickerstart_bot';
const SUPPORT_URL = 'https://t.me/Clickerstart_bot';
const ADMIN_TOKENS = ['vvP4vcDqmWsDi05B', 'L7DE073SCSHV7T8V'];

/* ========== ЛОКАЛЬНЫЕ ФЛАГИ (новые) ========== */
const closeApp = '';           // '' или 'closed'
const disableCreateAds = '';   // '' или 'disabled'
const banForeverAds = [];
const blockInApp = [];

/* ========== RULES TEXT ========== */
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
4.2. При повторных нарушениях аккаунт рекламодателя может быть заблокирован без права восстановления.`,
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
4.2. Repeated violations may result in permanent account blocking without the right to restoration.`
};

/* ========== CRYSTALS BUTTONS ========== */
const CRYSTALS_BUTTONS = [
  { crystals: 10, price: 10 },
  { crystals: 50, price: 50 },
  { crystals: 100, price: 90 },
  { crystals: 200, price: 170 },
  { crystals: 500, price: 400 },
  { crystals: 1000, price: 750 }
];

/* ========== GAS URLS ========== */
const GAS_SYS_URL = 'https://script.google.com/macros/s/AKfycbz-_mGdrZ5_EhllBCbYcqm0F22N89xocvK11Iz7gqGFXTGr3ki00CZed91jsYiYZ9r9Tw/exec';
const GAS_ADS_URL = 'https://script.google.com/macros/s/AKfycbxYdza5qUzIoCie-wMl-d0gBFQDgiy1jLf3jHAvJnt_H1hIeGL88M6JRn-lJhNnA3MVWg/exec';

/* ========== TELEGRAM ========== */
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

/* ========== HELPERS ========== */
const $ = id => document.getElementById(id);
function show(el) { if (!el) return; try { el.hidden = false; } catch (e) { /* ignore */ } }
function hide(el) { if (!el) return; try { el.hidden = true; } catch (e) { /* ignore */ } }
function showPreloader() { show($('preloader')); }
function hidePreloader() { hide($('preloader')); }
let modalOnCloseCallback = null;
function rand(len) {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < len; i++) {
    s += chars[Math.floor(Math.random() * chars.length)];
  }
  return s;
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
  id: 'get_UserID',
  theme: 'theme'
};

/* ========== I18N ========== */
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
    prioGood: 'Хороший (10💎)',
    prioHigh: 'Высокий (20💎)',
    prioVeryHigh: 'Очень высокий (40💎)',
    prioUltra: 'УЛЬТРА (60💎)',
    platformLabel: 'Площадка рекламы',
    plAny: 'Не важно',
    plChNick: 'Канал “Создать никнейм”',
    plChMCN: 'Канал “Millioner City News”',
    plChGameNews: 'Канал “НОВОСТИ ИГРОВОГО БОТА”',
    plBotNick: 'Бот “Создать никнейм”',
    plBotCity: 'Бот “Создай свой город”',
    plBotGame: 'Бот “Игровой бот”',
    plMiniPhoto: 'Мини-приложение “Сгенерировать фото”',
    plSupport: 'Бот “Служба поддержки” (20💎)',
    adFooterLabel: 'Рекламный текст',
    adFooterNeedText: 'Сначала добавьте текст рекламы',
    adFooterInfoTitle: 'Текст приписки:',
    adFooterText: 'Эта реклама создана на площадке: @buyAdss_bot .',
    footerTop: 'Сверху',
    footerBottom: 'Снизу',
    footerRemove: 'Убрать рекламный текст из текста рекламы',
    commentsLabel: 'Включить комментарии',
    createBtn: 'Создать рекламу',
    saveChanges: 'Сохранить изменения',
    createHint: 'После создания реклама уйдёт на проверку.',
    myAdsTitle: 'Мои рекламы',
    noAdsTitle: 'Пока нет реклам',
    noAdsText: 'Создайте первую рекламу в главном меню.',
    crystalsTitle: 'Кристаллы',
    crystalsNow: 'Текущее количество ваших кристаллов:',
    buyCrystalsTitle: 'Выберите сколько кристаллов вы хотите купить.',
    starsOnly: '(Принимаются только Telegram Stars🌟)',
    buyCrystalsBtn: '{crystals} 💎 за {price} ⭐',
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
    adEdited: 'Реклама отредактирована.',
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
    failedToCreateInvoice: 'Не удалось создать инвойс',
    edit: 'Редактировать',
    delete: 'Удалить',
    deleteAll: 'Удалить все рекламы',
    viewed: 'Рекламу посмотрели:',
    enabled: 'Включены',
    disabled: 'Выключены',
    telegramID: 'Telegram ID',
    tokenLabel: 'Токен',
    footerLabel: 'Рекламный текст', //Для меню "Мои рекламы",
    adName: 'Название рекламы',
    comments: 'Комментарии',
    footerText: 'Рекламный текст',
    crystalsSpent: 'Кристаллов потрачено',
    status: 'Статус',
    noFooter: 'Убрано',
    footerTop: 'Сверху',
    footerBottom: 'Снизу'
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
    prioGood: 'Good (10💎)',
    prioHigh: 'High (20💎)',
    prioVeryHigh: 'Very high (40💎)',
    prioUltra: 'ULTRA (60💎)',
    platformLabel: 'Ad platform',
    plAny: 'Any',
    plChNick: 'Channel “Create nickname”',
    plChMCN: 'Channel “Millioner City News”',
    plChGameNews: 'Channel “GAME BOT NEWS”',
    plBotNick: 'Bot “Create nickname”',
    plBotCity: 'Bot “Create your city”',
    plBotGame: 'Bot “Game bot”',
    plMiniPhoto: 'Mini-app “Generate photo”',
    plSupport: 'Bot “Support” (20💎)',
    adFooterLabel: 'Ad footer',
    adFooterNeedText: 'Add ad text first',
    adFooterInfoTitle: 'Footer text:',
    adFooterText: 'This ad was created on the platform: @buyAdss_bot .',
    footerTop: 'Top',
    footerBottom: 'Bottom',
    footerRemove: 'Remove advertising text from the ad text',
    commentsLabel: 'Enable comments',
    createBtn: 'Create ad',
    saveChanges: 'Save changes',
    createHint: 'After creation, the ad will go for review.',
    myAdsTitle: 'My ads',
    noAdsTitle: 'No ads yet',
    noAdsText: 'Create your first ad in the main menu.',
    crystalsTitle: 'Crystals',
    crystalsNow: 'Your current crystals:',
    buyCrystalsTitle: 'Choose how many crystals to buy.',
    starsOnly: '(Only Telegram Stars🌟 accepted)',
    buyCrystalsBtn: '{crystals} 💎 for {price} ⭐',
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
    adEdited: 'Ad edited.',
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
    failedToCreateInvoice: 'Failed to create invoice',
    edit: 'Edit',
    delete: 'Delete',
    deleteAll: 'Delete all ads',
    viewed: 'Ad viewed:',
    enabled: 'Enabled',
    disabled: 'Disabled',
    telegramID: 'Telegram ID',
    tokenLabel: 'Token',
    footerLabel: 'Advertising text', //Для меню "Мои рекламы",
    adName: 'Ad name',
    comments: 'Comments',
    footerText: 'Ad footer',
    crystalsSpent: 'Crystals spent',
    status: 'Status',
    noFooter: 'Removed',
    footerTop: 'Top',
    footerBottom: 'Bottom'
  }
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

if (telegramUserId) {
  localStorage.setItem('get_UserID', telegramUserId.toString());
} else if (!localStorage.getItem('get_UserID')) {
  // fallback только если Telegram ID отсутствует
  localStorage.setItem('get_UserID', generateRandomString(12));
}
console.log('Telegram User ID:', telegramUserId);

if (!localStorage.getItem('get_UserToken')) {
  localStorage.setItem('get_UserToken', generateRandomString(16));
}
if (!localStorage.getItem('get_UserID')) {
  const userID = tg.initDataUnsafe.user ? tg.initDataUnsafe.user.id.toString() : generateRandomString(12);
  localStorage.setItem('get_UserID', userID);
}

const USER_TOKEN = localStorage.getItem('get_UserToken');
const USER_ID = localStorage.getItem('get_UserID');

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
  const userID = localStorage.getItem(LS.id);
  const token = localStorage.getItem(LS.token);
  const lang = localStorage.getItem(LS.lang) || 'ru';
  showPreloader();
  try {
    const isBanned = banForeverAds.includes(userID) || blockInApp.includes(userID);
    if (isBanned) {
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
          openModal(i18n[lang].errorTitle, i18n[lang].failedToCopy);
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
  pre.textContent = RULES_TEXT[lang];
  openModal(i18n[lang].rulesTitle, pre, [{ text: 'OK' }]);
  applyLang(lang);
  showMainMenu();
}

/* ========== MAIN MENU ========== */
let currentCrystals = 0;

async function updateAdsCount() {
  try {
    // Fetch pending and all ads, then count only non-rejected ads + pending
    const userID = localStorage.getItem(LS.id);
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
      const res = await fetch(`${GAS_SYS_URL}?action=getAdsCount&userID=${localStorage.getItem(LS.id)}`);
      const data = await res.json();
      $('ads-count').textContent = data.ads;
      localStorage.setItem('adsCount', data.ads);
    } catch (err) {
      $('ads-count').textContent = localStorage.getItem('adsCount') || 0;
    }
  }
  $('nav-myads').disabled = parseInt(localStorage.getItem('adsCount')) === 0;
}

async function showMainMenu() {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const token = localStorage.getItem(LS.token);
  const isAdmin = ADMIN_TOKENS.includes(token);

  if (!await checkUserStatus(isAdmin)) return;
  if (!checkAppOpen(isAdmin)) return;

  hideAllScreens();
  show($('screen-main'));
  $('user-token').textContent = token;
  $('nav-admin').hidden = !isAdmin;

  await updateAdsCount();
  currentCrystals = parseInt(localStorage.getItem('crystals')) || 0;
  $('crystals-count').textContent = currentCrystals;
  $('crystals-now').textContent = currentCrystals;

  // Локальное отключение создания
  $('nav-create').disabled = disableCreateAds === 'disabled';
}

/* ========== NAVIGATION ========== */
function hideAllScreens() {
  document.querySelectorAll('.screen').forEach(s => hide(s));
}

$('btn-open-settings').onclick = () => {
  previousScreen = document.querySelector('.screen:not([hidden])').id || 'screen-main';
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
};

$('nav-create').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  if (disableCreateAds === 'disabled') {
    openModal(i18n[lang].errorTitle, i18n[lang].createDisabled);
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
  $('crystals-in-create').textContent = currentCrystals;

  // Run pending check in background; if user has pending ad — inform and return to main
  (async () => {
    try {
      const userID = localStorage.getItem(LS.id);
      const res = await fetch(`${GAS_SYS_URL}?action=hasPending&userID=${userID}`);
      const data = await res.json();
      if (data.hasPending) {
        openModal(i18n[lang].errorTitle, i18n[lang].youHavePending);
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

$('nav-settings').onclick = () => {
  previousScreen = document.querySelector('.screen:not([hidden])').id || 'screen-main';
  hideAllScreens();
  show($('screen-settings'));
};

$('nav-rules').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const pre = document.createElement('pre');
  pre.className = 'rules__text';
  pre.textContent = RULES_TEXT[lang];
  openModal(i18n[lang].rulesTitle, pre, [{ text: 'OK' }]);
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
['back-from-create','back-from-myads','back-from-crystals','back-from-admin'].forEach(id => {
  const el = $(id);
  if (el) el.onclick = showMainMenu;
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
};

const commentsLabel = document.querySelector('.row--between .field__label[data-i18n="commentsLabel"]');
if (commentsLabel) commentsLabel.onclick = () => $('toggle-comments').click();

document.querySelectorAll('#priority-buttons .seg').forEach(b => {
  b.onclick = async () => {
    const lang = localStorage.getItem(LS.lang) || 'ru';
    const cost = parseInt(b.dataset.cost) || 0;
    let confirmed = true;
    if (cost > 0) {
      // When editing, need to check if user has enough crystals (considering what was already spent)
      const availableCrystals = editMode ? currentCrystals + editCost : currentCrystals;
      if (cost > availableCrystals) {
        openModal(i18n[lang].errorTitle, i18n[lang].notEnoughCrystals);
        return;
      }
      confirmed = await new Promise(resolve => {
        openModal(i18n[lang].confirmTitle, `${i18n[lang].confirmSelect}${b.textContent}${i18n[lang].confirmSelectEnd}${i18n[lang].confirmFor}${cost}${i18n[lang].confirmCrystals}`, [
          { text: i18n[lang].cancel, class: 'btn btn--ghost', onClick: () => resolve(false) },
          { text: i18n[lang].yes, class: 'btn btn--primary', onClick: () => resolve(true) }
        ]);
      });
    }
    if (!confirmed) return;
    document.querySelectorAll('#priority-buttons .seg').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    selectedPriority = b.dataset.value;
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
        openModal(i18n[lang].errorTitle, i18n[lang].notEnoughCrystals);
        return;
      }
      confirmed = await new Promise(resolve => {
        openModal(i18n[lang].confirmTitle, `${i18n[lang].confirmSelect}${b.textContent}${i18n[lang].confirmSelectEnd}${i18n[lang].confirmFor}${cost}${i18n[lang].confirmCrystals}`, [
          { text: i18n[lang].cancel, class: 'btn btn--ghost', onClick: () => resolve(false) },
          { text: i18n[lang].yes, class: 'btn btn--primary', onClick: () => resolve(true) }
        ]);
      });
    }
    if (!confirmed) return;
    document.querySelectorAll('#platform-buttons .seg').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    selectedPlatform = b.dataset.value;
  };
});

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
};
$('footer-top').onclick = () => {
  document.querySelectorAll('#ad-footer-controls .btn').forEach(x => x.classList.remove('active'));
  $('footer-top').classList.add('active');
  footer = 'top';
  updatePreview();
};
$('footer-bottom').onclick = () => {
  document.querySelectorAll('#ad-footer-controls .btn').forEach(x => x.classList.remove('active'));
  $('footer-bottom').classList.add('active');
  footer = 'bottom';
  updatePreview();
};
$('footer-remove').onclick = async () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  const cost = 10;
  let confirmed = true;
  if (!editMode) {
    if (cost > currentCrystals) {
      openModal(i18n[lang].errorTitle, i18n[lang].notEnoughCrystals);
      return;
    }
    confirmed = await new Promise(resolve => {
      openModal(i18n[lang].confirmTitle, `${i18n[lang].confirmSelect}${$('footer-remove').textContent}${i18n[lang].confirmSelectEnd}${i18n[lang].confirmFor}${cost}${i18n[lang].confirmCrystals}`, [
        { text: i18n[lang].cancel, class: 'btn btn--ghost', onClick: () => resolve(false) },
        { text: i18n[lang].yes, class: 'btn btn--primary', onClick: () => resolve(true) }
      ]);
    });
  }
  if (!confirmed) return;
  document.querySelectorAll('#ad-footer-controls .btn').forEach(x => x.classList.remove('active'));
  $('footer-remove').classList.add('active');
  footer = 'none';
  updatePreview();
};

$('btn-create-ad').onclick = async () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';

  if (disableCreateAds === 'disabled') {
    openModal(i18n[lang].errorTitle, i18n[lang].createDisabled);
    return;
  }

  const text = $('ad-text').value.trim();
  if (!text) return openModal(i18n[lang].errorTitle, i18n[lang].adTextRequired);
  if (!/(https:\/\/|t\.me\/|@)/i.test(text)) return openModal(i18n[lang].errorTitle, i18n[lang].linkRequired);
  if (!videoFile && !editMode) return openModal(i18n[lang].errorTitle, i18n[lang].videoRequired);
  if (!selectedPriority || !selectedPlatform) return openModal(i18n[lang].errorTitle, i18n[lang].selectPrioAndPlat);

  let totalCost = 0;
  if (!editMode) {
    const prioCost = parseInt(document.querySelector('#priority-buttons .seg.active')?.dataset.cost) || 0;
    const platCost = parseInt(document.querySelector('#platform-buttons .seg.active')?.dataset.cost) || 0;
    const footerCost = footer === 'none' ? 10 : 0;
    totalCost = prioCost + platCost + footerCost;
    if (totalCost > currentCrystals) return openModal(i18n[lang].errorTitle, i18n[lang].notEnoughCrystals);
  }

  showPreloader();

  let adName = editMode ? editName : 'Ad_' + rand(12);
  let url = editMode ? (editStatus === 'pending' ? GAS_SYS_URL : GAS_ADS_URL) : GAS_SYS_URL;
  let action = editMode ? (editStatus === 'pending' ? 'updatePending' : 'updateAd') : 'saveAd';

  try {
    if (!editMode) {
      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: BOT_CHAT_ID, text: `🆕 New ad\n${adName}\nID: ${USER_ID}` })
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
      userID: USER_ID, token: USER_TOKEN,
      priority: selectedPriority, footer
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

    if (!editMode) {
      currentCrystals -= totalCost;
      localStorage.setItem('crystals', currentCrystals.toString());
      $('crystals-count').textContent = currentCrystals;
      $('crystals-now').textContent = currentCrystals;
      $('crystals-in-create').textContent = currentCrystals;
    }

    // ✅ Правильный вызов: OK и закрытие модалки → showMainMenu()
    const successMsg = editMode ? i18n[lang].adEdited : i18n[lang].adSentForReview;
    openModal(
      i18n[lang].doneTitle,
      successMsg,
      [{ text: 'OK', onClick: showMainMenu }],
      { onClose: showMainMenu }
    );

  } catch (e) {
    openModal(i18n[lang].errorTitle, i18n[lang].failedToSaveAd + (e.message ? `: ${e.message}` : ''));
  } finally {
    hidePreloader();
  }
};

async function loadEditAd(ad) {
  editCost = ad.cost || 0; // Store the cost of the current ad being edited
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
}

/* ========== SETTINGS ========== */
$('btn-copy-token').onclick = () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  navigator.clipboard.writeText(localStorage.getItem(LS.token)).then(() => {
    const span = $('btn-copy-token').querySelector('span');
    span.textContent = i18n[lang].copied;
    setTimeout(() => { span.textContent = i18n[lang].copy; }, 3000);
  }).catch(() => {
    openModal(i18n[lang].errorTitle, i18n[lang].failedToCopy);
  });
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

/* ========== MY ADS ========== */
async function loadMyAds() {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  showPreloader();
  const list = $('myads-list');
  list.innerHTML = '';
  try {
    const pendingRes = await fetch(`${GAS_SYS_URL}?action=getMyPending&userID=${localStorage.getItem(LS.id)}`);
    const pending = await pendingRes.json();
    const approvedRes = await fetch(`${GAS_ADS_URL}?action=getMyAds&userID=${localStorage.getItem(LS.id)}`);
    const approved = await approvedRes.json();
    const allAds = [...pending, ...approved];
    if (allAds.length === 0) {
      show($('myads-empty'));
    } else {
      hide($('myads-empty'));
      allAds.forEach(ad => {
        const status = ad.status || 'approved';
        const statusClass = status === 'pending' ? 'pill--pending' : 'pill--success';
        const statusText = i18n[lang][status + 'Status'] || status;
        const commentsText = ad.comments == 1 ? i18n[lang].enabled : i18n[lang].disabled;
        const footerText = !ad.footer ? i18n[lang].noFooter : (ad.footer === 'top' ? i18n[lang].footerTop : i18n[lang].footerBottom);
        const card = document.createElement('div');
        card.className = 'card ad-card';
        card.innerHTML = `
          <div class="ad-card__head">
            <div><strong>${i18n[lang].adName}:</strong> ${ad.name}</div>
            <div class="pill ${statusClass}">${statusText}</div>
          </div>
          <div class="ad-card__details">
            <p><strong>${i18n[lang].platformLabel}:</strong> ${ad.platform}</p>
            <p><strong>${i18n[lang].priorityLabel}:</strong> ${ad.priority}</p>
            <p><strong>${i18n[lang].comments}:</strong> ${commentsText}</p>
            <p><strong>${i18n[lang].footerLabel}:</strong> ${footerText}</p>
            <p><strong>${i18n[lang].crystalsSpent}:</strong> ${ad.cost || 0}</p>
            <p><strong>${i18n[lang].status}:</strong> ${statusText}</p>
          </div>
          <div class="row">
            <button class="btn btn--ghost edit-btn">${i18n[lang].edit}</button>
            <button class="btn btn--danger delete-btn" ${status === 'pending' ? 'disabled' : ''}>${i18n[lang].delete}</button>
          </div>
          ${status === 'approved' ? `<p style="font-size:12px; color:#888; margin-top:8px;">${i18n[lang].viewed} ${ad.views || 0}</p>` : ''}
        `;
        card.querySelector('.edit-btn').onclick = () => {
          editMode = true;
          editName = ad.name;
          editStatus = status;
          hideAllScreens();
          show($('screen-create'));
          $('btn-create-ad').querySelector('span').textContent = i18n[lang].saveChanges;
          $('crystals-in-create').textContent = currentCrystals;
          loadEditAd(ad);
        };
        card.querySelector('.delete-btn').onclick = async () => {
          if (status === 'pending') return; // Should not reach here due to disabled attribute
          const confirmed = await new Promise(resolve => {
            openModal(i18n[lang].confirmTitle, i18n[lang].delete + '?', [
              { text: i18n[lang].cancel, class: 'btn btn--ghost', onClick: () => resolve(false) },
              { text: i18n[lang].yes, class: 'btn btn--danger', onClick: () => resolve(true) }
            ]);
          });
          if (!confirmed) return;
          try {
            await fetch(`https://script.google.com/macros/s/AKfycbzEd3CR8iqMQc9zMIRn2Dz_qf6LKMXKzmeKVD9EneofM8xuOIXOXh49lFtLqoZVE6tt/exec?elements=${encodeURIComponent(ad.name)}`);
            await updateAdsCount();
            loadMyAds();
          } catch (e) {
            console.warn('Failed to delete ad:', e);
          }
        };
        list.appendChild(card);
      });
      
      // Add "Delete All" button if there are ads
      if (allAds.length > 0) {
        const hasPending = allAds.some(ad => ad.status === 'pending');
        const deleteAllCard = document.createElement('div');
        deleteAllCard.className = 'card';
        deleteAllCard.innerHTML = `
          <button id="delete-all-btn" class="btn btn--danger btn--full" type="button" ${hasPending ? 'disabled' : ''}>
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
          try {
            const adNames = allAds.map(ad => ad.name);
            const elementsParam = JSON.stringify(adNames);
            await fetch(`https://script.google.com/macros/s/AKfycbzEd3CR8iqMQc9zMIRn2Dz_qf6LKMXKzmeKVD9EneofM8xuOIXOXh49lFtLqoZVE6tt/exec?elements=${encodeURIComponent(elementsParam)}`);
            await updateAdsCount();
            loadMyAds();
          } catch (e) {
            console.warn('Failed to delete all ads:', e);
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

/* ========== CRYSTALS ========== */
function loadCrystals() {
  const lang = localStorage.getItem(LS.lang) || 'ru';
  $('crystals-now').textContent = currentCrystals;
  const container = $('crystals-buttons');
  container.innerHTML = '';
  CRYSTALS_BUTTONS.forEach(item => {
    const b = document.createElement('button');
    b.className = 'btn btn--primary btn--full';
    b.innerHTML = i18n[lang].buyCrystalsBtn.replace('{crystals}', item.crystals).replace('{price}', item.price);
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
          currentCrystals += amount;
          localStorage.setItem('crystals', String(currentCrystals));
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
$('admin-check').onclick = async () => {
  const lang = localStorage.getItem(LS.lang) || 'ru';
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
          <button class="btn btn--ghost reject" data-i18n="rejectBtn" style='background:red;'>Reject</button>
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
  showPreloader();
  try {
    let url = `${GAS_SYS_URL}?action=${action}&adName=${adName}`;
    if (action === 'reject' || action === 'banUser') url += `&userID=${userID}`;
    await fetch(url);
    openModal(i18n[lang].doneTitle, i18n[lang].actionPerformed);
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
  showPreloader();
  try {
    await fetch(`${GAS_SYS_URL}?action=unbanUser&userID=${userID}`);
    openModal(i18n[lang].doneTitle, i18n[lang].banRemoved);
    $('admin-restricted').click();
  } catch (e) {
    openModal(i18n[lang].errorTitle, i18n[lang].failedToUnban);
  } finally {
    hidePreloader();
  }
}

/* ========== INIT ========== */
document.addEventListener('DOMContentLoaded', async () => {
  showPreloader();
// Инициализация пользователя в таблице Users
(async () => {
  try {
    await fetch(`${GAS_SYS_URL}?action=initUser&userID=${USER_ID}&token=${USER_TOKEN}`);
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
      await showMainMenu();
    }
    const langBtn = document.querySelector(`#settings-lang-buttons .seg[data-value="${lang}"]`);
    if (langBtn) langBtn.classList.add('active');
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
  }

  hidePreloader();
});