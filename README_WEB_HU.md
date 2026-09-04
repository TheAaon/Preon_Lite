# Pre'on Lite v0.1.1 — webes kiadás

Ez a Pre'on v0.22.5-ből készített, backend nélküli statikus webes változat. A prezentációs adatok a böngészőben maradnak; a projektek helyi `.preon` fájlként nyithatók és menthetők.

## GitHub Pages

A repository gyökerébe a **Preon-Lite-v0.1.1 mappa tartalmát** töltsd fel.

Ezután egyszer állítsd be:

**Settings → Pages → Build and deployment → Source → GitHub Actions**

A `.github/workflows/deploy-pages.yml` automatikusan telepíti a build-függőségeket, elkészíti a statikus `site/` webappot, ellenőrzi a buildet, majd GitHub Pages-re deployolja.

A kiadott build `base: "./"` beállítást használ, így GitHub repository alútvonalon és saját domainen is működik.

## Miért volt fehér a v0.1?

A v0.1 gyökér `index.html` fájlja fejlesztői Vite belépő volt, és közvetlenül `src/main.tsx`-et hivatkozott. Ha a GitHub Pages ezt a nyers fájlt szolgálta ki build nélkül, a böngésző nem tudta a TSX/React forrást közvetlenül futtatni, ezért üres oldal jelent meg.

A v0.1.1-ben a fejlesztői belépő `app.html`, a GitHub Pages pedig kizárólag a workflow által buildelt statikus oldalt kapja.

## Helyi fejlesztés

```bash
npm install
npm run dev
```

A fejlesztői belépőoldal az `app.html`.

## Fontos

A webappnak nincs backendje, adatbázisa vagy saját alkalmazásszervere. A GitHub Pages csak a kész statikus HTML/CSS/JS fájlokat szolgálja ki; minden szerkesztés a böngészőben történik.
