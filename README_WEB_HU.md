# Pre'on Lite v0.1

A Pre'on Desktop v0.22.5-ből készített, teljesen böngészős kiadás. Statikus weboldalként fut: nincs backend, nincs felhasználói fiók, és a prezentációk nem kerülnek fel GitHubra.

## GitHub Pages – legegyszerűbb telepítés

1. Hozz létre egy GitHub repositoryt.
2. Töltsd fel ennek a csomagnak a TELJES tartalmát a repository gyökerébe.
3. GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. A csomagban lévő `.github/workflows/deploy-pages.yml` automatikusan felépíti és publikálja az appot minden `main` vagy `master` push után.

A Vite build relatív útvonalakat (`base: "./"`) használ, ezért a Pre'on Lite repository-aloldalon is működik, például `https://felhasznalo.github.io/preon-lite/` alatt.

## Helyi indítás

Windows: dupla kattintás a `START_LOCAL.bat` fájlra.

macOS: dupla kattintás a `START_LOCAL.command` fájlra.

Kézzel:

```bash
npm install
npm run dev
```

## Helyi projektfájlok

- Chrome/Edge alatt a File System Access API-val a megnyitott `.preon` projekt közvetlenül ugyanabba a helyi fájlba menthető vissza.
- Más böngészőkben a mentés letöltésként működik.
- A böngészőből importált képek, GIF-ek, videók, PDF-ek, SVG-k és GLB-k `data:` tartalomként kerülnek a projektbe, tehát nem kell őket szerverre feltölteni.
- A webes projekt ezért hordozhatóbb, viszont sok nagy videó/3D fájl esetén maga a `.preon` fájl is nagy lehet.

## Megtartott fő funkciók

- Single Slide / Continuous / One Slide
- szöveg, rich text, shape-ek
- képek, GIF, videó, SVG
- PDF import és PDF-oldalak diákként
- GLB/3D
- slideshow
- Layers / Assets / Master pages
- grid, guides, snapping
- animációk és transitionök
- Visual/Text Notes
- prezentációs/fullscreen mód
- HTML export
- közvetlen PDF export
- dinamikus mezők
- light/dark mód és HU/EN
- workspace import/export
- SVG maszk és kép/videó háttér

## Szándékosan nincs a Lite-ban

- LAN Live Preview / LAN megosztás
- Tauri natív macOS/Windows menü és ablakkezelés
- natív fájlrendszeres HTML-app-mappa import
- desktop telepítő / automatikus frissítés

Önálló, egyfájlos HTML beágyazása továbbra is lehetséges médiaimporttal; összetett, több fájlból álló HTML-app mappa a böngésző biztonsági korlátai miatt nincs benne az első Lite kiadásban.

## Kompatibilitási megjegyzés

A Lite által mentett projektek médiaadatai beágyazott `data:` URL-eket használnak, amit a desktop Pre'on is előnyben részesít. Egy régi desktop projekt viszont tartalmazhat csak helyi fájlútvonalra mutató asseteket; ezeket egy weboldal biztonsági okból nem olvashatja automatikusan.
