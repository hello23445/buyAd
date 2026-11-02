import { createClient } from "npm:@supabase/supabase-js@2";
import ipaddr from "npm:ipaddr.js@2.2.0";
import { verifyTelegramInitData } from "../_shared/telegram.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function fingerprint(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405, headers: corsHeaders });

  try {
    const body = await req.json();
    if (body.consentVersion !== "2026-11-02") {
      return Response.json({ error: "Privacy notice consent is required" }, { status: 403, headers: corsHeaders });
    }
    const { telegramId } = await verifyTelegramInitData(String(body.initData || ""), Deno.env.get("TELEGRAM_BOT_TOKEN") || "");

    // Use the address appended by Supabase's trusted ingress proxy, not a client-supplied body field.
    const forwarded = req.headers.get("x-forwarded-for") || "";
    const rawIp = forwarded.split(",").map(v => v.trim()).filter(Boolean).at(-1)
      || req.headers.get("x-real-ip") || "";
    if (!rawIp) return Response.json({ error: "Client IP is unavailable at the edge" }, { status: 503, headers: corsHeaders });

    let normalizedIp: string;
    try {
      const parsed = ipaddr.parse(rawIp);
      normalizedIp = parsed.kind() === "ipv6" ? parsed.toNormalizedString().toLowerCase() : parsed.toString();
    } catch {
      return Response.json({ error: "Invalid client IP" }, { status: 400, headers: corsHeaders });
    }

    const secret = Deno.env.get("IP_HASH_SECRET") || "";
    if (secret.length < 32) throw new Error("IP_HASH_SECRET must contain at least 32 characters");
    const ipFingerprint = await fingerprint(normalizedIp, secret);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Keep one event per account/IP per 5-minute window to avoid noisy writes.
    const since = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { data: recent, error: readError } = await supabase.from("user_ip_history")
      .select("id").eq("telegram_id", telegramId).eq("ip_fingerprint", ipFingerprint)
      .gte("observed_at", since).limit(1);
    if (readError) throw readError;

    if (!recent?.length) {
      const { error } = await supabase.from("user_ip_history").insert({
        telegram_id: telegramId,
        ip_fingerprint: ipFingerprint,
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        consent_version: String(body.consentVersion),
        consented_at: new Date().toISOString()
      });
      if (error) throw error;
    }

    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("record-ip-history:", error);
    return Response.json({ error: "Unable to record IP history" }, { status: 401, headers: corsHeaders });
  }
});
