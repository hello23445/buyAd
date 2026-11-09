/* BuyAd referral system UI and Telegram Mini App integration. */
(() => {
  'use strict';

  const defaultShareText = () => text('В этом боте можно быстро и эффективно продвигать свои ресурсы абсолютно бесплатно!', 'Promote your resources quickly and effectively in this bot — absolutely free!');
  const REFERRAL_BASE_URL = 'https://t.me/buyAdss_bot/buy?startapp=';
  const screen = () => document.getElementById('screen-referrals');
  const content = () => document.getElementById('referral-screen-content');
  const telegram = () => window.Telegram && window.Telegram.WebApp;
  const telegramId = () => String(telegram()?.initDataUnsafe?.user?.id || '');
  const language = () => (localStorage.getItem('lang') || localStorage.getItem('language') || 'ru').toLowerCase();
  const isRussian = () => language().startsWith('ru');
  const text = (ru, en) => isRussian() ? ru : en;
  let referralState = null;
  let referralScreenLoaded = false;
  let bootstrapPromise = null;
  let claimInProgress = false;
  let giftOverlay = null;
  let refreshTimer = null;
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
    const message = referralState?.referral?.showText === false ? '' : String(referralState?.referral?.shareText || '').trim();
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
          const shareMessage = referral.showText === false ? '' : String(referral.shareText || '').trim();
          const url = 'https://telegram.me/share/url?url=' + encodeURIComponent(referral.url) +
            (shareMessage ? '&text=' + encodeURIComponent(shareMessage) : '');
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
      'Отправьте ссылку другу. Когда новый пользователь впервые зарегистрируется по ней, награда будет начислена автоматически.',
      'Send this link to a friend. When a new user first joins through it, the reward is added automatically.'
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
    const toggleCopy = makeElement('div', 'referral-toggle-copy');
    toggleCopy.append(
      makeElement('span', 'referral-toggle-title', text('Принимать новые приглашения', 'Accept new referrals')),
      makeElement('span', 'referral-toggle-hint', text('Выключите, чтобы временно перестать принимать новых участников.', 'Turn this off to temporarily stop accepting new members.'))
    );
    const toggleLabel = makeElement('label', 'referral-switch');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = referral.manuallyEnabled === true;
    const slider = makeElement('span', 'referral-switch-slider');
    toggleLabel.append(checkbox, slider);
    toggleRow.append(toggleCopy, toggleLabel);
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

  let saveCooldownInterval = null;

  function formatReferralCooldown(seconds) {
    const safe = Math.max(0, Math.ceil(Number(seconds) || 0));
    const minutes = Math.floor(safe / 60);
    const remainder = safe % 60;
    return String(minutes).padStart(2, '0') + ':' + String(remainder).padStart(2, '0');
  }

  function applySaveCooldown(buttonElement, untilTimestamp) {
    if (saveCooldownInterval) clearInterval(saveCooldownInterval);
    const update = () => {
      const remaining = Math.max(0, Math.ceil((Number(untilTimestamp) - Date.now()) / 1000));
      if (remaining > 0) {
        buttonElement.disabled = true;
        buttonElement.textContent = text('Сохранить через ', 'Save in ') + formatReferralCooldown(remaining);
      } else {
        buttonElement.disabled = false;
        buttonElement.textContent = text('Сохранить изменения', 'Save changes');
        if (saveCooldownInterval) clearInterval(saveCooldownInterval);
        saveCooldownInterval = null;
      }
    };
    update();
    if (Number(untilTimestamp) > Date.now()) saveCooldownInterval = setInterval(update, 1000);
  }

  function buildSettingsCard(referral) {
    const card = makeElement('div', 'card referral-settings-card');
    const heading = makeElement('div', 'referral-settings-heading');
    const headingCopy = makeElement('div', 'referral-settings-heading-copy');
    headingCopy.appendChild(makeElement('strong', '', text('Настройки приглашения', 'Invitation settings')));
    heading.appendChild(headingCopy);
    card.appendChild(heading);

    const visibilityCard = makeElement('div', 'referral-option-card');
    const visibilityCopy = makeElement('div', 'referral-option-copy');
    visibilityCopy.append(
      makeElement('strong', '', text('Показывать текст', 'Show message')),
      makeElement('span', '', text('Текст будет отправлен вместе со ссылкой.', 'Include the message with the link.'))
    );
    const visibilitySwitch = makeElement('label', 'referral-switch');
    const visibilityInput = document.createElement('input');
    visibilityInput.type = 'checkbox';
    visibilityInput.checked = referral.showText !== false;
    visibilityInput.setAttribute('aria-label', text('Показывать текст у ссылки', 'Show message with link'));
    visibilitySwitch.append(visibilityInput, makeElement('span', 'referral-switch-slider'));
    visibilityCard.append(visibilityCopy, visibilitySwitch);
    card.appendChild(visibilityCard);

    const messageField = makeElement('label', 'referral-field');
    const messageHeading = makeElement('div', 'referral-message-heading');
    messageHeading.append(
      makeElement('span', 'field__label', text('Текст приглашения', 'Invitation message')),
      makeElement('span', 'referral-char-count', '')
    );
    messageField.appendChild(messageHeading);
    const message = document.createElement('textarea');
    message.maxLength = 500;
    message.rows = 4;
    message.value = referral.shareText == null ? defaultShareText() : referral.shareText;
    message.placeholder = text('Напишите короткое сообщение для друзей…', 'Write a short message for your friends…');
    message.setAttribute('aria-describedby', 'referral-message-counter');
    const charCount = messageHeading.querySelector('.referral-char-count');
    if (charCount) charCount.id = 'referral-message-counter';
    const updateCharCount = () => {
      if (charCount) charCount.textContent = message.value.length + ' / 500';
    };
    message.addEventListener('input', updateCharCount);
    updateCharCount();
    messageField.appendChild(message);
    card.appendChild(messageField);

    const preview = makeElement('div', 'referral-preview-card');
    const previewHeading = makeElement('div', 'referral-preview-heading');
    previewHeading.append(makeElement('span', '', text('Так увидит приглашённый', 'What your friend will see')));
    const previewBody = makeElement('p', 'referral-preview-body', '');
    const previewUrl = makeElement('div', 'referral-preview-url', referral.url);
    const updatePreview = () => {
      const visible = visibilityInput.checked;
      const currentMessage = message.value.trim();
      previewBody.textContent = visible && currentMessage
        ? currentMessage
        : text('Будет отправлена только реферальная ссылка.', 'Only the referral link will be shared.');
      previewBody.hidden = !(visible && currentMessage);
      previewUrl.textContent = referral.url;
      preview.classList.toggle('is-link-only', !(visible && currentMessage));
    };
    message.addEventListener('input', updatePreview);
    visibilityInput.addEventListener('change', async () => {
      const nextValue = visibilityInput.checked;
      visibilityInput.disabled = true;
      try {
        const result = await api('setShowText', { enabled: nextValue });
        if (result.showText !== nextValue) throw new Error(text('Сервер не подтвердил изменение.', 'The server did not confirm the change.'));
        if (referralState?.referral) referralState.referral.showText = nextValue;
        updatePreview();
        showToast(nextValue ? text('Текст будет показываться у ссылки', 'Message will be shown with the link') : text('Будет отправляться только ссылка', 'Only the link will be shared'));
      } catch (error) {
        visibilityInput.checked = !nextValue;
        updatePreview();
        showToast(error.message);
      } finally {
        visibilityInput.disabled = false;
      }
    });
    preview.append(previewHeading, previewBody, previewUrl);
    card.appendChild(preview);
    updatePreview();

    const rewardCard = makeElement('div', 'referral-reward-panel');
    const giftHeading = makeElement('div', 'referral-gift-heading');
    giftHeading.append(
      makeElement('span', 'field__label', text('Распределение награды', 'Reward distribution')),
      makeElement('strong', 'referral-gift-value', '')
    );
    rewardCard.appendChild(giftHeading);
    rewardCard.appendChild(makeElement('p', 'referral-reward-explainer', text(
      'Всего за приглашение: 60 💎. Выберите награду другу — остаток получите вы.',
      '60 💎 per referral. Choose your friend’s reward; you receive the rest.'
    )));
    const range = document.createElement('input');
    range.type = 'range';
    range.min = '0';
    range.max = '50';
    range.step = '1';
    range.value = String(referral.giftAmount || 0);
    range.className = 'referral-range';
    range.setAttribute('aria-label', text('Количество кристаллов для друга', 'Crystals for your friend'));
    const calculation = makeElement('div', 'referral-gift-calculation');
    const friendReward = makeElement('div', 'referral-reward-result');
    const ownerReward = makeElement('div', 'referral-reward-result');
    friendReward.append(makeElement('span', 'referral-reward-label', text('Друг получит', 'Friend receives')), makeElement('strong', 'referral-reward-amount'));
    ownerReward.append(makeElement('span', 'referral-reward-label', text('Вы получите', 'You receive')), makeElement('strong', 'referral-reward-amount'));
    calculation.append(friendReward, ownerReward);
    const updateCalculation = () => {
      const gift = Math.max(0, Math.min(50, Number(range.value) || 0));
      const setGemAmount = (target, amount) => {
        target.replaceChildren(document.createTextNode(String(amount) + ' '), makeElement('span', 'referral-gem-inline', '💎'));
      };
      setGemAmount(giftHeading.querySelector('.referral-gift-value'), gift);
      friendReward.querySelector('.referral-reward-amount').replaceChildren(document.createTextNode(String(gift) + ' '), makeElement('span', 'referral-gem-inline', '💎'));
      ownerReward.querySelector('.referral-reward-amount').replaceChildren(document.createTextNode(String(60 - gift) + ' '), makeElement('span', 'referral-gem-inline', '💎'));
    };
    range.addEventListener('input', updateCalculation);
    updateCalculation();
    rewardCard.append(range, calculation);
    card.appendChild(rewardCard);

    const saveButton = button(text('Сохранить изменения', 'Save changes'), 'btn btn--primary btn--full referral-save-btn', async event => {
      const target = event.currentTarget;
      target.disabled = true;
      target.textContent = text('Сохранение…', 'Saving…');
      try {
        const result = await api('saveSettings', { shareText: message.value, giftAmount: Number(range.value) });
        if (result.limited) {
          const until = Date.now() + Math.max(0, Number(result.retryAfter) || 0) * 1000;
          applySaveCooldown(target, until);
          showToast(text('Сохранять настройки можно раз в 2 минуты.', 'Settings can only be saved once every 2 minutes.'));
          return;
        }
        if (result.saved !== true) throw new Error(text('Не удалось сохранить настройки.', 'Could not save settings.'));
        await loadState();
        showToast(text('Настройки сохранены', 'Settings saved'));
      } catch (error) {
        showToast(error.message);
      } finally {
        if (target.isConnected && target.textContent === text('Сохранение…', 'Saving…')) {
          target.disabled = false;
          target.textContent = text('Сохранить изменения', 'Save changes');
        }
      }
    });
    card.appendChild(saveButton);
    const cooldownRemaining = Math.max(0, Number(referral.saveCooldownRemaining) || 0);
    if (cooldownRemaining > 0) applySaveCooldown(saveButton, Date.now() + cooldownRemaining * 1000);
    return card;
  }

  function buildStatisticsCard(initialStats) {
    const card = makeElement('div', 'card referral-statistics-card');
    card.appendChild(makeElement('div', 'card__title', text('Статистика рефералов', 'Referral statistics')));
    const totals = makeElement('div', 'referral-statistics-totals');
    const addMetric = (label, value, hasGem = false) => {
      const item = makeElement('div', 'referral-statistics-metric');
      const caption = makeElement('span', 'referral-statistics-label');
      caption.append(document.createTextNode(label));
      if (hasGem) caption.append(document.createTextNode(' '), makeElement('span', 'referral-gem-inline', '💎'));
      item.append(caption, makeElement('strong', '', String(value || 0)));
      totals.appendChild(item);
    };
    addMetric(text('Приглашено', 'Invited'), initialStats.totalInvited);
    addMetric(text('Получено всего', 'Earned total'), initialStats.totalOwnerEarned, true);
    addMetric(text('Подарено', 'Gifted'), initialStats.totalGifted, true);
    card.appendChild(totals);

    const controls = makeElement('div', 'referral-statistics-controls');
    const period = document.createElement('select');
    period.className = 'referral-period-select';
    [['day', text('По дням', 'By day')], ['week', text('По неделям', 'By week')], ['month', text('По месяцам', 'By month')], ['year', text('По годам', 'By year')]].forEach(([value, label]) => {
      const option = document.createElement('option'); option.value = value; option.textContent = label; period.appendChild(option);
    });
    const groups = makeElement('div', 'referral-statistics-groups');
    controls.append(period);
    card.append(controls, groups);

    function updateStats(data) {
      totals.innerHTML = '';
      addMetric(text('Приглашено', 'Invited'), data.totalInvited);
      addMetric(text('Получено всего', 'Earned total'), data.totalOwnerEarned, true);
      addMetric(text('Подарено', 'Gifted'), data.totalGifted, true);
      groups.innerHTML = '';
      if (!data.groups || !data.groups.length) {
        groups.appendChild(makeElement('p', 'field__hint', text('За выбранный период приглашений пока нет.', 'No referrals in the selected period yet.')));
        return;
      }
      data.groups.forEach(item => {
        const row = makeElement('div', 'referral-statistics-row');
        const earned = makeElement('span', 'referral-statistics-earned');
        earned.append(document.createTextNode('+' + item.earned + ' '), makeElement('span', 'referral-gem-inline', '💎'));
        row.append(makeElement('span', '', item.period),
          makeElement('span', '', text('Приглашено: ', 'Invited: ') + item.invited),
          earned);
        groups.appendChild(row);
      });
    }
    async function loadPeriod() {
      try {
        const result = await api('getStats', { period: period.value });
        updateStats(result);
      } catch (error) { showToast(error.message); }
    }
    period.addEventListener('change', loadPeriod);
    updateStats(initialStats);
    return card;
  }

  function renderReferralState(state) {
    referralState = state;
    const host = content();
    if (!host) return;
    host.innerHTML = '';
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
      referralScreenLoaded = true;
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
    if (!referralScreenLoaded) await loadState().catch(() => {});
  }

  let refreshCooldownInterval = null;
  const REFRESH_COOLDOWN_MS = 120000;
  function refreshCooldownKey() { return 'buyad_referral_refresh_at_' + String(telegramId() || 'user'); }
  function refreshCooldownUntil() { try { return Number(localStorage.getItem(refreshCooldownKey())) || 0; } catch (_) { return 0; } }
  function applyRefreshCooldown(until = refreshCooldownUntil()) {
    const refresh = document.getElementById('refresh-referrals');
    const label = refresh?.querySelector('span');
    if (refreshCooldownInterval) clearInterval(refreshCooldownInterval);
    refreshCooldownInterval = null;
    const update = () => {
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      if (remaining > 0) {
        if (refresh) refresh.disabled = true;
        if (label) label.textContent = text('Обновить через ', 'Refresh in ') + formatReferralCooldown(remaining);
        if (refresh) refresh.title = text('Повторное обновление будет доступно через ', 'Refresh available in ') + formatReferralCooldown(remaining);
      } else {
        if (refresh) refresh.disabled = false;
        if (label) label.textContent = text('Обновить', 'Refresh');
        if (refresh) refresh.title = text('Обновить данные', 'Refresh data');
        if (refreshCooldownInterval) clearInterval(refreshCooldownInterval);
        refreshCooldownInterval = null;
      }
    };
    update();
    if (until > Date.now()) refreshCooldownInterval = setInterval(update, 1000);
  }
  async function refreshReferralScreen() {
    const refresh = document.getElementById('refresh-referrals');
    if (refresh?.disabled) return;
    const until = Date.now() + REFRESH_COOLDOWN_MS;
    try { localStorage.setItem(refreshCooldownKey(), String(until)); } catch (_) {}
    applyRefreshCooldown(until);
    if (refresh) refresh.setAttribute('aria-busy', 'true');
    try {
      await loadState();
      showToast(text('Данные обновлены', 'Referral data updated'));
    } catch (_) {
      // loadState already displays the error and diagnostics action.
    } finally {
      if (refresh) refresh.removeAttribute('aria-busy');
      applyRefreshCooldown();
    }
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
      'Добро пожаловать!\nПодарок уже зачислен на ваш баланс.',
      'Welcome!\nYour gift has been added to your balance.'
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
    const refresh = document.getElementById('refresh-referrals');
    if (nav) nav.addEventListener('click', () => { openReferralScreen(); });
    if (back) back.addEventListener('click', backToMain);
    if (refresh) refresh.addEventListener('click', refreshReferralScreen);
    applyRefreshCooldown();

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
