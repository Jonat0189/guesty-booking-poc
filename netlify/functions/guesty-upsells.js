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

  const { quoteId, inquiryId } = event.queryStringParameters || {};

  if (!quoteId && !inquiryId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "quoteId ou inquiryId requis" }),
    };
  }

  try {
    const token = await getBEToken();
    const id = inquiryId || quoteId;

    // Essaie les deux patterns d'URL possibles
    const urls = [
      `https://booking.guesty.com/api/upsell?inquiryId=${id}`,
      `https://booking.guesty.com/api/upsell?quoteId=${id}`,
      `https://booking.guesty.com/api/reservations/quotes/${id}/upsell`,
    ];

    let lastStatus = null;
    let lastData = null;

    for (const url of urls) {
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json; charset=utf-8",
        },
      });
      lastStatus = res.status;
      lastData = await res.json();
      console.log(`URL: ${url} → status: ${res.status}`);
      if (res.status !== 404) {
        return {
          statusCode: res.status,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
          body: JSON.stringify({ url, data: lastData }),
        };
      }
    }

    return {
      statusCode: 404,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Endpoint upsell introuvable", lastData }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
