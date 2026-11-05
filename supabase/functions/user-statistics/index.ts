import { verifyTelegramInitData } from "../_shared/telegram.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await request.json();
    const auth = await verifyTelegramInitData(String(body.initData || ""), Deno.env.get("TELEGRAM_BOT_TOKEN") || "");
    const admins = JSON.parse(Deno.env.get("ADMIN_TELEGRAM_LEVELS") || "{}");
    if (Number(admins[auth.telegramId] || 0) < 2) {
      return Response.json({ error: "Доступ запрещён" }, { status: 403, headers: cors });
    }
    return Response.json({ found: false, message: "Хранилище ожидает настройки" }, { headers: cors });
  } catch {
    return Response.json({ error: "Не удалось подтвердить доступ" }, { status: 401, headers: cors });
  }
});
