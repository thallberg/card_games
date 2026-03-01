# Felsöka registrering på Vercel

När du klickar **Registrera** på card-games-rose.vercel.app, öppna **DevTools (F12) → fliken Network**.

## 1. Anropet till `/api/config`

- Finns det en request till **`/api/config`**?
  - **Status 200:** Klicka på den och titta under **Response**. Står det `"apiUrl": "https://din-app.azurewebsites.net"` eller `"apiUrl": "http://localhost:5236"`?
    - Om **localhost** → Vercel ser inte `API_URL`. Kontrollera: **Settings → Environment Variables** → variabeln ska heta exakt **API_URL**, värdet din Azure-URL, och **Production** ska vara ikryssat (inte bara Preview).
    - Om **Azure-URL** → Bra, gå till steg 2.
  - **Status 404:** Den här koden är inte deployad. Pusha senaste kod (med mappen `app/api/config/`) och vänta på ny deploy.

## 2. Anropet till Azure (`/api/auth/register`)

- Finns det en request till **`https://xxx.azurewebsites.net/api/auth/register`**?
  - **CORS-fel (röd, blockad):** Azure tillåter inte din Vercel-origin. I Azure Portal: App Service → **CORS** (vänstermenyn) → lägg till `https://card-games-rose.vercel.app` under Allowed Origins.
  - **Status 5xx / timeout:** Backend på Azure kraschar eller svarar inte. Kolla loggar i Azure Portal.
  - **Status 200:** Registrering lyckades.

## Snabbtest: Är API_URL satt på Vercel?

Öppna i webbläsaren (ersätt med din Vercel-URL):

```
https://card-games-rose.vercel.app/api/config
```

- Om du ser `"apiUrl":"https://din-app.azurewebsites.net"` → Variabeln är satt.
- Om du ser `"apiUrl":"http://localhost:5236"` eller `"_warning":"API_URL är inte satt..."` → Variabeln saknas eller gäller inte Production.
