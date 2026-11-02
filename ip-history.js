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
      title.textContent = "Конфиденциальность и история IP";
      const message = document.createElement("p");
      message.style.cssText = "line-height:1.55;white-space:normal";
      message.textContent = "При входе приложение может определить ваш IP-адрес и сохранить его защищённый хеш, связанный с вашим Telegram ID. Новая запись создаётся только при первом входе или изменении IP. История хранится до 30 дней и доступна только уполномоченным администраторам для проверки совпадений. Совпадение IP не доказывает, что аккаунты принадлежат одному человеку.";
      const actions = document.createElement("div");
      actions.style.cssText = "display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap;margin-top:20px";
      const decline = document.createElement("button");
      decline.type = "button";
      decline.textContent = "Отказаться";
      const accept = document.createElement("button");
      accept.type = "button";
      accept.textContent = "Согласен";
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
        const card = document.createElement("div");
        card.className = "card";
        const id = document.createElement("strong");
        id.textContent = "Telegram ID: " + row.telegramId;
        const details = document.createElement("div");
        details.className = "field__hint";
        details.textContent = "Событий: " + row.events + " · Первое: " + new Date(row.firstSeen).toLocaleString() + " · Последнее: " + new Date(row.lastSeen).toLocaleString();
        card.append(id, details);
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
    const baseAdmin = typeof getBaseAdminByToken === "function" ? getBaseAdminByToken() : null;
    // IP-history search is restricted to the configured root admin, independent
    // of the local level-preview selector. The Edge Function also checks its allowlist.
    if (searchButton) {
      searchButton.hidden = !(baseAdmin && Number(baseAdmin.admin_level) === 5);
      searchButton.addEventListener("click", showSearchScreen);
    }
    // Show diagnostics to the configured root admin even when local level preview is active.
    // The Edge Function independently verifies the Telegram ID against the server allowlist.
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