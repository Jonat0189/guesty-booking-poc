const { getStore } = require("@netlify/blobs");

const TOKEN_KEY = "guesty_be_token";

async function getBEToken() {
  const store = getStore("guesty-tokens");
  const now = Date.now();

  // Essaie de récupérer le token depuis Netlify Blobs
  try {
    const cached = await store.get(TOKEN_KEY, { type: "json" });
    if (cached && cached.token && cached.expiresAt && now < cached.expiresAt - 5 * 60 * 1000) {
      console.log("Using cached BE token");
      return cached.token;
    }
  } catch (err) {
    console.log("No cached token found, fetching new one");
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

  // Sauvegarde dans Netlify Blobs
  try {
    await store.setJSON(TOKEN_KEY, { token, expiresAt });
    console.log("BE token cached in Netlify Blobs");
  } catch (err) {
    console.error("Failed to cache token:", err.message);
  }

  return token;
}

module.exports = { getBEToken };
