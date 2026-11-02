//Пользователю
export const BanForever = []; // { value, reason, adminName, expiresAt, durationDays }
export const BlockCreateAds = []; // { value, reason, adminName, expiresAt, durationDays }; без expiresAt = бессрочно
export const BlockedUsersTelegramID = []; // { value, reason, adminName, expiresAt, durationDays }
export const BlockedUsersIPadresses = []; // { value, reason, adminName, expiresAt, durationDays }
export const UserWarnings = [{"id":"warn_1793397972535_0_l9uat","telegramId":"8085105056","reason":"2.3","issuedAt":"2026-10-30T22:06:12.535Z","adminToken":"1Y6QLQHT0JZRS2GK","adminTelegramId":"6434781065","adminName":"Главный администратор","adminNameHidden":false,"count":1,"removeAt":"2026-11-04T22:09:08.421Z","lockUntil":"2026-11-04T22:09:08.421Z"},{"id":"warn_1793397972535_1_t5mwx","telegramId":"8085105056","reason":"2.3","issuedAt":"2026-10-30T22:06:12.536Z","adminToken":"1Y6QLQHT0JZRS2GK","adminTelegramId":"6434781065","adminName":"Главный администратор","adminNameHidden":false,"count":2,"removeAt":"2026-11-04T22:09:08.421Z","lockUntil":"2026-11-04T22:09:08.421Z"},{"id":"warn_1793398148421_0_3p80n","telegramId":"8085105056","reason":"2.4","issuedAt":"2026-10-30T22:09:08.421Z","adminToken":"1Y6QLQHT0JZRS2GK","adminTelegramId":"6434781065","adminName":"Главный администратор","adminNameHidden":false,"count":3,"removeAt":"2026-11-04T22:09:08.421Z","lockUntil":"2026-11-04T22:09:08.421Z"},{"id":"warn_1793647716004_0_4kplr","telegramId":"7654234598","reason":"2.5","issuedAt":"2026-11-02T19:28:36.004Z","adminToken":"1Y6QLQHT0JZRS2GK","adminTelegramId":"6434781065","adminName":"Главный администратор","adminNameHidden":false,"count":1,"removeAt":"2026-11-04T19:28:36.005Z"},{"id":"warn_1793647716004_1_yyael","telegramId":"7654234598","reason":"2.5","issuedAt":"2026-11-02T19:28:36.005Z","adminToken":"1Y6QLQHT0JZRS2GK","adminTelegramId":"6434781065","adminName":"Главный администратор","adminNameHidden":false,"count":2,"removeAt":"2026-11-06T19:28:36.005Z"}]; // { id, token, telegramId, reason, issuedAt, removeAt, adminToken, adminTelegramId, adminName, adminNameHidden, count, lockUntil }
export const UserLogs = []; // IP history is stored privately in Supabase, never in this public file.
//Общее
export const CloseApp = "not_closed"; // '' или 'closed' — если 'closed' тогда приложение будет закрыто для всех кроме админов.
export const GASESES = "true"; // '' или 'no' — если 'no' тогда блокируем обращения к GAS.
export const Purchases2 = "enabled"; // '' или 'no' — если 'no' тогда отключаем платежи.
export const disableCreateAds2 = "enabled"; // '' или 'disabled' — если 'disabled' тогда запрещаем создавать рекламу.
export const disableEditingAds = "disabled"; // '' или 'disabled' — если 'disabled' тогда запрещаем редактировать рекламу.


