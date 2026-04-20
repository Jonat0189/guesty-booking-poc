const fs = require("fs");
const path = require("path");

const TOKEN_FILE = path.join("/tmp", "guesty_be_token.json");

async function getBEToken() {
  const now = Date.now();

  // Essaie de lire le token depuis /tmp
  try {
    const raw = fs.readFileSync(TOKEN_FILE, "utf8");
    const cached = JSON.parse(raw);
    if (cached && cached.token && cached.expiresAt && now < cached.expiresAt - 5 * 60 * 1000) {
      console.log("Using cached BE token from /tmp");
      return cached.token;
    }
  } catch (err) {
    console.log("No valid cached token, fetching new one");
  }

  // Fetch nouveau token
  const clientId = process.env.GUESTY_BE_CLIENT_ID;
  const clientSecret = process.env.GUESTY_BE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing GUESTY_BE_CLIENT_ID or GUESTY_BE_CLIENT_SECRET env vars");
  }

  const params = new URLSearchParams();
  params.append("grant_type", "client_credentials");
  params.append("scope", "booking_engine:api");
  params.append("client_id", clientId);
  params.append("client_secret", clientSecret);

  const res = await fetch("https://booking.guesty.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Guesty BE auth failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  const token = data.access_token;
  const expiresAt = now + (data.expires_in || 86400) * 1000;

  // Sauvegarde dans /tmp
  try {
    fs.writeFileSync(TOKEN_FILE, JSON.stringify({ token, expiresAt }), "utf8");
    console.log("BE token cached in /tmp");
  } catch (err) {
    console.error("Failed to cache token:", err.message);
  }

  return token;
}

module.exports = { getBEToken };
