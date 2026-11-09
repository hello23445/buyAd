# BuyAd referral system — deployment

The website UI and the Google Apps Script backend are committed separately. Referrals stay unavailable until the backend URL and Telegram bot secret are configured.

## 1. Create the Apps Script backend

1. Open [script.google.com](https://script.google.com/) while signed in to the Google account that can edit the BuyAd spreadsheet.
2. Create a new standalone Apps Script project.
3. Copy the contents of `google-apps-script/referrals/Code.gs` from this repository into the project's `Code.gs`.
4. In **Project Settings → Script Properties**, add:
   - Property: `TELEGRAM_BOT_TOKEN`
   - Value: the token for the bot that owns the Mini App `buyAdss_bot`.

   Do not put this token in `settings.js`, GitHub, or browser code.
5. Save and run any function once from the Apps Script editor to authorize Google Sheets and external requests.

The spreadsheet ID is already set in the server source. The backend reads the Telegram ID from `Users!A:A` and the crystal balance from `Users!C:C`. It creates these sheets automatically when needed:

- `Referrals` — one link and its settings per owner.
- `ReferralVisits` — the first visit and pending reward state for each Telegram account.
- `ReferralEvents` — the immutable ledger of successful referrals and both sides of each reward.

The first row of each new sheet is populated with column headers. Existing `Users` rows are not rewritten; if a new Telegram account has no row yet, its row is created with the Telegram ID in column A and the starting crystal balance in column C.

## 2. Deploy as a Web App

1. In Apps Script select **Deploy → New deployment → Web app**.
2. Set **Execute as** to **Me**.
3. Set **Who has access** to **Anyone** (Telegram users are authenticated by the signed Mini App `initData` in the backend).
4. Deploy and copy the Web App URL ending in `/exec`.

In the repository, edit `settings.js` and replace the empty value in:

```js
const REFERRAL_GAS_URL = '';
```

with the deployed `/exec` URL. Commit and publish that change with the rest of the website.

When changing the Apps Script code later, create a new deployment version or update the existing deployment to the new version.

## 3. How rewards work

- Creating the first referral link costs 25 crystals. The backend checks the signed Telegram ID, the Users row, the server-side balance, and account restrictions before deducting the crystals.
- The referral code is `ref_` plus an HMAC-SHA-256 digest of the owner's Telegram ID, keyed with the server-only bot token from Script Properties. This avoids exposing a plain, easily enumerable hash of numeric Telegram IDs. It is stored in `Referrals`; the public URL is `https://t.me/buyAdss_bot/buy?startapp=ref_{hash}`.
- The first visit is stamped before the website's legacy `initUser` request can create a row in `Users`. A user already present in `Users` at that moment is not treated as a new referral.
- After the app's rules/consent dialogs are closed, the backend claims the pending referral only once. The visitor receives the configured gift (0–50 crystals), and the owner receives the remainder of 60 crystals. The ledger and first-visit state prevent duplicate credits on refresh or repeated deep-link opens.
- An owner with an active warning or Telegram-ID ban cannot create or operate a referral link. Existing links are effectively disabled while the restriction is active and can become active again after the warning/ban is removed, provided the owner did not manually disable the link.
- The owner can manually disable the link, edit the optional share text, and set the visitor's gift amount.

## 4. CORS and security notes

The browser calls the Web App using JSONP (`<script src=...>`) rather than cross-origin `fetch`, avoiding the Apps Script redirect/CORS failure mode. The backend accepts only a valid Telegram Mini App `initData` signature verified with `TELEGRAM_BOT_TOKEN`; it never trusts the Telegram ID supplied by the browser.

The backend reads the current public `admin2.js` restriction arrays from the BuyAd repository (cached for only five seconds). This is used to enforce active warnings and Telegram-ID/permanent bans server-side. The front-end also applies the app's existing runtime ban checks.

Do not deploy the Web App with the bot token embedded in source. Keep `TELEGRAM_BOT_TOKEN` in Script Properties only. If the bot is transferred or its token is rotated, update the Script Property and redeploy if needed.
