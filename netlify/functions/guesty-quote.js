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

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: CORS_HEADERS, body: "Method not allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "Invalid JSON body" }),
    };
  }

  const { listingId, checkIn, checkOut, guestsCount = 2 } = body;

  if (!listingId || !checkIn || !checkOut) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "listingId, checkIn et checkOut sont requis (YYYY-MM-DD)" }),
    };
  }

  try {
    const token = await getBEToken();

    const res = await fetch("https://booking.guesty.com/api/reservations/quotes", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json; charset=utf-8",
      },
      body: JSON.stringify({
        checkInDateLocalized: checkIn,
        checkOutDateLocalized: checkOut,
        listingId,
        guestsCount,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Guesty quote error:", res.status, text);
      return {
        statusCode: res.status,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: `Guesty quote error: ${res.status}`, detail: text }),
      };
    }

    const data = await res.json();

    // Structure réelle : rates.ratePlans[0].ratePlan
    const ratePlans = data.rates?.ratePlans || [];
    const defaultPlan = ratePlans[0]?.ratePlan || null;

    const summary = {
      quoteId: data._id,
      expiresAt: data.expiresAt,
      listingId,
      checkIn,
      checkOut,
      guestsCount,
      ratePlans: ratePlans.map((plan) => {
        const rp = plan.ratePlan || plan;
        return {
          id: rp._id,
          name: rp.name,
          type: rp.type,
          cancellationPolicy: rp.cancellationPolicy,
          money: {
            fareAccommodation: rp.money?.fareAccommodation,
            fareCleaning: rp.money?.fareCleaning,
            totalFees: rp.money?.totalFees,
            totalTaxes: rp.money?.totalTaxes,
            subTotalPrice: rp.money?.subTotalPrice,
            hostPayout: rp.money?.hostPayout,
            currency: rp.money?.currency || "CAD",
            invoiceItems: rp.money?.invoiceItems || [],
          },
          priceAdjustment: rp.priceAdjustment || null,
        };
      }),
      recommended: defaultPlan
        ? {
            ratePlanId: defaultPlan._id,
            total: defaultPlan.money?.hostPayout,
            currency: defaultPlan.money?.currency || "CAD",
          }
        : null,
    };

    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify(summary),
    };
  } catch (err) {
    console.error("Quote function error:", err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
