# BuyAd: Supabase IP history setup

This feature uses Telegram Mini App signed initData for identity. It does not use Supabase Auth.
The browser never receives the Supabase service-role key or the IP hashing secret.

## 1. Create the Supabase project
Copy the project URL and public anon key. Put them in `supabase-config.js` (the anon key is public; never put service-role credentials there).

## 2. Apply the migration
Run `supabase/migrations/202611020001_ip_history.sql` in the Supabase SQL Editor.

## 3. Configure Edge Function secrets
Set these secrets in Supabase:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `TELEGRAM_BOT_TOKEN` (server-side only; use the bot token belonging to this Mini App)
- `IP_HASH_SECRET` (random secret of at least 32 characters; keep it stable or historical lookups will stop matching)

Deploy:
- `supabase/functions/record-ip-history`
- `supabase/functions/search-users-by-ip`

The record function reads the client address from the trusted ingress `x-forwarded-for` / `x-real-ip` headers. Verify in the deployed Supabase project that the ingress proxy overwrites/appends this header as expected before enabling collection. Never accept an IP address supplied in the JSON body.

## 4. Allowlist administrators
Insert only the Telegram IDs of administrators who are permitted to search:
```sql
insert into public.ip_history_admins (telegram_id) values ('YOUR_TELEGRAM_ID');
```
The Edge Function checks this table on every search. Hiding the UI button is not an authorization control.

## 5. Configure the website
Set the project URL and anon key in `supabase-config.js`. Enable collection only after the site's privacy notice explains what is collected, why, who can search it, and the 30-day retention period.

## 6. Retention
Delete expired events daily:
```sql
delete from public.user_ip_history where expires_at <= now();
```
Schedule this with Supabase Cron or another trusted scheduler.

## Data model
Only a keyed HMAC fingerprint of the IP is stored, alongside the Telegram account ID and timestamps. The original IP is not stored in Supabase. Matching IPs are not proof that accounts belong to the same person.
