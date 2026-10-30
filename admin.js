/* admin.js — роли администраторов и разрешения.
   Порядок объектов сохранён относительно прежнего списка токенов.
   Имена можно заменить на реальные; токены должны оставаться уникальными. */
const ADMINS = [
  {
    "admin_name": "Главный администратор",
    "admin_level": 5,
    "admin_token": "1Y6QLQHT0JZRS2GK",
    "permissions": {
      "reviewAds": true,
      "viewRestricted": true,
      "banToken": true,
      "unban": true,
      "unbanTelegramId": true,
      "unbanIp": true,
      "restrictAds": true,
      "banTelegramId": true,
      "banIp": true,
      "globalCreateToggle": true,
      "manageAdmins": true,
      "changeOwnLevelLocally": true,
      "hideNameOnRejection": true,
      "hideNameOnBan": true,
    }
  },
  {
    "admin_name": "Администратор 3 уровня",
    "admin_level": 3,
    "admin_token": "1LJPUBXN5L9PH7S8",
    "permissions": {
      "reviewAds": true,
      "viewRestricted": true,
      "banToken": true,
      "unban": true,
      "unbanTelegramId": true,
      "unbanIp": false,
      "restrictAds": true,
      "banTelegramId": true,
      "banIp": false,
      "globalCreateToggle": false,
      "manageAdmins": true,
      "changeOwnLevelLocally": false,
      "hideNameOnRejection": false,
      "hideNameOnBan": false,
    }
  },
  {
    "admin_name": "Администратор 2 уровня",
    "admin_level": 2,
    "admin_token": "7LH5NUT7JF18167K",
    "permissions": {
      "reviewAds": true,
      "viewRestricted": true,
      "banToken": true,
      "unban": true,
      "unbanTelegramId": false,
      "unbanIp": false,
      "restrictAds": true,
      "banTelegramId": false,
      "banIp": false,
      "globalCreateToggle": false,
      "manageAdmins": true,
      "changeOwnLevelLocally": false,
      "hideNameOnRejection": false,
      "hideNameOnBan": false,
    }
  },
  {
    "admin_name": "Администратор 1 уровня",
    "admin_level": 1,
    "admin_token": "GoYy3n2oRheOiByJ",
    "permissions": {
      "reviewAds": true,
      "viewRestricted": false,
      "banToken": false,
      "unban": false,
      "unbanTelegramId": false,
      "unbanIp": false,
      "restrictAds": false,
      "banTelegramId": false,
      "banIp": false,
      "globalCreateToggle": false,
      "manageAdmins": false,
      "changeOwnLevelLocally": false,
      "hideNameOnRejection": false,
      "hideNameOnBan": false,
    },
    "custom_permissions": true
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
