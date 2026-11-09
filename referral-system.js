/* BuyAd referral system UI and Telegram Mini App integration. */
(() => {
  'use strict';

  const DEFAULT_SHARE_TEXT = 'В этом боте можно быстро и эффективно продвигать свои ресурсы абсолютно бесплатно!';
  const REFERRAL_BASE_URL = 'https://t.me/buyAdss_bot/buy?startapp=';
  const screen = () => document.getElementById('screen-referrals');
  const content = () => document.getElementById('referral-screen-content');
  const telegram = () => window.Telegram && window.Telegram.WebApp;
  const telegramId = () => String(telegram()?.initDataUnsafe?.user?.id || '');
  const language = () => (localStorage.getItem('lang') || localStorage.getItem('language') || 'ru').toLowerCase();
  const isRussian = () => language().startsWith('ru');
  const text = (ru, en) => isRussian() ? ru : en;
  let referralState = null;
  let bootstrapPromise = null;
  let claimInProgress = false;
  let giftOverlay = null;
  let refreshTimer = null;
  let statsCountdownInterval = null;
  let statsRefreshAt = 0;
  const referralLogs = [];
  function referralLog(message, details) {
    const time = new Date().toLocaleTimeString();
    let line = '[' + time + '] ' + message;
    if (details !== undefined) {
      try { line += ' | ' + String(typeof details === 'string' ? details : JSON.stringify(details)).slice(0, 1200); }
      catch (_) { line += ' | [details unavailable]'; }
    }
    referralLogs.push(line);
    if (referralLogs.length > 80) referralLogs.shift();
    console.info('[BuyAd referrals]', line);
  }
  function showReferralLogs() {
    const title = text('Диагностика реферальной системы', 'Referral diagnostics');
    const body = makeElement('div', 'referral-logs-modal');
    const output = makeElement('pre', 'referral-logs-output',
      referralLogs.length ? referralLogs.join('\n') : text('Логи пока пусты.', 'No logs yet.'));
    output.setAttribute('tabindex', '0');
    output.setAttribute('aria-label', text('Текст логов. Можно выделить и скопировать.', 'Log text. Select and copy.'));
    Object.assign(output.style, {
      maxHeight: '60vh',
      overflowY: 'auto',
      overflowX: 'auto',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      wordBreak: 'normal',
      fontSize: '12px',
      lineHeight: '1.5',
      margin: '0',
      padding: '12px',
      userSelect: 'text',
      WebkitUserSelect: 'text',
      cursor: 'text',
      touchAction: 'pan-y'
    });
    body.appendChild(output);

    const actions = [
      {
        text: text('Скопировать логи', 'Copy logs'),
        class: 'btn btn--primary btn--full',
        onClick: () => {
          const logText = referralLogs.join('\n');
          copyText(logText).then(ok => showToast(ok
            ? text('Логи скопированы', 'Logs copied')
            : text('Не удалось скопировать логи', 'Could not copy logs')));
        }
      },
      { text: text('Закрыть', 'Close'), class: 'btn btn--ghost btn--full' }
    ];
    if (typeof window.openModal === 'function') {
      window.openModal(title, body, actions);
      return;
    }

    const overlay = makeElement('div', 'modal-overlay referral-logs-overlay');
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', zIndex: '10000', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '20px',
      background: 'rgba(0,0,0,.7)'
    });
    const panel = makeElement('div', 'modal referral-logs-panel');
    Object.assign(panel.style, {
      width: '100%', maxWidth: '520px', maxHeight: '80vh', overflow: 'auto',
      padding: '20px', borderRadius: '16px', background: 'var(--card-bg, #fff)'
    });
    panel.appendChild(makeElement('h3', 'modal__title', title));
    panel.appendChild(body);
    panel.appendChild(button(text('Скопировать логи', 'Copy logs'), 'btn btn--primary btn--full', () => {
      copyText(referralLogs.join('\n')).then(ok => showToast(ok
        ? text('Логи скопированы', 'Logs copied')
        : text('Не удалось скопировать логи', 'Could not copy logs')));
    }));
    panel.appendChild(button(text('Закрыть', 'Close'), 'btn btn--ghost btn--full', () => overlay.remove()));
    overlay.appendChild(panel);
    overlay.addEventListener('click', event => {
      if (event.target === overlay) overlay.remove();
    });
    document.body.appendChild(overlay);
  }

  function addReferralLogsButton(host) {
    if (!host) return;
    const logButton = button(text('Показать логи', 'Show logs'), 'btn btn--ghost btn--full referral-logs-btn', showReferralLogs);
    logButton.style.marginBottom = '0.75rem';
    host.appendChild(logButton);
  }

  function serviceUrl() {
    return typeof REFERRAL_GAS_URL === 'string' ? REFERRAL_GAS_URL.trim() : '';
  }

  function userToken() {
    return String(
      localStorage.getItem('get_UserToken') ||
      localStorage.getItem('token') ||
      localStorage.getItem('userToken') || ''
    );
  }

  function api(action, payload = {}) {
    referralLog('Запрос: ' + action, { endpointConfigured: !!serviceUrl(), telegramInitDataPresent: !!telegram()?.initData, telegramIdPresent: !!telegramId() });
    const webApp = telegram();
    const endpoint = serviceUrl();
    if (!endpoint) {
      return Promise.reject(new Error(text(
        'Реферальный сервис ещё не подключён. Сначала разверните Google Apps Script и укажите его URL в settings.js.',
        'The referral service is not configured yet. Deploy the Google Apps Script backend and set its URL in settings.js.'
      )));
    }
    if (!webApp?.initData || !telegramId()) {
      return Promise.reject(new Error(text(
        'Откройте приложение через Telegram, чтобы использовать реферальную систему.',
        'Open the app through Telegram to use the referral system.'
      )));
    }

    return new Promise((resolve, reject) => {
      const callbackName = 'buyAdReferral_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      const script = document.createElement('script');
      let settled = false;
      const cleanup = () => {
        if (script.parentNode) script.parentNode.removeChild(script);
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        clearTimeout(timeout);
      };
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        const error = text('Сервер не ответил. Проверьте подключение и попробуйте ещё раз.', 'The server did not respond. Check your connection and try again.');
        referralLog('Тайм-аут запроса: ' + action, error);
        reject(new Error(error));
      }, 12000);

      window[callbackName] = response => {
        if (settled) return;
        settled = true;
        cleanup();
        if (!response || response.success !== true) {
          referralLog('Ошибка ответа сервера: ' + action, response || 'Пустой ответ');
          reject(new Error(localizeServerError(response?.error || 'Referral request failed.')));
          return;
        }
        if (action === 'registerVisit') {
          referralLog('Результат регистрации перехода', {
            firstVisit: response.firstVisit === true,
            isNew: response.isNew === true,
            referralCodePresent: response.referralCodePresent === true,
            referralAccepted: response.referralAccepted === true,
            selfReferral: response.selfReferral === true,
            systemEnabled: response.systemEnabled !== false
          });
        }
        referralLog('Успешный ответ: ' + action);
        resolve(response);
      };
      script.onerror = () => {
        if (settled) return;
        settled = true;
        cleanup();
        const error = text('Не удалось связаться с сервером рефералов.', 'Could not contact the referral server.');
        referralLog('Ошибка загрузки JSONP-скрипта: ' + action, { message: error, endpoint: serviceUrl() });
        reject(new Error(error));
      };

      try {
        const url = new URL(endpoint);
        url.searchParams.set('action', action);
        url.searchParams.set('initData', webApp.initData);
        url.searchParams.set('payload', JSON.stringify({ ...payload, userToken: userToken() }));
        url.searchParams.set('callback', callbackName);
        url.searchParams.set('_', String(Date.now()));
        script.src = url.toString();
        script.async = true;
        document.head.appendChild(script);
      } catch (error) {
        settled = true;
        cleanup();
        reject(error);
      }
    });
  }

  function localizeServerError(message) {
    const ru = {
      'Telegram authorization is missing or invalid.': 'Не удалось подтвердить Telegram ID. Откройте приложение через Telegram.',
      'Referral system is globally disabled.': 'Реферальная система отключена администратором.',
      'Administrator level 4 or higher is required.': 'Управлять реферальной системой могут только администраторы 4-го уровня и выше.',
      'Telegram authorization has expired. Reopen the app.': 'Сессия Telegram устарела. Перезапустите приложение.',
      'This Telegram account has no registered user row in Users.': 'Ваш Telegram ID пока не найден в таблице Users.',
      'Not enough crystals. 25 crystals are required.': 'Для создания ссылки необходимо минимум 25 кристаллов.',
      'A referral link already exists.': 'У вас уже есть реферальная ссылка.',
      'A referral link does not exist.': 'Сначала создайте реферальную ссылку.',
      'Referral access is disabled while your account has an active warning or ban.': 'Реферальная система отключена: у аккаунта есть предупреждение или блокировка.',
      'This referral link is disabled or unavailable.': 'Эта реферальная ссылка отключена или недоступна.',
      'Referral self-registration is not allowed.': 'Нельзя перейти по собственной реферальной ссылке.',
      'No first-visit record was found.': 'Не удалось подтвердить первый вход по ссылке.',
      'Could not verify the account restriction status. Try again later.': 'Не удалось проверить предупреждения и блокировки. Попробуйте позже.',
      'The referral service is not configured. Add TELEGRAM_BOT_TOKEN in Apps Script project properties.': 'Не настроен сервер рефералов: добавьте токен бота в свойства проекта Apps Script.',
      'Could not update the Google Sheets balance. Please try again.': 'Не удалось обновить баланс в Google Таблице. Попробуйте ещё раз.'
    };
    const en = {
      'Telegram authorization is missing or invalid.': 'Telegram ID could not be verified. Open the app through Telegram.',
      'Referral system is globally disabled.': 'The referral system is disabled by an administrator.',
      'Administrator level 4 or higher is required.': 'Only level 4+ administrators can manage the referral system.',
      'Telegram authorization has expired. Reopen the app.': 'Your Telegram session expired. Restart the app.',
      'This Telegram account has no registered user row in Users.': 'Your Telegram ID was not found in the Users sheet.',
      'Not enough crystals. 25 crystals are required.': 'At least 25 crystals are required to create a link.',
      'A referral link already exists.': 'You already have a referral link.',
      'A referral link does not exist.': 'Create a referral link first.',
      'Referral access is disabled while your account has an active warning or ban.': 'The referral system is disabled while your account has a warning or ban.',
      'This referral link is disabled or unavailable.': 'This referral link is disabled or unavailable.',
      'Referral self-registration is not allowed.': 'You cannot register through your own referral link.',
      'No first-visit record was found.': 'The first visit could not be verified.',
      'Could not verify the account restriction status. Try again later.': 'Could not verify warnings and bans. Try again later.',
      'The referral service is not configured. Add TELEGRAM_BOT_TOKEN in Apps Script project properties.': 'The backend is not configured. Add the bot token to Apps Script project properties.',
      'Could not update the Google Sheets balance. Please try again.': 'Could not update the Google Sheets balance. Please try again.'
    };
    const dictionary = isRussian() ? ru : en;
    return dictionary[message] || message;
  }

  function makeElement(tag, className, value) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (value != null) el.textContent = value;
    return el;
  }

  function setPageMessage(message, kind = '') {
    const host = content();
    if (!host) return;
    host.innerHTML = '';
    const card = makeElement('div', 'card referral-message ' + kind);
    card.textContent = message;
    host.appendChild(card);
  }

  function showScreen() {
    document.querySelectorAll('.screen').forEach(item => { item.hidden = item !== screen(); });
    if (screen()) screen().hidden = false;
    if (telegram()?.BackButton) telegram().BackButton.show();
  }

  function backToMain() {
    if (screen()) screen().hidden = true;
    const main = document.getElementById('screen-main');
    if (main) main.hidden = false;
    if (telegram()?.BackButton) telegram().BackButton.hide();
    if (typeof window.BuyAdRefreshCrystals === 'function') {
      window.BuyAdRefreshCrystals().catch(error => console.warn('Could not refresh crystals:', error));
    }
  }

  function button(label, className, handler) {
    const element = makeElement('button', className || 'btn btn--primary', label);
    element.type = 'button';
    element.addEventListener('click', handler);
    return element;
  }

  async function copyText(value) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const helper = document.createElement('textarea');
        helper.value = value;
        helper.style.position = 'fixed';
        helper.style.opacity = '0';
        document.body.appendChild(helper);
        helper.select();
        const copied = document.execCommand('copy');
        helper.remove();
        if (!copied) throw new Error('copy failed');
      }
      return true;
    } catch (error) {
      console.warn('Referral copy failed:', error);
      return false;
    }
  }

  function showToast(message) {
    const toast = makeElement('div', 'referral-toast', message);
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('is-visible'));
    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 220);
    }, 2200);
  }

  function shareText() {
    const message = String(referralState?.referral?.shareText || '').trim();
    return message ? message + '\n' + referralState.referral.url : referralState?.referral?.url || '';
  }

  function openShareDialog() {
    const referral = referralState?.referral;
    if (!referral) return;
    const body = makeElement('div', 'referral-share-modal');
    body.appendChild(makeElement('p', 'muted', text('Выберите, как отправить ссылку друзьям.', 'Choose how to share your referral link.')));
    const actions = [
      {
        text: text('Поделиться в Telegram', 'Share in Telegram'),
        class: 'btn btn--primary btn--full',
        onClick: () => {
          const url = 'https://telegram.me/share/url?url=' + encodeURIComponent(referral.url) +
            '&text=' + encodeURIComponent(String(referral.shareText || '').trim());
          window.open(url, '_blank', 'noopener,noreferrer');
        }
      },
      {
        text: text('Поделиться', 'Share'),
        class: 'btn btn--primary btn--full',
        onClick: () => {
          const textToShare = shareText();
          if (navigator.share) {
            navigator.share({ title: text('Реферальная ссылка BuyAd', 'BuyAd referral link'), text: textToShare })
              .catch(error => { if (error?.name !== 'AbortError') console.warn('Native share failed:', error); });
          } else {
            copyText(textToShare).then(ok => showToast(ok ? text('Текст и ссылка скопированы', 'Text and link copied') : text('Не удалось скопировать', 'Copy failed')));
          }
        }
      },
      {
        text: text('Скопировать ссылку', 'Copy link'),
        class: 'btn btn--ghost btn--full',
        onClick: () => copyText(referral.url).then(ok => showToast(ok ? text('Ссылка скопирована', 'Link copied') : text('Не удалось скопировать', 'Copy failed')))
      },
      { text: text('Закрыть', 'Close'), class: 'btn btn--ghost btn--full' }
    ];
    if (typeof window.openModal === 'function') {
      window.openModal(text('Поделиться', 'Share'), body, actions);
    } else {
      actions.slice(0, 3).forEach(action => {
        body.appendChild(button(action.text, action.class, action.onClick));
      });
      body.appendChild(button(text('Закрыть', 'Close'), 'btn btn--ghost btn--full', () => body.remove()));
      content()?.appendChild(body);
    }
  }

  function buildHeaderCard(referral) {
    const card = makeElement('div', 'card referral-link-card');
    card.appendChild(makeElement('div', 'referral-link-heading', text('Ваша реферальная ссылка', 'Your referral link')));
    card.appendChild(makeElement('p', 'field__hint referral-link-hint', text(
      'Отправьте её друзьям. Бонус начисляется за нового участника, который впервые зарегистрируется по вашей ссылке.',
      'Share it with friends. Rewards are granted when a new member first joins through your link.'
    )));
    const field = makeElement('div', 'referral-url-row');
    const input = document.createElement('input');
    input.type = 'text';
    input.readOnly = true;
    input.value = referral.url;
    input.setAttribute('aria-label', text('Реферальная ссылка', 'Referral link'));
    const copy = button('', 'referral-copy-btn', async () => {
      const ok = await copyText(referral.url);
      showToast(ok ? text('Ссылка скопирована', 'Link copied') : text('Не удалось скопировать', 'Copy failed'));
    });
    copy.setAttribute('aria-label', text('Скопировать ссылку', 'Copy link'));
    copy.title = text('Скопировать ссылку', 'Copy link');
    const icon = makeElement('i', 'fa-solid fa-copy');
    copy.appendChild(icon);
    field.append(input, copy);
    card.appendChild(field);

    card.appendChild(button(text('Поделиться', 'Share'), 'btn btn--primary btn--full referral-share-btn', openShareDialog));

    const toggleRow = makeElement('div', 'referral-toggle-row');
    const toggleText = makeElement('span', '', text('Приём приглашений', 'Accepting referrals'));
    const toggleLabel = makeElement('label', 'referral-switch');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = referral.manuallyEnabled === true;
    const slider = makeElement('span', 'referral-switch-slider');
    toggleLabel.append(checkbox, slider);
    toggleRow.append(toggleText, toggleLabel);
    card.appendChild(toggleRow);

    checkbox.addEventListener('change', async () => {
      checkbox.disabled = true;
      try {
        await api('setEnabled', { enabled: checkbox.checked });
        await loadState();
        showToast(checkbox.checked ? text('Ссылка включена', 'Referral link enabled') : text('Ссылка отключена', 'Referral link disabled'));
      } catch (error) {
        checkbox.checked = !checkbox.checked;
        showToast(error.message);
      } finally {
        checkbox.disabled = false;
      }
    });
    return card;
  }

  function buildSettingsCard(referral) {
    const card = makeElement('div', 'card referral-settings-card');
    const messageField = makeElement('label', 'referral-field');
    messageField.appendChild(makeElement('span', 'field__label', text('Текст (необязательно)', 'Text (optional)')));
    const message = document.createElement('textarea');
    message.maxLength = 500;
    message.rows = 4;
    message.value = referral.shareText == null ? DEFAULT_SHARE_TEXT : referral.shareText;
    message.placeholder = text('Добавьте сообщение рядом со ссылкой…', 'Add a message to share with your link…');
    messageField.appendChild(message);
    card.appendChild(messageField);

    const giftField = makeElement('div', 'referral-field');
    const giftHeading = makeElement('div', 'referral-gift-heading');
    giftHeading.appendChild(makeElement('span', 'field__label', text('Подарки', 'Gifts')));
    const giftValue = makeElement('strong', 'referral-gift-value', String(referral.giftAmount || 0) + ' 💎');
    giftHeading.appendChild(giftValue);
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '50';
    range.step = '1';
    range.value = String(referral.giftAmount || 0);
    range.className = 'referral-range';
    const calculation = makeElement('div', 'field__hint referral-gift-calculation');
    const updateCalculation = () => {
      const gift = Math.max(0, Math.min(50, Number(range.value) || 0));
      giftValue.textContent = gift + ' 💎';
      calculation.textContent = isRussian()
        ? 'Пользователь получит ' + gift + ' 💎 · Вы получите ' + (60 - gift) + ' 💎 из 60'
        : 'Your friend gets ' + gift + ' 💎 · You receive ' + (60 - gift) + ' 💎 of 60';
    };
    range.addEventListener('input', updateCalculation);
    updateCalculation();
    giftField.append(giftHeading, range, calculation);
    card.appendChild(giftField);

    card.appendChild(button(text('Сохранить', 'Save'), 'btn btn--primary btn--full referral-save-btn', async event => {
      const saveButton = event.currentTarget;
      saveButton.disabled = true;
      saveButton.textContent = text('Сохранение…', 'Saving…');
      try {
        await api('saveSettings', { shareText: message.value, giftAmount: Number(range.value) });
        await loadState();
        showToast(text('Настройки сохранены', 'Settings saved'));
      } catch (error) {
        showToast(error.message);
      } finally {
        saveButton.disabled = false;
        saveButton.textContent = text('Сохранить', 'Save');
      }
    }));
    return card;
  }


  function buildStatisticsCard(initialStats) {
    const card = makeElement('div', 'card referral-statistics-card');
    card.appendChild(makeElement('div', 'card__title', text('Статистика рефералов', 'Referral statistics')));
    const totals = makeElement('div', 'referral-statistics-totals');
    const addMetric = (label, value) => {
      const item = makeElement('div', 'referral-statistics-metric');
      item.append(makeElement('span', '', label), makeElement('strong', '', String(value || 0)));
      totals.appendChild(item);
    };
    addMetric(text('Приглашено', 'Invited'), initialStats.totalInvited);
    addMetric(text('Получено всего', 'Earned total') + ' 💎', initialStats.totalOwnerEarned);
    addMetric(text('Подарено', 'Gifted') + ' 💎', initialStats.totalGifted);
    card.appendChild(totals);

    const controls = makeElement('div', 'referral-statistics-controls');
    const period = document.createElement('select');
    period.className = 'referral-period-select';
    [['day', text('По дням', 'By day')], ['week', text('По неделям', 'By week')], ['month', text('По месяцам', 'By month')], ['year', text('По годам', 'By year')]].forEach(([value, label]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = label; period.appendChild(option);
    });
    const refresh = button('', 'btn btn--ghost referral-refresh-btn', async () => {
      if (Date.now() < statsRefreshAt || refresh.disabled) return;
      refresh.disabled = true;
      refresh.textContent = text('Обновляем…', 'Refreshing…');
      try {
        const result = await api('getStats', { period: period.value, manualRefresh: true });
        if (result.limited) statsRefreshAt = Date.now() + Number(result.retryAfter || 120) * 1000;
        else {
          updateStats(result);
          statsRefreshAt = Date.now() + 120000;
        }
      } catch (error) { showToast(error.message); }
      finally { updateRefreshLabel(); }
    });
    const groups = makeElement('div', 'referral-statistics-groups');
    controls.append(period, refresh);
    card.append(controls, groups);

    function updateStats(data) {
      totals.innerHTML = '';
      addMetric(text('Приглашено', 'Invited'), data.totalInvited);
      addMetric(text('Получено всего', 'Earned total') + ' 💎', data.totalOwnerEarned);
      addMetric(text('Подарено', 'Gifted') + ' 💎', data.totalGifted);
      groups.innerHTML = '';
      if (!data.groups || !data.groups.length) {
        groups.appendChild(makeElement('p', 'field__hint', text('За выбранный период приглашений пока нет.', 'No referrals in the selected period yet.')));
        return;
      }
      data.groups.forEach(item => {
        const row = makeElement('div', 'referral-statistics-row');
        row.append(makeElement('span', '', item.period),
          makeElement('span', '', text('Приглашено: ', 'Invited: ') + item.invited),
          makeElement('span', '', '+' + item.earned + ' 💎'));
        groups.appendChild(row);
      });
    }
    function updateRefreshLabel() {
      const seconds = Math.max(0, Math.ceil((statsRefreshAt - Date.now()) / 1000));
      refresh.disabled = seconds > 0;
      refresh.textContent = seconds > 0
        ? text('Обновить · ', 'Refresh · ') + String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0')
        : text('Обновить', 'Refresh');
    }
    async function loadPeriod() {
      try {
        const result = await api('getStats', { period: period.value });
        updateStats(result);
      } catch (error) { showToast(error.message); }
    }
    period.addEventListener('change', loadPeriod);
    updateStats(initialStats);
    statsRefreshAt = Date.now() + 120000;
    updateRefreshLabel();
    clearInterval(statsCountdownInterval);
    statsCountdownInterval = setInterval(updateRefreshLabel, 1000);
    return card;
  }

  function buildOverviewCard(state) {
    const card = makeElement('div', 'card referral-overview-card');
    const heading = makeElement('div', 'referral-overview-heading');
    heading.appendChild(makeElement('div', 'referral-hero-icon', '💎'));
    const copy = makeElement('div', 'referral-overview-copy');
    copy.appendChild(makeElement('div', 'card__title', text('Приглашай друзей — получай кристаллы', 'Invite friends — earn crystals')));
    copy.appendChild(makeElement('p', 'card__subtitle', text(
      'За каждого нового участника начисляется 60 💎 суммарно: часть получает друг, остальное — вы. Настройте размер подарка и поделитесь ссылкой.',
      'Each new member generates 60 💎 in total: your friend receives a gift and you receive the remainder. Set the gift amount and share your link.'
    )));
    heading.appendChild(copy);
    card.appendChild(heading);

    const metrics = makeElement('div', 'referral-overview-metrics');
    const addMetric = (label, value) => {
      const metric = makeElement('div', 'referral-overview-metric');
      metric.append(makeElement('span', '', label), makeElement('strong', '', String(value || 0)));
      metrics.appendChild(metric);
    };
    const stats = state.stats || {};
    addMetric(text('Ваш баланс', 'Your balance'), (state.balance == null ? '—' : state.balance) + ' 💎');
    addMetric(text('Приглашено', 'Invited'), stats.totalInvited || state.referral?.referralsCount || 0);
    addMetric(text('Ваш доход', 'Your earnings'), (stats.totalOwnerEarned || 0) + ' 💎');
    card.appendChild(metrics);

    const steps = makeElement('div', 'referral-overview-steps');
    steps.append(
      makeElement('span', '', text('1. Создайте ссылку за 25 💎', '1. Create a link for 25 💎')),
      makeElement('span', '', text('2. Поделитесь с друзьями', '2. Share it with friends')),
      makeElement('span', '', text('3. Получите награду за нового участника', '3. Earn a reward for each new member'))
    );
    card.appendChild(steps);
    return card;
  }

  function renderReferralState(state) {
    referralState = state;
    const host = content();
    if (!host) return;
    host.innerHTML = '';
    addReferralLogsButton(host);

    if (state.systemEnabled === false) {
      const notice = makeElement('div', 'card referral-warning');
      notice.appendChild(makeElement('div', 'referral-warning-icon', '⛔'));
      notice.appendChild(makeElement('div', 'card__title', text('Реферальная система отключена', 'Referral system is disabled')));
      notice.appendChild(makeElement('p', 'card__subtitle', text('Администратор временно отключил все реферальные ссылки. Создание ссылок, изменение настроек и начисление бонусов приостановлены.', 'An administrator has temporarily disabled all referral links. Link creation, settings changes and rewards are paused.')));
      host.appendChild(notice);
      return;
    }

    if (!state.eligible) {
      const notice = makeElement('div', 'card referral-warning');
      notice.appendChild(makeElement('div', 'referral-warning-icon', '⚠️'));
      notice.appendChild(makeElement('div', 'card__title', text('Реферальная система временно отключена', 'Referral system temporarily disabled')));
      notice.appendChild(makeElement('p', 'card__subtitle', state.eligibilityReason || text('На аккаунте есть предупреждение или блокировка.', 'Your account has a warning or ban.')));
      notice.appendChild(makeElement('p', 'field__hint', text('Ссылка будет снова активна после снятия всех предупреждений и блокировок.', 'The link can become active again after all warnings and bans are removed.')));
      host.appendChild(notice);
      return;
    }

    if (!state.telegramIdFound) {
      setPageMessage(text('Telegram ID не найден в таблице Users. Создание ссылки недоступно.', 'Your Telegram ID was not found in the Users sheet. Link creation is unavailable.'), 'is-warning');
      return;
    }

    if (!state.referral) {
      host.appendChild(buildOverviewCard(state));
      const card = makeElement('div', 'card referral-create-card');
      card.appendChild(makeElement('div', 'referral-hero-icon', '💎'));
      card.appendChild(makeElement('div', 'card__title', text('Приглашайте друзей', 'Invite your friends')));
      card.appendChild(makeElement('p', 'card__subtitle', text('Делитесь реферальной ссылкой и получайте по 60 кристаллов за 1 приведённого друга.', 'Share your referral link and get 60 crystals for every friend who joins.')));
      const balance = Number(state.balance || 0);
      const buttonCreate = button(
        text('Создать реферальную ссылку · 25 💎', 'Create referral link · 25 💎'),
        'btn btn--primary btn--full referral-create-btn',
        async event => {
          const target = event.currentTarget;
          target.disabled = true;
          target.textContent = text('Создаём ссылку…', 'Creating link…');
          try {
            await api('createReferral');
            await loadState();
            if (typeof window.BuyAdRefreshCrystals === 'function') await window.BuyAdRefreshCrystals();
            showToast(text('Реферальная ссылка создана', 'Referral link created'));
          } catch (error) {
            showToast(error.message);
          } finally {
            target.disabled = false;
          }
        }
      );
      buttonCreate.disabled = balance < 25;
      card.appendChild(buttonCreate);
      card.appendChild(makeElement('div', 'field__hint referral-balance-hint',
        text('Доступно: ', 'Available: ') + balance + ' 💎' +
        (balance < 25 ? text(' · Нужно ещё ', ' · Need ') + (25 - balance) + ' 💎' : '')));
      host.appendChild(card);
      return;
    }

    const referral = state.referral;
    host.appendChild(buildOverviewCard(state));
    host.appendChild(buildHeaderCard(referral));
    host.appendChild(buildSettingsCard(referral));
    if (!referral.enabled) {
      host.appendChild(makeElement('div', 'referral-disabled-note',
        text('Ссылка отключена. Включите переключатель, чтобы снова принимать приглашения.', 'The link is disabled. Turn the switch on to accept referrals again.')));
    }
    host.appendChild(buildStatisticsCard(state.stats || { totalInvited: referral.referralsCount || 0, totalOwnerEarned: 0, totalGifted: 0, groups: [] }));
  }

  async function loadState() {
    const host = content();
    if (host) {
      host.innerHTML = '';
      const card = makeElement('div', 'card referral-message');
      card.appendChild(makeElement('div', 'spinner'));
      card.appendChild(makeElement('p', '', text('Загружаем реферальную систему…', 'Loading referral system…')));
      host.appendChild(card);
    }
    try {
      const state = await api('getState');
      renderReferralState(state);
      return state;
    } catch (error) {
      referralLog('Не удалось загрузить состояние реферальной системы', { name: error?.name, message: error?.message, stack: error?.stack });
      setPageMessage(error.message, 'is-error');
      addReferralLogsButton(host);
      throw error;
    }
  }

  async function openReferralScreen() {
    showScreen();
    if (!serviceUrl()) {
      setPageMessage(text(
        'Сервер реферальной системы ещё не подключён. После развёртывания Google Apps Script укажите URL в settings.js.',
        'The referral backend is not connected yet. After deploying Google Apps Script, set its URL in settings.js.'
      ), 'is-warning');
      return;
    }
    await loadState().catch(() => {});
  }

  function openGiftScreen(amount) {
    const gift = Math.max(0, Number(amount) || 0);
    if (gift <= 0 || giftOverlay) return;
    const webApp = telegram();
    try {
      if (typeof webApp?.requestFullscreen === 'function') webApp.requestFullscreen();
      else webApp?.expand?.();
    } catch (_) { try { webApp?.expand?.(); } catch (_) {} }

    const overlay = makeElement('div', 'referral-gift-overlay');
    overlay.id = 'referral-gift-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    const card = makeElement('div', 'referral-gift-card');
    const glow = makeElement('div', 'referral-gift-glow');
    const icon = makeElement('div', 'referral-gift-icon', '💎');
    const eyebrow = makeElement('div', 'referral-gift-eyebrow', text('ПОДАРОК ЗА ПРИГЛАШЕНИЕ', 'A GIFT FOR JOINING'));
    const heading = makeElement('h1', 'referral-gift-title', text('Вам начислены кристаллы!', 'You received crystals!'));
    const amountElement = makeElement('div', 'referral-gift-amount', '+' + gift);
    const unit = makeElement('div', 'referral-gift-unit', text('КРИСТАЛЛОВ', 'CRYSTALS'));
    const message = makeElement('p', 'referral-gift-message', text(
      'Добро пожаловать в BuyAd! Подарок уже зачислен на ваш баланс.',
      'Welcome to BuyAd! Your gift has been added to your balance.'
    ));
    const close = button(text('Отлично, спасибо!', 'Awesome, thanks!'), 'btn btn--primary btn--full referral-gift-close', () => {
      overlay.classList.remove('is-visible');
      setTimeout(() => overlay.remove(), 260);
      giftOverlay = null;
      if (typeof window.BuyAdRefreshCrystals === 'function') {
        window.BuyAdRefreshCrystals().catch(error => console.warn('Could not refresh crystals:', error));
      }
    });
    card.append(glow, icon, eyebrow, heading, amountElement, unit, message, close);
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    giftOverlay = overlay;
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
    close.focus({ preventScroll: true });
  }

  async function processGiftAfterConsent() {
    if (claimInProgress || !telegramId() || !serviceUrl()) return;
    if (window.__buyAdConsentAccessAllowed !== true) return;
    if (document.querySelector('.modal-overlay:not([hidden]), .ip-consent-overlay:not([hidden])')) return;
    claimInProgress = true;
    try {
      if (bootstrapPromise) await bootstrapPromise;
      const result = await api('claimReferral');
      if (result.showGift && Number(result.giftReceived) > 0) {
        openGiftScreen(result.giftReceived);
        await api('markGiftSeen').catch(error => console.warn('Could not mark referral gift as seen:', error));
        if (typeof window.BuyAdRefreshCrystals === 'function') {
          window.BuyAdRefreshCrystals().catch(error => console.warn('Could not refresh crystals:', error));
        }
      }
    } catch (error) {
      console.warn('Referral reward check failed:', error);
    } finally {
      claimInProgress = false;
    }
  }

  function scheduleGiftCheck() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(processGiftAfterConsent, 180);
  }

  function install() {
    const nav = document.getElementById('nav-referral');
    const back = document.getElementById('back-from-referrals');
    if (nav) nav.addEventListener('click', () => { openReferralScreen(); });
    if (back) back.addEventListener('click', backToMain);

    window.addEventListener('buyad:consent-access-changed', scheduleGiftCheck);
    const observer = new MutationObserver(scheduleGiftCheck);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['hidden', 'class', 'style']
    });
    scheduleGiftCheck();
  }

  window.BuyAdReferralSetGlobalEnabled = async function (enabled) {
    const result = await api('setGlobalEnabled', { enabled: enabled === true });
    referralLog('Глобальный статус реферальной системы изменён', { enabled: result.systemEnabled });
    return result;
  };

  window.BuyAdReferralGetGlobalStatus = async function () {
    const result = await api('getGlobalStatus');
    referralLog('Проверен глобальный статус реферальной системы', { enabled: result.systemEnabled });
    return result;
  };

  window.BuyAdReferralBootstrap = function () {
    if (bootstrapPromise) return bootstrapPromise;
    if (!telegramId() || !telegram()?.initData || !serviceUrl()) return Promise.resolve(null);
    bootstrapPromise = api('registerVisit').catch(error => {
      console.warn('Referral first-visit registration failed:', error);
      return null;
    });
    return bootstrapPromise;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
