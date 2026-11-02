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

  let stage = "request";
  try {
    const body = await req.json();
    stage = "telegram_auth";
    const { telegramId } = await verifyTelegramInitData(
      String(body.initData || ""),
      Deno.env.get("TELEGRAM_BOT_TOKEN") || ""
    );

    stage = "supabase_config";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return Response.json({ error: "server_configuration_missing" }, { status: 500, headers: corsHeaders });
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    stage = "admin_allowlist";

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

    stage = "audit";
    const { error: auditError } = await supabase.from("ip_history_admin_audit").insert({
      admin_telegram_id: telegramId,
      action: "diagnose_ip_headers",
    });
    if (auditError) {
      console.error("diagnose-ip-headers audit insert failed:", auditError.code || "unknown");
      return Response.json({ error: "audit_write_failed" }, { status: 500, headers: corsHeaders });
    }

    return Response.json(result, { headers: corsHeaders });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    console.error("diagnose-ip-headers failed at", stage, error instanceof Error ? error.name : "unknown");
    const safeCode = stage === "telegram_auth"
      ? (message.includes("Expired") ? "telegram_session_expired" :
         message.includes("signature") ? "telegram_signature_invalid" :
         message.includes("Missing") ? "telegram_auth_data_missing" : "telegram_auth_failed")
      : stage === "admin_allowlist" ? "admin_allowlist_unavailable"
      : "diagnostic_internal_error";
    const status = stage === "telegram_auth" ? 401 : stage === "admin_allowlist" ? 503 : 500;
    return Response.json({ error: safeCode }, { status, headers: corsHeaders });
  }
});
