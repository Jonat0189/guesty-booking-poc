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

  const { listingId, checkIn, checkOut, guestsCount, couponCode } = body;

  if (!listingId || !checkIn || !checkOut || !couponCode) {
    return {
      statusCode: 400,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "listingId, checkIn, checkOut et couponCode sont requis" }),
    };
  }

  try {
    const token = await getBEToken();

    // Crée un nouveau quote avec le coupon inclus
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
        guestsCount: guestsCount || 2,
        coupons: couponCode,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Code invalide ou expiré." }),
      };
    }

    // Vérifie que le coupon a été appliqué
    const coupons = data.coupons || [];
    const appliedCoupon = coupons.find(c => c.code?.toUpperCase() === couponCode.toUpperCase());
    if (!appliedCoupon && coupons.length === 0) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: "Code invalide ou non applicable à ces dates." }),
      };
    }

    // Retourne le quote avec le bon chemin ratePlan
    const ratePlans = data.rates?.ratePlans || [];
    return {
      statusCode: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteId: data._id,
        expiresAt: data.expiresAt,
        couponApplied: appliedCoupon || coupons[0] || null,
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
