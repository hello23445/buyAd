# BuyAd kick service — deployment

The website-side /kick command is committed, but the kick backend must be deployed as a Google Apps Script Web App before kicks can be issued or enforced. The backend writes persistent kick records to the existing BuyAd Google spreadsheet.

## 1. Create the Apps Script project

1. Open https://script.google.com/ using the Google account that has edit access to the BuyAd spreadsheet.
2. Create a new standalone Apps Script project.
3. Copy the complete contents of google-apps-script/kick/Code.gs into its Code.gs.
4. Open Project Settings → Script Properties and add:
   - Property: TELEGRAM_BOT_TOKEN
   - Value: the Telegram bot token used by the BuyAd Mini App.
5. Save the project. Run a function from the editor once if Google requests authorization for Sheets and external requests.

The spreadsheet ID is already configured in the source. On the first request, the script creates a KickedUsers sheet with the kick records. Do not change or delete its header row.

## 2. Deploy the Web App

1. Select Deploy → New deployment → Web app.
2. Set Execute as to Me.
3. Set Who has access to Anyone. Requests are authenticated by verifying Telegram's signed Mini App initData on the server.
4. Deploy and copy the URL ending in /exec.

Open kick-config.js in this repository and replace the empty value:

    const GAS_KICK_URL = '';

with the deployed Web App URL. Commit and publish the website update.

## 3. Admin identity check

The backend checks the admin level in the live admin.js registry and also checks that the admin token is linked to the same Telegram ID in data/user-statistics.json. This prevents a copied token alone from authorizing a kick.

Each admin who will use /kick must open the Mini App at least once so their token-to-Telegram-ID association is present in the statistics archive. If the backend reports that it cannot confirm the association, have that admin open the app, wait for the statistics archive to update, and retry.

- Only level 2+ admins can kick.
- Hiding the admin name is accepted only for level 5 when the live registry grants hideNameOnBan.
- A kick remains active until the record is changed or removed in the KickedUsers sheet.
- The Mini App checks the kick status on entry and periodically while open. The kicked screen displays the reason and admin name (or “Скрыто”).

## 4. Updating the backend

After changing Code.gs, deploy a new version of the Web App (or update the existing deployment). If the deployment URL changes, update GAS_KICK_URL in kick-config.js as well.