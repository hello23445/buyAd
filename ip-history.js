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

  function showConsentNotice() {
    if (localStorage.getItem(CONSENT_KEY) === NOTICE_VERSION || !ready()) return;
    if (document.getElementById("ip-history-consent")) return;
    const box = document.createElement("section");
    box.id = "ip-history-consent";
    box.className = "card";
    box.style.cssText = "position:fixed;z-index:850;left:12px;right:12px;bottom:12px;max-width:680px;margin:auto;box-shadow:0 8px 30px rgba(0,0,0,.35)";
    const text = document.createElement("p");
    text.className = "card__subtitle";
    text.textContent = "Для защиты аккаунтов приложение может сохранять защищённый отпечаток IP-адреса и Telegram ID. Исходный IP не сохраняется в базе; срок хранения записей — до 30 дней. Администраторы с отдельным разрешением могут искать совпадения. Общий IP не означает, что аккаунты принадлежат одному человеку.";
    const actions = document.createElement("div");
    actions.className = "row row--wrap";
    const accept = document.createElement("button");
    accept.className = "btn btn--primary";
    accept.type = "button";
    accept.textContent = "Понятно, продолжить";
    accept.addEventListener("click", async () => {
      localStorage.setItem(CONSENT_KEY, NOTICE_VERSION);
      box.remove();
      await record();
    });
    const decline = document.createElement("button");
    decline.className = "btn btn--ghost";
    decline.type = "button";
    decline.textContent = "Не разрешать";
    decline.addEventListener("click", () => {
      localStorage.setItem(CONSENT_KEY, "declined:" + NOTICE_VERSION);
      box.remove();
    });
    actions.append(accept, decline);
    box.append(text, actions);
    document.body.appendChild(box);
  }

  async function record() {
    if (!ready() || localStorage.getItem(CONSENT_KEY) !== NOTICE_VERSION) return;
    const last = Number(sessionStorage.getItem("buyAdIpHistoryRecordedAt") || 0);
    if (Date.now() - last < 5 * 60 * 1000) return;
    try {
      await callFunction("record-ip-history", { consentVersion: NOTICE_VERSION });
      sessionStorage.setItem("buyAdIpHistoryRecordedAt", String(Date.now()));
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



  function install() {
    const searchButton = document.getElementById("admin-search-ip-history");
    const backButton = document.getElementById("back-from-ip-history-search");
    const submitButton = document.getElementById("ip-history-search-submit");
    const baseAdmin = typeof getBaseAdminByToken === "function" ? getBaseAdminByToken() : null;
    // IP-history search is restricted to the configured root admin, independent
    // of the local level-preview selector. The Edge Function also checks its allowlist.
    if (searchButton) {
      searchButton.hidden = !(baseAdmin && Number(baseAdmin.admin_level) === 5);
      searchButton.addEventListener("click", showSearchScreen);
    }
    backButton?.addEventListener("click", () => {
      const screen = document.getElementById("screen-ip-history-search");
      if (screen) screen.hidden = true;
      const adminScreen = document.getElementById("screen-admin");
      if (adminScreen) adminScreen.hidden = false;
      if (tg?.BackButton) tg.BackButton.show();
    });
    submitButton?.addEventListener("click", search);
    document.getElementById("ip-history-search-input")?.addEventListener("keydown", event => {
      if (event.key === "Enter") search();
    });
    showConsentNotice();
    record();
  }

  window.BuyAdIpHistory = { record };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
})();