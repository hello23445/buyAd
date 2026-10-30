/* BuyAd warning UI. Runtime records are stored in this browser's localStorage. */
(() => {
  const WARN_KEY = 'buyAdWarningsV1';
  const USER_LOG_KEY = 'buyAdUserLogsV1';
  const ADMIN_LOG_KEY = 'buyAdAdminLogsV1';
  const read = key => { try { const v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const token = () => localStorage.getItem('token') || localStorage.getItem('userToken') || '';
  const telegramId = () => String(window.Telegram?.WebApp?.initDataUnsafe?.user?.id || '');
  const currentAdmin = () => { try { return typeof getCurrentAdmin === 'function' ? getCurrentAdmin() : null; } catch { return null; } };
  const level = () => Number(currentAdmin()?.admin_level || 0);
  const adminName = () => currentAdmin()?.admin_name || ('Администратор ' + level() + ' уровня');
  const log = (key, item) => { const rows = read(key); rows.push({ id: Date.now() + '_' + Math.random().toString(36).slice(2), timestamp: new Date().toISOString(), ...item }); write(key, rows.slice(-5000)); };
  const warningsFor = (t, id) => read(WARN_KEY).filter(w => (t && w.token === t) || (id && w.telegramId === id));
  const targetPrompt = () => {
    const value = prompt('Введите токен пользователя или Telegram ID:');
    if (!value) return null;
    return /^\d{4,}$/.test(value.trim()) ? { telegramId: value.trim() } : { token: value.trim() };
  };
  const escape = s => String(s || '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  function show(title, text) {
    if (typeof openModal === 'function') openModal(title, '<pre style="white-space:pre-wrap;overflow-wrap:anywhere;max-height:55vh;overflow:auto">' + escape(text) + '</pre>', [{text:'OK'}]);
    else alert(title + '\n\n' + text);
  }
  function refresh() {
    const t = token(), id = telegramId(), rows = warningsFor(t, id);
    const button = document.getElementById('nav-warnings');
    if (button) button.hidden = rows.length === 0;
    const locked = rows.some(w => w.lockUntil && Date.parse(w.lockUntil) > Date.now());
    const create = document.getElementById('nav-create');
    if (create && locked) { create.disabled = true; create.title = 'Блокировка до ' + new Date(rows.find(w => w.lockUntil).lockUntil).toLocaleString(); }
  }
  function issueWarning() {
    if (level() < 2) return alert('Предупреждения доступны администраторам уровня 2 и выше.');
    const target = targetPrompt(); if (!target) return;
    const reason = prompt('Причина предупреждения:'); if (!reason || !reason.trim()) return alert('Нужно указать причину.');
    const rows = read(WARN_KEY);
    const current = rows.filter(w => (target.token && w.token === target.token) || (target.telegramId && w.telegramId === target.telegramId));
    if (current.length >= 3) return alert('У пользователя уже 3/3 предупреждения.');
    const limits = {2:2,3:4,4:7,5:Infinity};
    const today = new Date().toISOString().slice(0,10);
    const issuedToday = read(ADMIN_LOG_KEY).filter(x => x.adminToken === token() && x.action === 'warning_issued' && x.timestamp.slice(0,10) === today).length;
    if (issuedToday >= (limits[level()] || 0)) return alert('Достигнут дневной лимит.');
    const issuedAt = new Date().toISOString(), count = current.length + 1;
    const warning = { id:'w_' + Date.now(), ...target, reason:reason.trim(), issuedAt, adminName:adminName(), adminToken:token(), count,
      removeAt:new Date(Date.now() + 2*86400000).toISOString() };
    if (count === 3) { warning.lockUntil = new Date(Date.now() + 5*86400000).toISOString(); warning.removeAt = warning.lockUntil; }
    if (count === 2) warning.adLimitUntil = new Date(Date.now() + 86400000).toISOString();
    rows.push(warning); write(WARN_KEY, rows);
    log(ADMIN_LOG_KEY, {adminToken:token(), adminName:adminName(), adminLevel:level(), action:'warning_issued', target, reason:reason.trim(), warningCount:count, durationDays:count===3?5:2});
    log(USER_LOG_KEY, {token:target.token||'', telegramId:target.telegramId||'', event:'warning_issued', reason:reason.trim(), adminName:warning.adminName, warningCount:count});
    refresh(); alert('Предупреждение выдано: ' + count + '/3');
  }
  function removeWarnings() {
    if (level() !== 5) return alert('Снимать предупреждения может только администратор уровня 5.');
    const target = targetPrompt(); if (!target) return;
    const rows = read(WARN_KEY), removed = rows.filter(w => (target.token && w.token===target.token) || (target.telegramId && w.telegramId===target.telegramId));
    if (!removed.length) return alert('Предупреждения не найдены.');
    write(WARN_KEY, rows.filter(w => !removed.includes(w)));
    log(ADMIN_LOG_KEY, {adminToken:token(),adminName:adminName(),adminLevel:level(),action:'warnings_removed',target,removedCount:removed.length});
    refresh(); alert('Предупреждения сняты.');
  }
  function install() {
    const crystals = document.getElementById('nav-crystals');
    if (crystals && !document.getElementById('nav-warnings')) {
      const b = document.createElement('button'); b.id='nav-warnings'; b.type='button'; b.className=crystals.className; b.hidden=true;
      b.innerHTML='<span class="menu__icon"><i class="fa-solid fa-triangle-exclamation"></i></span><span class="menu__text">Список предупреждений</span><span class="menu__chev"><i class="fa-solid fa-chevron-right"></i></span>';
      crystals.insertAdjacentElement('afterend', b);
      b.addEventListener('click', () => {
        const rows=warningsFor(token(),telegramId());
        show('Список предупреждений', rows.map((w,i)=>(i+1)+'. Дата: '+new Date(w.issuedAt).toLocaleString()+'\nСнять после: '+new Date(w.removeAt).toLocaleString()+'\nПричина: '+w.reason+'\nАдминистратор: '+(w.adminName||'Скрыт')).join('\n\n') || 'Предупреждений нет.');
      });
    }
    const adminMenu=document.querySelector('#screen-admin .menu');
    if (adminMenu && !document.getElementById('warn-issue')) {
      const box=document.createElement('div'); box.className='stack-sm'; box.style.marginTop='12px';
      box.innerHTML='<button id="warn-issue" class="btn btn--primary">Выдать предупреждение (ур. 2+)</button><button id="warn-remove" class="btn btn--ghost">Снять предупреждения (ур. 5)</button><button id="warn-user-log" class="btn btn--ghost">Журнал пользователя (ур. 5)</button><button id="warn-admin-log" class="btn btn--ghost">Журнал администраторов (ур. 5)</button><button id="warn-ip-search" class="btn btn--ghost">Поиск по IP (ур. 4+)</button>';
      adminMenu.parentElement.appendChild(box);
      document.getElementById('warn-issue').onclick=issueWarning;
      document.getElementById('warn-remove').onclick=removeWarnings;
      document.getElementById('warn-user-log').onclick=()=>{
        if(level()<5)return alert('Только уровень 5.');
        const q=prompt('Токен или Telegram ID пользователя:'); if(!q)return;
        show('Журнал пользователя',read(USER_LOG_KEY).filter(x=>x.token===q||x.telegramId===q).map(x=>JSON.stringify(x)).join('\n\n')||'Записей нет.');
      };
      document.getElementById('warn-admin-log').onclick=()=>{
        if(level()<5)return alert('Только уровень 5.');
        const from=prompt('Дата начала YYYY-MM-DD (необязательно):')||'', to=prompt('Дата окончания YYYY-MM-DD (необязательно):')||'';
        show('Журнал администраторов',read(ADMIN_LOG_KEY).filter(x=>(!from||x.timestamp.slice(0,10)>=from)&&(!to||x.timestamp.slice(0,10)<=to)).map(x=>JSON.stringify(x)).join('\n\n')||'Записей нет.');
      };
      document.getElementById('warn-ip-search').onclick=()=>{
        if(level()<4)return alert('Доступно с уровня 4.');
        const ip=prompt('IP-адрес:'); if(!ip)return;
        show('Поиск по IP',read(USER_LOG_KEY).filter(x=>x.ip===ip||x.clientIp===ip).map(x=>JSON.stringify(x)).join('\n\n')||'В локальных журналах совпадений нет.');
        log(ADMIN_LOG_KEY,{adminToken:token(),adminName:adminName(),adminLevel:level(),action:'ip_lookup',ip});
      };
    }
    refresh();
  }
  window.BuyAdWarnings = { warningsFor, refresh, userLogs:()=>read(USER_LOG_KEY), adminLogs:()=>read(ADMIN_LOG_KEY) };
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', install); else install();
  setInterval(refresh, 60000);
})();