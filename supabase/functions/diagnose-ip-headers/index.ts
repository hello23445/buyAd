import { createClient } from "npm:@supabase/supabase-js@2";
import ipaddr from "npm:ipaddr.js@2.2.0";
import { verifyTelegramInitData } from "../_shared/telegram.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function isIp(value: string): boolean {
  try {
    ipaddr.parse(value.trim());
    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { telegramId } = await verifyTelegramInitData(
      String(body.initData || ""),
      Deno.env.get("TELEGRAM_BOT_TOKEN") || ""
    );

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: admin, error: adminError } = await supabase
      .from("ip_history_admins")
      .select("telegram_id")
      .eq("telegram_id", telegramId)
      .eq("active", true)
      .maybeSingle();

    if (adminError) throw adminError;
    if (!admin) {
      return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    }

    // Inspect metadata only. Never return or log IP header values.
    const cf = (req.headers.get("cf-connecting-ip") || "").trim();
    const real = (req.headers.get("x-real-ip") || "").trim();
    const forwarded = (req.headers.get("x-forwarded-for") || "")
      .split(",").map((value) => value.trim()).filter(Boolean);
    const first = forwarded[0] || "";
    const last = forwarded.at(-1) || "";

    const result = {
      authorized: true,
      headers: {
        cfConnectingIpPresent: Boolean(cf),
        cfConnectingIpIsValidIp: Boolean(cf) && isIp(cf),
        xRealIpPresent: Boolean(real),
        xRealIpIsValidIp: Boolean(real) && isIp(real),
        xForwardedForPresent: forwarded.length > 0,
        xForwardedForEntryCount: forwarded.length,
        xForwardedForFirstIsValidIp: Boolean(first) && isIp(first),
        xForwardedForLastIsValidIp: Boolean(last) && isIp(last),
        cfEqualsXForwardedForFirst: Boolean(cf && first) && cf === first,
        cfEqualsXForwardedForLast: Boolean(cf && last) && cf === last,
        cfEqualsXRealIp: Boolean(cf && real) && cf === real,
      },
      note: "Only header presence, format and equality are reported. No IP values are returned or stored. This does not prove a proxy header is trustworthy.",
    };

    await supabase.from("ip_history_admin_audit").insert({
      admin_telegram_id: telegramId,
      action: "diagnose_ip_headers",
    });

    return Response.json(result, { headers: corsHeaders });
  } catch (error) {
    console.error("diagnose-ip-headers:", error);
    return Response.json({ error: "Diagnostic failed" }, { status: 401, headers: corsHeaders });
  }
});
