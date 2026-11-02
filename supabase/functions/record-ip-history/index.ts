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

    // Cloudflare's ingress-provided client address matched the first X-Forwarded-For
    // entry in the header diagnostic. Do not use the last XFF hop or client-supplied body data.
    const rawIp = (req.headers.get("cf-connecting-ip") || "").trim();
    if (!rawIp) return Response.json({ error: "Trusted client IP header is unavailable at the edge" }, { status: 503, headers: corsHeaders });

    let normalizedIp: string;
    try {
      const parsed = ipaddr.parse(rawIp);
      normalizedIp = parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()
        ? parsed.toIPv4Address().toString()
        : parsed.kind() === "ipv6" ? parsed.toNormalizedString().toLowerCase() : parsed.toString();
    } catch {
      return Response.json({ error: "Invalid client IP" }, { status: 400, headers: corsHeaders });
    }

    const secret = Deno.env.get("IP_HASH_SECRET") || "";
    if (secret.length < 32) throw new Error("IP_HASH_SECRET must contain at least 32 characters");
    const ipFingerprint = await fingerprint(normalizedIp, secret);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Store a new event only for the first observed IP or when the account's IP changes.
    const { data: latest, error: readError } = await supabase.from("user_ip_history")
      .select("ip_fingerprint")
      .eq("telegram_id", telegramId)
      .order("observed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readError) throw readError;

    if (latest?.ip_fingerprint !== ipFingerprint) {
      const now = new Date().toISOString();
      const { error } = await supabase.from("user_ip_history").insert({
        telegram_id: telegramId,
        ip_fingerprint: ipFingerprint,
        expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        consent_version: String(body.consentVersion),
        consented_at: now
      });
      if (error) throw error;
    }

    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    console.error("record-ip-history:", error);
    return Response.json({ error: "Unable to record IP history" }, { status: 401, headers: corsHeaders });
  }
});
