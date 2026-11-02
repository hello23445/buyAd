(() => {
  "use strict";
  const NOTICE_VERSION = "2026-11-02";
  const CONSENT_KEY = "buyAdIpHistoryConsent";
  const config = () => window.BUYAD_SUPABASE_CONFIG || {};
  const tg = window.Telegram?.WebApp;
  const endpoint = name => String(config().url || "").replace(/\/$/, "") + "/functions/v1/" + name;
  const ready = (requireEnabled = true) => (!requireEnabled || config().enabled === true) && /^https:\/\//.test(config().url || "") && !!config().anonKey && !!tg?.initData;

  async function callFunction(name, payload, requireEnabled = true) {
    if (!ready(requireEnabled)) throw new Error("Supabase ещё не настроен.");
    const response = await fetch(endpoint(name), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": config().anonKey,
        "Authorization": "Bearer " + config().anonKey
      },
      body: JSON.stringify({ ...payload, initData: tg.initData })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Ошибка Supabase: " + response.status);
    return data;
  }

  function requestConsent() {
    const saved = localStorage.getItem(CONSENT_KEY);
    if (saved === NOTICE_VERSION) return Promise.resolve(true);
    if (saved === "declined:" + NOTICE_VERSION) return Promise.resolve(false);

    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "ip-consent-overlay";
      overlay.style.cssText = "position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,.68)";
      const modal = document.createElement("section");
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", "ip-consent-title");
      modal.style.cssText = "width:min(440px,100%);max-height:85vh;overflow:auto;padding:22px;border-radius:18px;background:var(--card-bg,#fff);color:var(--text-color,#111);box-shadow:0 18px 60px rgba(0,0,0,.3)";
      const title = document.createElement("h2");
      title.id = "ip-consent-title";
      const lang = localStorage.getItem("lang") || "ru";
      const translations = typeof i18n !== "undefined" ? i18n[lang] || i18n.ru : {};
      title.textContent = "Внимание!";
      const message = document.createElement("p");
      message.style.cssText = "line-height:1.55;white-space:normal";
      message.textContent = "Тут вы можете создавать свои рекламы, но одно нарушение правил - будете наказаны согласно правилам.";
      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:20px";
      const decline = document.createElement("button");
      decline.type = "button";
      //decline.textContent = translations.ipHistoryConsentDecline || "Отказаться";
      const accept = document.createElement("button");
      accept.type = "button";
      accept.textContent = translations.ipHistoryConsentAccept || "Согласен";
      for (const button of [decline, accept]) button.style.cssText = "border:0;border-radius:10px;padding:11px 16px;font:inherit;cursor:pointer";
      accept.style.background = "var(--button-color,#2481cc)";
      accept.style.color = "var(--button-text-color,#fff)";
      decline.style.background = "var(--hint-color,#e5e7eb)";
      const finish = accepted => {
        localStorage.setItem(CONSENT_KEY, accepted ? NOTICE_VERSION : "declined:" + NOTICE_VERSION);
        overlay.remove();
        resolve(accepted);
      };
      accept.addEventListener("click", () => finish(true));
      decline.addEventListener("click", () => finish(false));
      overlay.addEventListener("click", event => { if (event.target === overlay) finish(false); });
      modal.addEventListener("keydown", event => { if (event.key === "Escape") finish(false); });
      actions.append(decline, accept);
      modal.append(title, message, actions);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
      accept.focus();
    });
  }

  async function record() {
    if (!ready() || !(await requestConsent())) return;
    try {
      await callFunction("record-ip-history", { consentVersion: NOTICE_VERSION });
    } catch (error) {
      console.warn("IP history was not recorded:", error);
    }
  }

  function showSearchScreen() {
    const screen = document.getElementById("screen-ip-history-search");
    document.querySelectorAll(".screen").forEach(item => item.hidden = true);
    if (screen) screen.hidden = false;
    if (tg?.BackButton) tg.BackButton.show();
  }

  function showAccountDetails(row) {
    const lang = localStorage.getItem("lang") || "ru";
    const ru = lang === "ru";
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay ip-account-modal-overlay";
    const modal = document.createElement("section");
    modal.className = "modal ip-account-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    const head = document.createElement("div");
    head.className = "modal__head";
    const title = document.createElement("h2");
    title.className = "modal__title";
    title.textContent = ru ? "Информация об аккаунте" : "Account information";
    const close = document.createElement("button");
    close.type = "button";
    close.className = "icon-btn";
    close.textContent = "×";
    close.setAttribute("aria-label", ru ? "Закрыть" : "Close");
    const body = document.createElement("div");
    body.className = "modal__body";
    const fields = [
      [ru ? "Telegram ID" : "Telegram ID", String(row.telegramId ?? "—")],
      [ru ? "Количество событий" : "Number of events", String(row.events ?? "—")],
      [ru ? "Первое появление" : "First seen", row.firstSeen ? new Date(row.firstSeen).toLocaleString() : "—"],
      [ru ? "Последнее появление" : "Last seen", row.lastSeen ? new Date(row.lastSeen).toLocaleString() : "—"]
    ];
    for (const [label, value] of fields) {
      const item = document.createElement("p");
      const strong = document.createElement("strong");
      strong.textContent = label + ": ";
      item.append(strong, document.createTextNode(value));
      body.appendChild(item);
    }
    const note = document.createElement("p");
    note.className = "field__hint";
    note.textContent = ru
      ? "Доступны только сведения, сохранённые в истории IP. Данные localStorage другого устройства и секретные токены удалённо недоступны."
      : "Only information stored in IP history is available. Another device's localStorage and secret tokens cannot be accessed remotely.";
    body.appendChild(note);
    const closeModal = () => overlay.remove();
    close.addEventListener("click", closeModal);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeModal(); });
    head.append(title, close);
    modal.append(head, body);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    close.focus();
  }

  async function search() {
    const input = document.getElementById("ip-history-search-input");
    const status = document.getElementById("ip-history-search-status");
    const results = document.getElementById("ip-history-search-results");
    const button = document.getElementById("ip-history-search-submit");
    if (!input || !status || !results || !button) return;
    const ip = input.value.trim();
    if (!ip) { status.textContent = "Введите IP-адрес."; return; }
    status.textContent = "Поиск…";
    results.replaceChildren();
    button.disabled = true;
    try {
      const data = await callFunction("search-users-by-ip", { ip });
      const rows = Array.isArray(data.results) ? data.results : [];
      status.textContent = rows.length ? "Найдено аккаунтов: " + rows.length : "Совпадений не найдено.";
      for (const row of rows) {
        const card = document.createElement("button");
        card.type = "button";
        card.className = "card ip-history-account-card";
        card.style.cssText = "display:block;width:100%;text-align:left;cursor:pointer;margin:8px 0";
        const id = document.createElement("strong");
        id.textContent = "Telegram ID: " + row.telegramId;
        const details = document.createElement("div");
        details.className = "field__hint";
        details.textContent = "Событий: " + row.events + " · Первое: " + new Date(row.firstSeen).toLocaleString() + " · Последнее: " + new Date(row.lastSeen).toLocaleString();
        const hint = document.createElement("div");
        hint.className = "field__hint";
        hint.textContent = lang === "ru" ? "Нажмите, чтобы открыть сведения об аккаунте" : "Tap to view account details";
        card.append(id, details, hint);
        card.addEventListener("click", () => showAccountDetails(row));
        results.appendChild(card);
      }
    } catch (error) {
      status.textContent = error.message || "Не удалось выполнить поиск.";
    } finally {
      button.disabled = false;
    }
  }


  async function diagnoseHeaders() {
    const button = document.getElementById("ip-history-diagnose-submit");
    const status = document.getElementById("ip-history-diagnose-status");
    if (!button || !status) return;
    button.disabled = true;
    status.textContent = "Проверка заголовков…";
    try {
      // This endpoint is read-only with respect to IP history and works while collection is disabled.
      const data = await callFunction("diagnose-ip-headers", {}, false);
      const h = data.headers || {};
      const yesNo = value => value ? "Да" : "Нет";
      status.textContent = [
        "Авторизация: " + (data.authorized ? "успешна" : "не подтверждена"),
        "CF-Connecting-IP: " + yesNo(h.cfConnectingIpPresent) + (h.cfConnectingIpPresent ? " (корректный IP: " + yesNo(h.cfConnectingIpIsValidIp) + ")" : ""),
        "X-Real-IP: " + yesNo(h.xRealIpPresent) + (h.xRealIpPresent ? " (корректный IP: " + yesNo(h.xRealIpIsValidIp) + ")" : ""),
        "X-Forwarded-For: " + yesNo(h.xForwardedForPresent) + " (записей: " + Number(h.xForwardedForEntryCount || 0) + ")",
        "XFF первая запись корректна: " + yesNo(h.xForwardedForFirstIsValidIp),
        "XFF последняя запись корректна: " + yesNo(h.xForwardedForLastIsValidIp),
        "CF совпадает с XFF первой: " + yesNo(h.cfEqualsXForwardedForFirst),
        "CF совпадает с XFF последней: " + yesNo(h.cfEqualsXForwardedForLast),
        "CF совпадает с X-Real-IP: " + yesNo(h.cfEqualsXRealIp),
        "",
        data.note || "Значения IP не отображаются и не сохраняются."
      ].join(String.fromCharCode(10));
    } catch (error) {
      status.textContent = error.message || "Не удалось выполнить диагностику.";
    } finally {
      button.disabled = false;
    }
  }

  function install() {
    const searchButton = document.getElementById("admin-search-ip-history");
    const backButton = document.getElementById("back-from-ip-history-search");
    const submitButton = document.getElementById("ip-history-search-submit");
    const diagnoseMenuButton = document.getElementById("admin-diagnose-ip-headers");
    const diagnoseButton = document.getElementById("ip-history-diagnose-submit");
    const diagnoseCard = document.getElementById("ip-history-diagnose-card");
    const baseAdmin = typeof getCurrentAdmin === "function" ? getCurrentAdmin() : null;
    // Respect the currently selected local preview level as well as the server-side admin allowlist.
    if (searchButton) {
      searchButton.hidden = !(baseAdmin && Number(baseAdmin.admin_level) === 5);
      searchButton.addEventListener("click", showSearchScreen);
    }
    // Diagnostics are also restricted by the active level preview.
    if (diagnoseMenuButton) {
      diagnoseMenuButton.hidden = !(baseAdmin && Number(baseAdmin.admin_level) === 5);
    }
    backButton?.addEventListener("click", () => {
      const screen = document.getElementById("screen-ip-history-search");
      if (screen) screen.hidden = true;
      const adminScreen = document.getElementById("screen-admin");
      if (adminScreen) adminScreen.hidden = false;
      if (tg?.BackButton) tg.BackButton.show();
    });
    submitButton?.addEventListener("click", search);
    diagnoseMenuButton?.addEventListener("click", () => {
      if (diagnoseCard) diagnoseCard.hidden = false;
      document.getElementById("ip-history-diagnose-status").textContent = "Нажмите «Запустить проверку».";
      diagnoseCard?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
    diagnoseButton?.addEventListener("click", diagnoseHeaders);
    document.getElementById("ip-history-search-input")?.addEventListener("keydown", event => {
      if (event.key === "Enter") search();
    });
    record();
  }

  window.BuyAdIpHistory = { record };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();
