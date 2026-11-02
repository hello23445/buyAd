// Public website configuration. The anon key is designed to be public.
// NEVER place SUPABASE_SERVICE_ROLE_KEY, TELEGRAM_BOT_TOKEN or IP_HASH_SECRET here.
window.BUYAD_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT_REF.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY",
  enabled: false // Set true only after deployment, admin allowlisting and privacy notice review.
};
