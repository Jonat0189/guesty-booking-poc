# Guesty Booking Engine API — Référence complète

Document de référence pour le projet BESIDE. À charger au début de chaque session pour éviter le trial and error.

---

## 1. Informations de base

- **Base URL** : `https://booking.guesty.com/api/`
- **Format** : JSON, `Content-Type: application/json`
- **Auth** : OAuth2 Bearer token
- **Token endpoint** : `https://booking.guesty.com/oauth2/token`
- **Scope** : `booking_engine:api`

> ⚠️ La Booking Engine API est **entièrement séparée** de l'Open API (`open-api.guesty.com`). Tokens différents, credentials différents, endpoints différents.

---

## 2. Authentification

### Obtenir un token
```
POST https://booking.guesty.com/oauth2/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials
scope=booking_engine:api
client_id=YOUR_CLIENT_ID
client_secret=YOUR_CLIENT_SECRET
```

### Réponse
```json
{
  "token_type": "Bearer",
  "expires_in": 86400,
  "access_token": "...",
  "scope": "booking_engine:api"
}
```

### Règles critiques
- Token valide **24 heures**
- **Maximum 3 renouvellements par 24h** — dépasser cette limite = 429 bloquant
- **Cacher le token** dans Netlify Blobs et le réutiliser
- Ne jamais fetcher un nouveau token à chaque appel API

### Notre implémentation
- `guesty-be-token.js` gère le cache dans Netlify Blobs (store `guesty-tokens`, clé `guesty_be_token`)
- Nécessite `NETLIFY_SITE_ID` et `NETLIFY_TOKEN` dans les variables d'environnement
- Le token est partagé entre `guesty-calendar.js` et `guesty-quote.js`

---

## 3. Rate limits (endpoints API)

| Requêtes max | Période |
|---|---|
| 5 | 1 seconde |
| 275 | 1 minute |
| 16 500 | 1 heure |
| Max 15 concurrent | — |

Réponse en cas de dépassement : `HTTP 429` avec header `Retry-After` (secondes à attendre).

---

## 4. Activation requise avant de créer des réservations

Avant d'utiliser les endpoints de réservation :
1. Créer une réservation manuelle dans l'UI Guesty (active la source "Manual")
2. Créer une première réservation via la BE API (active la source "BE API")

Sans ça, les quotes retournent `invoiceItems: []` et les prix sont vides.

**✅ BESIDE : source BE API activée le 2026-04-21 via inquiry GY-CD5JvKkM (annulée)**

---

## 5. Endpoints — Listings

### 5.1 Tous les listings
```
GET /listings
```
Paramètres optionnels : `checkIn`, `checkOut`, `minOccupancy`, `numberOfBedrooms`, `fields`, `limit` (max 100), `cursor`

Pour obtenir le **prix total** d'un séjour :
```
GET /listings?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&fields=_id totalPrice title
```
- `totalPrice` = prix complet incluant ménage, taxes, frais
- Guesty appelle internalement un quote pour calculer ce prix
- **Limite : 50 résultats max** avec `totalPrice`, **pas de pagination**

### 5.2 Listing spécifique
```
GET /listings/{listingId}
```
Retourne toutes les infos du listing. Pas de paramètres de dates.

> ⚠️ Les paramètres `checkIn`/`checkOut` ne sont **PAS acceptés** sur cet endpoint — erreur 400.

### 5.3 Calendrier de disponibilité
```
GET /listings/{listingId}/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD
```
Paramètres **obligatoires** : `from` et `to` (pas `startDate`/`endDate` !)

