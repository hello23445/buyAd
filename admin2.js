//Пользователю
export const BanForever = []; // { value, reason, adminName, expiresAt, durationDays }
export const BlockCreateAds = []; // { value, reason, adminName, expiresAt, durationDays }; без expiresAt = бессрочно
export const BlockedUsersTelegramID = []; // { value, reason, adminName, expiresAt, durationDays }
export const BlockedUsersIPadresses = []; // { value, reason, adminName, expiresAt, durationDays }
export const UserWarnings = [{"id":"warn_1795178767202_0_62eke","telegramId":"9163983319","reason":"2.7","issuedAt":"2026-11-20T12:46:07.202Z","adminToken":"1Y6QLQHT0JZRS2GK","adminTelegramId":"6434781065","adminName":"Главный администратор","adminNameHidden":false,"count":1,"removeAt":"2026-11-25T12:46:07.202Z","lockUntil":"2026-11-25T12:46:07.202Z"},{"id":"warn_1795178767202_1_2fxex","telegramId":"9163983319","reason":"2.7","issuedAt":"2026-11-20T12:46:07.203Z","adminToken":"1Y6QLQHT0JZRS2GK","adminTelegramId":"6434781065","adminName":"Главный администратор","adminNameHidden":false,"count":2,"removeAt":"2026-11-25T12:46:07.202Z","lockUntil":"2026-11-25T12:46:07.202Z"},{"id":"warn_1795178767202_2_5dxc5","telegramId":"9163983319","reason":"2.7","issuedAt":"2026-11-20T12:46:07.204Z","adminToken":"1Y6QLQHT0JZRS2GK","adminTelegramId":"6434781065","adminName":"Главный администратор","adminNameHidden":false,"count":3,"removeAt":"2026-11-25T12:46:07.202Z","lockUntil":"2026-11-25T12:46:07.202Z"}]; // { id, token, telegramId, reason, issuedAt, removeAt, adminToken, adminTelegramId, adminName, adminNameHidden, count, lockUntil }
export const UserLogs = []; // IP history is stored privately in Supabase, never in this public file.
//Общее
export const CloseApp = "not_closed"; // '' или 'closed' — если 'closed' тогда приложение будет закрыто для всех кроме админов.
export const GASESES = ""; // '' или 'no' — если 'no' тогда блокируем обращения к GAS.
export const Purchases2 = "enabled"; // '' или 'no' — если 'no' тогда отключаем платежи.
export const disableCreateAds2 = "enabled"; // '' или 'disabled' — если 'disabled' тогда запрещаем создавать рекламу.
export const disableEditingAds = "enabled"; // '' или 'disabled' — если 'disabled' тогда запрещаем редактировать рекламу.


