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

    // Booking Engine API - liste filtrée par listingId avec nightlyRates et allotment
    const fields = "_id nickname title nightlyRates allotment";
    const url = `https://booking.guesty.com/api/listings?checkIn=${startDate}&checkOut=${endDate}&fields=${encodeURIComponent(fields)}&limit=100`;

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

    // La réponse est { results: [...] } - on cherche notre listing
    const listing = (data.results || []).find(l => l._id === listingId) || data.results?.[0] || {};

    // nightlyRates = { "2025-06-01": 250, ... }
    // allotment    = { "2025-06-01": 1, ... }
    const nightlyRates = listing.nightlyRates || {};
    const allotment = listing.allotment || {};

    // Génère un tableau de jours entre startDate et endDate
    const days = [];
    const current = new Date(startDate);
    const end = new Date(endDate);

    while (current < end) {
      const dateStr = current.toISOString().split("T")[0];
      const price = nightlyRates[dateStr] ?? null;
      const avail = allotment[dateStr];
      const available = typeof avail === "number" ? avail > 0 : price !== null;

      days.push({
        date: dateStr,
        available,
        price,
        currency: "CAD",
      });

      current.setDate(current.getDate() + 1);
    }

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, startDate, endDate, days }),
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
