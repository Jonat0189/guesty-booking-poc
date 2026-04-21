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

  const { quoteId, ratePlanId, couponCode } = body;

  if (!quoteId || !ratePlanId || !couponCode) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "quoteId, ratePlanId et couponCode sont requis" }),
    };
  }

  try {
    const token = await getBEToken();

    const res = await fetch(`https://booking.guesty.com/api/reservations/quotes/${quoteId}/coupons`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        ratePlanId,
        coupons: [couponCode],
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      // Guesty retourne 400 si le coupon est invalide
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Code invalide ou expiré." }),
      };
    }

    // Retourne le quote mis à jour avec le bon chemin ratePlan
    const ratePlans = data.rates?.ratePlans || [];
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteId: data._id,
        ratePlans: ratePlans.map((plan) => {
          const rp = plan.ratePlan || plan;
          return {
            id: rp._id,
            money: {
              fareAccommodation: rp.money?.fareAccommodation,
              fareAccommodationAdjusted: rp.money?.fareAccommodationAdjusted,
              fareCleaning: rp.money?.fareCleaning,
              totalFees: rp.money?.totalFees,
              totalTaxes: rp.money?.totalTaxes,
              subTotalPrice: rp.money?.subTotalPrice,
              hostPayout: rp.money?.hostPayout,
              currency: rp.money?.currency || "CAD",
              invoiceItems: rp.money?.invoiceItems || [],
            },
          };
        }),
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
