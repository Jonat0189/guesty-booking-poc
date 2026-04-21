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

  const { quoteId } = JSON.parse(event.body || "{}");

  if (!quoteId) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "quoteId requis" }),
    };
  }

  try {
    const token = await getBEToken();

    const res = await fetch(`https://booking.guesty.com/api/reservations/quotes/${quoteId}/inquiry`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        guest: {
          firstName: "Test",
          lastName: "BESIDE",
          email: "jonathan@beside.earth",
          phone: "+15141234567",
        },
        policy: { accepted: true },
      }),
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
