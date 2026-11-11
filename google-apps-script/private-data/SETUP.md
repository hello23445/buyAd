# BuyAd private data GAS

## Таблица
Скрипт использует первый лист таблицы `1UpHiiY8EiEApSFfxdE0VWlgoGk4M4Vh2-lMBhIiVibI`.

- A2: Telegram bot token (private; do not expose it in GitHub or the browser)
- B2: JSON array for BanForever
- C2: JSON array for BlockCreateAds
- D2: JSON array for BlockedUsersTelegramID
- E2: JSON array for BlockedUsersIPadresses
- F2: JSON array for UserWarnings
- G2: private admin registry JSON, e.g. `{"admins":[{"telegram_id":"YOUR_TELEGRAM_ID","admin_name":"Главный администратор","admin_level":5,"permissions":{}}]}`

The five data cells B2:F2 must contain valid JSON arrays. An empty cell means [].

## Deploy
1. Open Apps Script at https://script.google.com/ and create a standalone project.
2. Replace Code.gs with this repository file.
3. Ensure the Google account deploying the script has Editor access to the spreadsheet.
4. Deploy > New deployment > Web app.
5. Execute as: Me. Who has access: Anyone.
6. Copy the Web app URL. The app must send Telegram WebApp initData; requests without a valid Telegram signature are rejected.
7. Keep the spreadsheet private. Do not add the token or registry to public files.

## API
- getMyRestrictions: returns only records matching the authenticated Telegram ID (or the user's supplied app token).
- getAdminData: requires the Telegram ID to exist in G2 and returns the lists.
- updatePunishment / removePunishment: require a matching administrator and server-side permission check.

The endpoint uses JSONP for browser compatibility with Apps Script web apps. Mutating requests are still authenticated with signed Telegram initData and checked against the private admin registry.
