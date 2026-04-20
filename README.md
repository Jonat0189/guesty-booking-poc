# Guesty Booking Engine POC — BESIDE

Proof of concept pour le moteur de réservation custom BESIDE.
Teste les endpoints : authentification, calendrier/disponibilités, et création de quote.

## Structure

```
netlify/functions/
  guesty-be-token.js   # Auth OAuth2 + cache token (partagé)
  guesty-calendar.js   # GET disponibilités + prix par jour
  guesty-quote.js      # POST création de quote avec price breakdown
public/
  index.html           # Interface de test
```

## Déploiement

### 1. Créer le repo et connecter à Netlify

```bash
git init
git add .
git commit -m "Initial POC"
```

Créer un nouveau site sur netlify.com → "Import from Git"

### 2. Variables d'environnement

Dans Netlify → Site settings → Environment variables, ajouter :

| Variable | Valeur |
|---|---|
| `GUESTY_BE_CLIENT_ID` | (ton client ID Booking Engine API) |
| `GUESTY_BE_CLIENT_SECRET` | (ton client secret Booking Engine API) |

⚠️ Ne jamais committer ces valeurs dans le code.

### 3. Pour tester en local

```bash
npm install -g netlify-cli
netlify dev
```

Puis ouvrir http://localhost:8888

## Notes importantes

- La Booking Engine API a son propre token OAuth2, distinct de l'Open API
- Limite de 3 renouvellements de token par 24h → le cache en mémoire est essentiel
- Le calendrier utilise l'Open API (`open-api.guesty.com`) avec le même token BE
- Les quotes sont valides 24h et servent de protection anti-double-booking
- Pour les multi-units, la disponibilité se calcule via `allotment > 0`, pas `status`
