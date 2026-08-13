/* admin.js */

const ADMIN_TOKENS = ['VbknQtkspXvnPpW9', 'L7DE073SCSHV7T8V', '1LJPUBXN5L9PH7S8', '7LH5NUT7JF18167K'];

/* ========== ЛОКАЛЬНЫЕ ФЛАГИ (новые) ========== */
const disableCreateAds = '';// '' или 'disabled'
const GASES = '';//если 'no' то блокируем обращения к GAS
const closeApp = '';// '' или 'closed'
const PURCHASES = ''; // '' или 'no' — если 'no' тогда отключаем платежи

// Массивы для блокировки пользователей - используйте ТОКЕНЫ пользователей
const banForeverAds = ['']; // Токены пользователей, которым запрещено создавать и редактировать рекламы
const blockInApp = []; // Токены пользователей, полностью заблокированных в приложении