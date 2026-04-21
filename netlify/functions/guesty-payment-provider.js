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

  const { listingId } = event.queryStringParameters || {};

  if (!listingId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "listingId requis" }),
    };
  }

  try {
    const token = await getBEToken();

    const res = await fetch(`https://booking.guesty.com/api/listings/${listingId}/payment-provider`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json; charset=utf-8",
      },
    });

    const data = await res.json();

    return {
      statusCode: res.status,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
