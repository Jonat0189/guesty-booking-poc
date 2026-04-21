const { getBEToken } = require("./guesty-be-token");

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

  const { quoteId, ratePlanId, ccToken, guest } = body;

  if (!quoteId || !ratePlanId || !guest?.firstName || !guest?.email) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "quoteId, ratePlanId, ccToken et guest sont requis" }),
    };
  }

  try {
    const token = await getBEToken();

    // Crée une inquiry (réservation à confirmer manuellement)
    // La carte est enregistrée mais pas chargée
    const payload = {
      ratePlanId,
      guest: {
        firstName: guest.firstName,
        lastName: guest.lastName,
        email: guest.email,
        phone: guest.phone || "",
      },
      policy: { accepted: true },
    };

    // Ajoute le token carte si fourni
    if (ccToken) payload.ccToken = ccToken;

    const res = await fetch(`https://booking.guesty.com/api/reservations/quotes/${quoteId}/inquiry`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Reservation error:", res.status, JSON.stringify(data));
      return {
        statusCode: res.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: data.error?.message || "Erreur lors de la création de la réservation." }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmationCode: data.confirmationCode,
        status: data.status,
        reservationId: data._id,
      }),
    };
  } catch (err) {
    console.error("Reservation function error:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
