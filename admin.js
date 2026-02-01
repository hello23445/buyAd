/* admin.js */

const ADMIN_TOKENS = ['FQ87GDWKJSLLUVOA', 'L7DE073SCSHV7T8V'];

/* ========== ЛОКАЛЬНЫЕ ФЛАГИ (новые) ========== */
const disableCreateAds = '';// '' или 'disabled'
const GASES = '';//если no то блокируем обращения к GAS
const closeApp = '';// '' или 'closed'
const PURCHASES = ''; // '' или 'no' — если 'no' тогда отключаем платежи

// Массивы для блокировки пользователей - используйте ТОКЕНЫ пользователей
const banForeverAds = ['']; // Токены пользователей, которым запрещено создавать и редактировать рекламы
const blockInApp = []; // Токены пользователей, полностью заблокированных в приложении
