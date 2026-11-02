-- Private, pseudonymised IP history. No browser role can read or write these tables.
create table if not exists public.user_ip_history (
  id uuid primary key default gen_random_uuid(),
  telegram_id text not null,
  ip_fingerprint text not null,
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '30 days',
  consent_version text not null,
  consented_at timestamptz not null default now()
);

create index if not exists user_ip_history_fingerprint_time_idx
  on public.user_ip_history (ip_fingerprint, observed_at desc);
create index if not exists user_ip_history_expiry_idx
  on public.user_ip_history (expires_at);

create table if not exists public.ip_history_admins (
  telegram_id text primary key,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.ip_history_admin_audit (
  id uuid primary key default gen_random_uuid(),
  admin_telegram_id text not null,
  action text not null,
  created_at timestamptz not null default now()
);

alter table public.user_ip_history enable row level security;
alter table public.ip_history_admins enable row level security;
alter table public.ip_history_admin_audit enable row level security;

revoke all on public.user_ip_history from anon, authenticated;
revoke all on public.ip_history_admins from anon, authenticated;
revoke all on public.ip_history_admin_audit from anon, authenticated;

-- Edge Functions use the service-role key; never expose it in the website.
-- Add trusted admin Telegram IDs manually after deployment:
-- insert into public.ip_history_admins (telegram_id) values ('YOUR_TELEGRAM_ID');
