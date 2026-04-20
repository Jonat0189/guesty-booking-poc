// Shared token cache (persiste en mémoire entre les invocations tièdes)
let cachedToken = null;
let tokenExpiresAt = null;

async function getBEToken() {
  const now = Date.now();

  // Réutilise le token s'il est encore valide (avec 5min de marge)
  if (cachedToken && tokenExpiresAt && now < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken;
  }

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

  cachedToken = data.access_token;
  // Token valide 24h selon la doc Guesty
  tokenExpiresAt = now + (data.expires_in || 86400) * 1000;

  return cachedToken;
}

module.exports = { getBEToken };
