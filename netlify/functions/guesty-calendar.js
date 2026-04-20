const { getBEToken } = require("./guesty-be-token");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return { statusCode: 405, headers: CORS_HEADERS, body: "Method not allowed" };
  }

  const { listingId, startDate, endDate } = event.queryStringParameters || {};

  if (!listingId || !startDate || !endDate) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "listingId, startDate et endDate sont requis (YYYY-MM-DD)" }),
    };
  }

  try {
    const token = await getBEToken();

    // Endpoint calendrier dédié par listing
    const url = `https://booking.guesty.com/api/listings/${listingId}/calendar?from=${startDate}&to=${endDate}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Guesty calendar error:", res.status, text);
      return {
        statusCode: res.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: `Guesty API error: ${res.status}`, detail: text }),
      };
    }

    const data = await res.json();

    // Transforme la réponse brute en tableau de jours normalisés
    const days = (data.days || data.data || []).map((day) => {
      const available = !day.blocks && day.status !== "unavailable" && day.status !== "booked";
      return {
        date: day.date,
        available,
        price: day.price || day.basePrice || null,
        currency: "CAD",
        status: day.status || null,
        minNights: day.minNights || null,
      };
    });

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, startDate, endDate, days, _raw: data }),
    };
  } catch (err) {
    console.error("Calendar function error:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
