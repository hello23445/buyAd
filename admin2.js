//Пользователю
export const BanForever = []; // { value, reason, adminName, expiresAt, durationDays }
export const BlockCreateAds = []; // { value, reason, adminName, expiresAt, durationDays }; без expiresAt = бессрочно
export const BlockedUsersTelegramID = []; // { value, reason, adminName, expiresAt, durationDays }
export const BlockedUsersIPadresses = []; // { value, reason, adminName, expiresAt, durationDays }
export const UserWarnings = [{"id":"warn_1793380187499_35kcf","telegramId":"8085105056","reason":"Неадекват","issuedAt":"2026-10-30T17:09:47.499Z","adminToken":"1Y6QLQHT0JZRS2GK","adminTelegramId":"6434781065","adminName":"","adminNameHidden":true,"count":1,"removeAt":"2026-11-04T17:34:34.965Z","lockUntil":"2026-11-04T17:34:34.965Z"},{"id":"warn_1793380360370_2l9fc","telegramId":"8085105056","reason":"Жалоба #122","issuedAt":"2026-10-30T17:12:40.370Z","adminToken":"1Y6QLQHT0JZRS2GK","adminTelegramId":"6434781065","adminName":"","adminNameHidden":true,"count":2,"removeAt":"2026-11-04T17:34:34.965Z","lockUntil":"2026-11-04T17:34:34.965Z"},{"id":"warn_1793381674965_xyu0s","telegramId":"8085105056","reason":"Жалоба №122","issuedAt":"2026-10-30T17:34:34.965Z"]; // { id, token, telegramId, reason, issuedAt, removeAt, adminToken, adminTelegramId, adminName, adminNameHidden, count, lockUntil }
export const UserLogs = []; // { id, timestamp, userToken, telegramId, event, details }
//Общее
export const CloseApp = "not_closed"; // '' или 'closed' — если 'closed' тогда приложение будет закрыто для всех кроме админов.
export const GASESES = "true"; // '' или 'no' — если 'no' тогда блокируем обращения к GAS.
export const Purchases2 = "enabled"; // '' или 'no' — если 'no' тогда отключаем платежи.
export const disableCreateAds2 = "enabled"; // '' или 'disabled' — если 'disabled' тогда запрещаем создавать рекламу.
export const disableEditingAds = "enabled"; // '' или 'disabled' — если 'disabled' тогда запрещаем редактировать рекламу.


