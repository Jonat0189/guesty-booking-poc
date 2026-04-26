const { getBEToken } = require("./guesty-be-token");

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS_HEADERS, body: "" };
  }

  try {
    const token = await getBEToken();

    // GET — récupérer les upsells disponibles pour un quote
    if (event.httpMethod === "GET") {
      const { inquiryId, listingId } = event.queryStringParameters || {};

      if (!inquiryId || !listingId) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "inquiryId et listingId requis" }),
        };
      }

      const res = await fetch(
        `https://booking.guesty.com/api/reservations/upsell/${inquiryId}/${listingId}/fee`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/json; charset=utf-8",
          },
        }
      );

      const data = await res.json();
      console.log("GET upsells:", res.status, JSON.stringify(data).substring(0, 300));

      return {
        statusCode: res.status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      };
    }

    // POST — ajouter/retirer un upsell d'un quote
    if (event.httpMethod === "POST") {
      const body = JSON.parse(event.body || "{}");
      const { quoteId, ratePlanIds, additionalFeeIds } = body;

      if (!quoteId || !additionalFeeIds) {
        return {
          statusCode: 400,
          headers: CORS_HEADERS,
          body: JSON.stringify({ error: "quoteId et additionalFeeIds requis" }),
        };
      }

      const res = await fetch(
        `https://booking.guesty.com/api/reservations/upsell/${quoteId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Accept: "application/json; charset=utf-8",
          },
          body: JSON.stringify({ additionalFeeIds, ratePlanIds: ratePlanIds || [] }),
        }
      );

      const data = await res.json();
      console.log("POST upsell:", res.status, JSON.stringify(data).substring(0, 300));

      return {
        statusCode: res.status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        body: JSON.stringify(data),
      };
    }

    return { statusCode: 405, headers: CORS_HEADERS, body: "Method not allowed" };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
