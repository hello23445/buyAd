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
    const { telegramId } = await verifyTelegramInitData(String(body.initData || ""), Deno.env.get("TELEGRAM_BOT_TOKEN") || "");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: admin, error: adminError } = await supabase.from("ip_history_admins")
      .select("telegram_id").eq("telegram_id", telegramId).eq("active", true).maybeSingle();
    if (adminError) throw adminError;
    if (!admin) return Response.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });

    const rawIp = String(body.ip || "").trim();
    let normalizedIps: string[];
    try {
      const parsed = ipaddr.parse(rawIp);
      // Treat IPv4-mapped IPv6 addresses as the same address as their IPv4 form.
      const canonical = parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()
        ? parsed.toIPv4Address().toString()
        : parsed.kind() === "ipv6" ? parsed.toNormalizedString().toLowerCase() : parsed.toString();
      normalizedIps = [canonical];
      if (parsed.kind() === "ipv4") {
        normalizedIps.push(ipaddr.IPv4.parse(parsed.toString()).toIPv4MappedAddress().toNormalizedString().toLowerCase());
      } else if (parsed.kind() === "ipv6" && parsed.isIPv4MappedAddress()) {
        normalizedIps.push(parsed.toNormalizedString().toLowerCase());
      }
    } catch {
      return Response.json({ error: "Enter a valid IPv4 or IPv6 address" }, { status: 400, headers: corsHeaders });
    }

    const secret = Deno.env.get("IP_HASH_SECRET") || "";
    if (secret.length < 32) throw new Error("IP_HASH_SECRET must contain at least 32 characters");
    const fingerprints = await Promise.all([...new Set(normalizedIps)].map(value => fingerprint(value, secret)));

    const { data: rows, error } = await supabase.from("user_ip_history")
      .select("telegram_id, observed_at").in("ip_fingerprint", fingerprints)
      .gt("expires_at", new Date().toISOString()).order("observed_at", { ascending: false }).limit(5000);
    if (error) throw error;

    const grouped = new Map<string, { telegramId: string; firstSeen: string; lastSeen: string; events: number }>();
    for (const row of rows || []) {
      const current = grouped.get(row.telegram_id);
      if (!current) grouped.set(row.telegram_id, {
        telegramId: row.telegram_id, firstSeen: row.observed_at, lastSeen: row.observed_at, events: 1
      });
      else {
        current.events++;
        if (row.observed_at < current.firstSeen) current.firstSeen = row.observed_at;
        if (row.observed_at > current.lastSeen) current.lastSeen = row.observed_at;
      }
    }

    await supabase.from("ip_history_admin_audit").insert({ admin_telegram_id: telegramId, action: "search_ip_history" });
    return Response.json({ results: [...grouped.values()] }, { headers: corsHeaders });
  } catch (error) {
    console.error("search-users-by-ip:", error);
    return Response.json({ error: "Search failed" }, { status: 401, headers: corsHeaders });
  }
});
