(() => {
  "use strict";
  function install() {
    const menu = document.querySelector("#screen-admin .menu");
    if (!menu || document.getElementById("admin-user-statistics")) return;
    const button = document.createElement("button");
    button.id = "admin-user-statistics";
    button.type = "button";
    button.className = "menu__item";
    button.textContent = "Статистика пользователя";
    button.hidden = Number(window.getCurrentAdmin?.()?.admin_level || 0) < 2;
    button.addEventListener("click", () => {
      const query = window.prompt("Введите Telegram ID или токен пользователя:");
      if (query) window.openModal?.("Статистика пользователя", "Серверный модуль ещё не подключён.");
    });
    menu.appendChild(button);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install, { once: true });
  else install();
  document.addEventListener("click", event => {
    if (event.target.closest("#nav-admin")) setTimeout(install, 0);
  });
})();
