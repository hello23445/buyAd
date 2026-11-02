export async function verifyTelegramInitData(initData: string, botToken: string): Promise<Record<string, string>> {
  if (!initData || !botToken) throw new Error("Missing Telegram authentication data");

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) throw new Error("Missing Telegram signature");

  params.delete("hash");
  const entries = [...params.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const dataCheckString = entries.map(([key, value]) => `${key}=${value}`).join("\n");

  const encoder = new TextEncoder();

  // Telegram Web Apps: secret_key = HMAC-SHA256(key="WebAppData", message=bot_token).
  const webAppDataKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const secretKey = await crypto.subtle.sign("HMAC", webAppDataKey, encoder.encode(botToken));

  const validationKey = await crypto.subtle.importKey(
    "raw",
    secretKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = new Uint8Array(
    await crypto.subtle.sign("HMAC", validationKey, encoder.encode(dataCheckString))
  );
  const calculatedHash = [...signature]
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");

  if (calculatedHash.length !== receivedHash.length) {
    throw new Error("Invalid Telegram signature");
  }
  let mismatch = 0;
  for (let i = 0; i < calculatedHash.length; i++) {
    mismatch |= calculatedHash.charCodeAt(i) ^ receivedHash.charCodeAt(i);
  }
  if (mismatch !== 0) throw new Error("Invalid Telegram signature");

  const authDate = Number(params.get("auth_date") || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || authDate > now + 30 || now - authDate > 86400) {
    throw new Error("Expired Telegram session");
  }

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("Missing Telegram user");
  const user = JSON.parse(userRaw);
  if (!user?.id) throw new Error("Invalid Telegram user");

  return { telegramId: String(user.id) };
}