Réponse : **tableau direct** (pas d'objet wrapper) :
```json
[
  {
    "date": "2026-05-03",
    "status": "available",
    "minNights": 2,
    "maxNights": 45,
    "cta": false,
    "ctd": false,
    "blocks": {
      "m": false,   // manual block
      "r": false,   // reservation
      "b": false,   // blocked
      "o": false,   // owner block
      "an": false   // advance notice
    },
    "allotment": 0
  }
]
```

**Logique de disponibilité** :
- `status === "available"` → disponible
- `status === "unavailable"` → non disponible
- `cta: true` = check-in not allowed ce jour (Close To Arrival)
- `ctd: true` = check-out not allowed ce jour (Close To Departure)
- `blocks.m: true` = bloqué manuellement
- `blocks.o: true` = bloqué par le propriétaire
- `blocks.an: true` = advance notice (délai minimum avant check-in)

> ⚠️ La réponse est un **tableau direct**, pas `{ days: [...] }`. Parser avec `Array.isArray(data) ? data : []`

### 5.4 Payment provider d'un listing
```
GET /listings/{listingId}/payment-provider
```
Retourne le compte Stripe associé à ce listing. Nécessaire pour tokeniser la carte du bon compte Stripe.

### 5.5 Liste des villes
```
GET /listings/cities
```

---

## 6. Endpoints — Reservation Quote

Le quote est le mécanisme central : il calcule le prix final et verrouille les dates pendant 24h.

### 6.1 Créer un quote
```
POST /reservations/quotes
Content-Type: application/json

{
  "checkInDateLocalized": "YYYY-MM-DD",
  "checkOutDateLocalized": "YYYY-MM-DD",
  "listingId": "...",
  "guestsCount": 2,
  "coupons": "CODE1,CODE2"   // optionnel
}
```

### Structure réelle de la réponse (validée en production)

> ⚠️ La structure réelle est différente de la doc officielle. Le money se trouve dans `rates.ratePlans[0].ratePlan.money`, pas `rates.ratePlans[0].money`.

```json
{
  "_id": "quoteId",
  "expiresAt": "2026-04-22T01:27:41.153Z",
  "rates": {
    "ratePlans": [
      {
        "ratePlan": {
          "_id": "default-rateplan-id",
          "name": "Standard",
          "type": "default",
          "cancellationPolicy": null,
          "priceAdjustment": { "type": "flat", "direction": "decrease", "amount": 0 },
          "money": {
            "_id": "...",
            "currency": "CAD",
            "fareAccommodation": 624,
            "fareAccommodationAdjusted": 624,
            "fareCleaning": 197,
            "totalFees": 197,
            "subTotalPrice": 821,
            "hostPayout": 943.94,
            "hostPayoutUsd": 691.82,
            "totalTaxes": 122.94,
            "invoiceItems": [
              { "title": "Accommodation fare", "amount": 624, "currency": "CAD", "type": "ACCOMMODATION_FARE", "normalType": "AF" },
              { "title": "Cleaning fee", "amount": 197, "currency": "CAD", "type": "CLEANING_FEE", "normalType": "CF" },
              { "title": "TPS", "amount": 41.05, "currency": "CAD", "type": "TAX", "normalType": "GST" },
              { "title": "TVQ", "amount": 81.89, "currency": "CAD", "type": "TAX", "normalType": "LT" }
            ]
          }
        },
        "inquiryId": "...",
        "days": [
          { "date": "2026-11-10", "price": 312, "basePrice": 195, "manualPrice": 312, ... }
        ]
      }
    ]
  }
}
```

**Accès correct au ratePlanId** : `data.rates.ratePlans[0].ratePlan._id`
**Accès correct au money** : `data.rates.ratePlans[0].ratePlan.money`

### 6.2 Récupérer un quote existant
```
GET /reservations/quotes/{quoteId}
```
Utile pour récupérer le prix pour un visiteur qui revient.

### 6.3 Ajouter/retirer un coupon
```
POST /reservations/quotes/{quoteId}/coupons
Content-Type: application/json

{
  "ratePlanId": "...",
  "coupons": ["CODE1"]
}
```

### 6.4 Créer une réservation instant (paiement immédiat)
```
POST /reservations/quotes/{quoteId}/instant
Content-Type: application/json

{
  "ratePlanId": "default-rateplan-id",
  "ccToken": "pm_...",
  "guest": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+15141234567"
  },
  "policy": { "accepted": true }
}
```

> ⚠️ Seulement les tokens Stripe **SCA** (commençant par `pm_`) sont acceptés. Les anciens tokens `tok_...` sont rejetés.

### 6.5 Créer une inquiry (sans paiement immédiat)
```
POST /reservations/quotes/{quoteId}/inquiry
Content-Type: application/json

{
  "ratePlanId": "default-rateplan-id",
  "guest": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+15141234567"
  },
  "policy": { "accepted": true }
}
```
Crée une réservation avec `status: "reserved"` (à confirmer manuellement dans Guesty).

### 6.6 Instant avec charge Stripe (flow alternatif)
```
POST /reservations/quotes/{quoteId}/instant-charge
```
Stripe charge + réservation en une seule étape. Nécessite vérification 3DS après.

### 6.7 Vérifier le paiement après 3DS
```
POST /reservations/quotes/{quoteId}/verify-charge
```

### 6.8 Récupérer une réservation créée via quote
```
GET /reservations/quotes/{quoteId}/reservation
```

---

## 7. Endpoints — Payouts

### Calendrier de paiement
```
GET /reservations/payouts/list?listingId=...&checkIn=...&checkOut=...&total=...&bookingType=INSTANT
```
Retourne le calendrier des paiements automatiques configurés sur la propriété.

---

## 8. Flow complet recommandé

```
1. GET /listings/{id}/calendar?from=...&to=...
   → Afficher les dates disponibles dans l'UI
   → Réponse : tableau direct de jours avec status, cta, ctd, minNights

2. POST /reservations/quotes
   → Créer un quote pour les dates sélectionnées
   → Retourne le price breakdown complet (accommodation, ménage, taxes, total)
   → ratePlanId se trouve dans rates.ratePlans[0].ratePlan._id

3. GET /listings/{id}/payment-provider
   → Obtenir le compte Stripe du listing

4. [Côté client] Stripe.js createPaymentMethod(...)
   → Tokeniser la carte → obtenir pm_...

5. POST /reservations/quotes/{quoteId}/instant
   → Créer la réservation confirmée avec le token Stripe et le ratePlanId
```

---

## 9. Prix manquants dans le quote — Diagnostic

Si `invoiceItems` est `[]` dans la réponse du quote :

**Cause** : La source "BE API" n'est pas activée dans Guesty.

**Solution** :
1. Créer une réservation manuelle dans l'UI Guesty (active "Manual")
2. Créer une inquiry via `POST /reservations/quotes/{quoteId}/inquiry` (active "BE API")
3. Annuler l'inquiry test dans Guesty UI

**✅ BESIDE : déjà activé** — ne pas refaire.

---

## 10. Quirks et pièges connus

| Problème | Cause | Solution |
|---|---|---|
| 400 sur `/listings/{id}` avec dates | `checkIn`/`checkOut` pas acceptés sur endpoint individuel | Utiliser `/listings/{id}/calendar` pour les dates |
| 400 sur `/calendar` avec `startDate`/`endDate` | Paramètres incorrects | Utiliser `from` et `to` |
| Calendar retourne tableau vide | Mauvais endpoint | Utiliser `/listings/{id}/calendar?from=...&to=...` |
| Quote avec `invoiceItems: []` | Source BE API non activée | Voir section 9 |
| `ratePlanId` introuvable | Mauvais chemin dans la réponse | Utiliser `rates.ratePlans[0].ratePlan._id` (pas `ratePlans[0]._id`) |
| 401 invalid_client | Secret invalide ou expiré | Régénérer les credentials dans Guesty |
| 429 sur auth | Limite de 3 renouvellements dépassée | Token caché dans Netlify Blobs — ne pas régénérer manuellement |
| 429 sur API | Rate limit dépassé | Implémenter retry avec `Retry-After` header |
| Token `tok_...` rejeté | Ancien format Stripe non supporté | Utiliser Stripe SCA → `pm_...` |
| Netlify Blobs "not configured" | Variables manquantes | Ajouter `NETLIFY_SITE_ID` et `NETLIFY_TOKEN` dans Netlify env vars |

---

## 11. Variables d'environnement du projet

```
GUESTY_BE_CLIENT_ID      → Client ID de l'instance Booking Engine API
GUESTY_BE_CLIENT_SECRET  → Secret de l'instance Booking Engine API
NETLIFY_SITE_ID          → Site ID Netlify (pour Netlify Blobs)
NETLIFY_TOKEN            → Access token Netlify (pour Netlify Blobs)
```

---

## 12. Listings BESIDE connus

| Destination | Listing | ID |
|---|---|---|
| Habitat Lanaudière — Le Pionnier | (POC actif) | `65ef494bff172e00129d081f` |

---

## 13. Liens utiles

- Doc BE API : https://booking-api-docs.guesty.com/
- Référence endpoints : https://booking-api-docs.guesty.com/reference
- Support BE API : booking-engine-support@guesty.com
- Activation instance : https://help.guesty.com/hc/en-gb/articles/18132541671069
