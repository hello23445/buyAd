/* admin.js — роли администраторов и разрешения.
   Порядок объектов сохранён относительно прежнего списка токенов.
   Имена можно заменить на реальные; токены должны оставаться уникальными. */
const ADMINS = [
  {
    admin_name: 'Главный администратор',
    admin_level: 5,
    admin_token: 'VbknQtkspXvnPpW9',
    permissions: {
      reviewAds: true, viewRestricted: true, rejectWithoutReason: true,
      banToken: true, banTelegramId: true, banIp: true, unban: true,
      restrictAds: true, globalCreateToggle: true, manageAdmins: true,
      changeOwnLevelLocally: true, hideNameOnRejection: true,
      hideNameOnBan: true, viewOwnIp: true
    }
  },
  {
    admin_name: 'Администратор 4 уровня',
    admin_level: 4,
    admin_token: 'L7DE073SCSHV7T8V',
    permissions: {
      reviewAds: true, viewRestricted: true, rejectWithoutReason: true,
      banToken: true, banTelegramId: true, banIp: true, unban: true,
      restrictAds: true, globalCreateToggle: true, manageAdmins: true,
      changeOwnLevelLocally: false, hideNameOnRejection: false,
      hideNameOnBan: false, viewOwnIp: false
    }
  },
  {
    admin_name: 'Администратор 3 уровня',
    admin_level: 3,
    admin_token: '1LJPUBXN5L9PH7S8',
    permissions: {
      reviewAds: true, viewRestricted: true, rejectWithoutReason: true,
      banToken: true, banTelegramId: true, banIp: false, unban: true,
      restrictAds: true, globalCreateToggle: false, manageAdmins: true,
      changeOwnLevelLocally: false, hideNameOnRejection: false,
      hideNameOnBan: false, viewOwnIp: false
    }
  },
  {
    admin_name: 'Администратор 2 уровня',
    admin_level: 2,
    admin_token: '7LH5NUT7JF18167K',
    permissions: {
      reviewAds: true, viewRestricted: true, rejectWithoutReason: true,
      banToken: true, banTelegramId: false, banIp: false, unban: true,
      restrictAds: true, globalCreateToggle: false, manageAdmins: true,
      changeOwnLevelLocally: false, hideNameOnRejection: false,
      hideNameOnBan: false, viewOwnIp: false
    }
  }
];

/* Совместимость с существующим кодом */
const ADMIN_TOKENS = ADMINS.map(admin => admin.admin_token);

/* ЛОКАЛЬНЫЕ ФЛАГИ */
const disableCreateAds = '';
const GASES = '';
const closeApp = '';
const PURCHASES = '';

/* Совместимость со старыми блокировками */
const banForeverAds = [''];
const blockInApp = [];
