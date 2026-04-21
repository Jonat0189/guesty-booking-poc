const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Invalid JSON" }) };
  }

  const { code } = body;
  if (!code) {
    return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: "Code requis" }) };
  }

  const apiKey = process.env.GIFTUP_API_KEY;
  const accountId = process.env.GIFTUP_ACCOUNT_ID;

  if (!apiKey || !accountId) {
    return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: "GiftUp non configuré" }) };
  }

  try {
    const res = await fetch(`https://api.giftup.app/gift-cards/${code}?companyId=${accountId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Code invalide ou introuvable." }),
      };
    }

    if (data.remainingValue <= 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Cette carte cadeau a un solde de 0 $." }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        code: data.code || code,
        balance: data.remainingValue,
        currency: "CAD",
        isValid: true,
        recipientName: data.recipientName || null,
      }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
