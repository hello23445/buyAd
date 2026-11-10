//Пользователю
export const BanForever = []; // { value, reason, adminName, expiresAt, durationDays }
export const BlockCreateAds = [{"value":"46.166.162.144","reason":"2.9","adminName":"","expiresAt":"2026-11-25T12:30:42.296Z","durationDays":15,"adminNameHidden":true},{"value":"143.246.222.214","reason":"2.9","adminName":"","expiresAt":"2026-11-25T12:45:46.069Z","durationDays":15,"adminNameHidden":true},{"value":"8085105056","reason":"2.7","adminName":"","expiresAt":"2026-11-25T15:02:50.125Z","durationDays":15,"adminNameHidden":true},{"type":"telegramId","value":"8085105056","reason":"2.8","adminName":"","expiresAt":"2026-11-25T15:37:16.681Z","durationDays":15,"adminNameHidden":true,"issuedAt":"2026-11-10T15:37:16.681Z"}]; // { value, reason, adminName, expiresAt, durationDays }; без expiresAt = бессрочно
export const BlockedUsersTelegramID = []; // { value, reason, adminName, expiresAt, durationDays }
export const BlockedUsersIPadresses = []; // { value, reason, adminName, expiresAt, durationDays }
export const UserWarnings = [{"id":"warn_1793882152050_0_8u98g","telegramId":"8085105056","reason":"2.9","issuedAt":"2026-11-05T12:35:52.050Z","adminToken":"1Y6QLQHT0JZRS2GK","adminTelegramId":"6434781065","adminName":"","adminNameHidden":true,"count":1,"removeAt":"2026-11-10T12:35:52.050Z","lockUntil":"2026-11-10T12:35:52.050Z"},{"id":"warn_1793882152050_1_38bq7","telegramId":"8085105056","reason":"2.9","issuedAt":"2026-11-05T12:35:52.051Z","adminToken":"1Y6QLQHT0JZRS2GK","adminTelegramId":"6434781065","adminName":"","adminNameHidden":true,"count":2,"removeAt":"2026-11-10T12:35:52.050Z","lockUntil":"2026-11-10T12:35:52.050Z"},{"id":"warn_1793882152050_2_5ha54","telegramId":"8085105056","reason":"2.9","issuedAt":"2026-11-05T12:35:52.052Z","adminToken":"1Y6QLQHT0JZRS2GK","adminTelegramId":"6434781065","adminName":"","adminNameHidden":true,"count":3,"removeAt":"2026-11-10T12:35:52.050Z","lockUntil":"2026-11-10T12:35:52.050Z"}]; // { id, token, telegramId, reason, issuedAt, removeAt, adminToken, adminTelegramId, adminName, adminNameHidden, count, lockUntil }
export const UserLogs = []; // IP history is stored privately in Supabase, never in this public file.
//Общее
export const CloseApp = "not_closed"; // '' или 'closed' — если 'closed' тогда приложение будет закрыто для всех кроме админов.
export const GASESES = "true"; // '' или 'no' — если 'no' тогда блокируем обращения к GAS.
export const Purchases2 = "enabled"; // '' или 'no' — если 'no' тогда отключаем платежи.
export const disableCreateAds2 = "enabled"; // '' или 'disabled' — если 'disabled' тогда запрещаем создавать рекламу.
export const disableEditingAds = "enabled"; // '' или 'disabled' — если 'disabled' тогда запрещаем редактировать рекламу.


