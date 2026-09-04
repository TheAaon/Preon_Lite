# Pre’on v0.22.5

## Presenter timer hotfix és Retina menüikonok

- Javítva az **Időkeret / Deadline** widget belső magasságszámítása: a `.timer-body` már nem írja felül a `widget-body` felső/alsó pozicionálását, ezért a Start / Reset / Törlés vezérlősor nem csúszik a node alá és nem vágódik le.
- Kis magasságú widgeteknél kompaktabb padding és vezérlőmagasság lép életbe. Az Időkeret és Deadline vezérlősora keskeny node-nál is egy sorban marad; így a fix státusz és vezérlők garantált helyet kapnak, és csak a nagy idő-kijelzés zsugorodik.
- A macOS natív menü Pre’on-stílusú ikonforrásai újra lettek rajzolva **vektoros SVG-ből**, majd 36×36 px-es Retina PNG-ként készülnek; az előző 18×18 px raszterek kikerültek.
- Az SVG források a `public/menu-icons/svg` mappában is megmaradnak, így a későbbi saját Pre’on ikonokra egyszerűen cserélhetők.
- A v0.22.4 modul-elrejtés, rich-text jegyzetek, natív macOS menü, One Slide jegyzetlogika és exportmódok változatlanul megmaradnak.

# Pre’on v0.22.4

## Presenter modulkezelés és Pre’on menüikonok

- A HTML Presenter minden modulja a fejléc jobb oldalán kapott egy **×** gombot. Ezzel a modul elrejthető, ha az előadónak nincs rá szüksége.
- Új **Modulok** menü került a Presenter felső sávjába. Innen bármelyik elrejtett modul egy kattintással visszakapcsolható; a láthatóság projektenként a böngésző helyi tárában megmarad.
- A Standard / Notes Focus / Timer Focus presetek ismét minden modult megjelenítik, a Reset pedig a modul-láthatóságot is alaphelyzetbe állítja.
- Az **Időkeret** és **Befejezés eddig** modul belső elrendezése fixen elérhető vezérlősávot kapott: az input és a Start / Reset / Törlés gombok többé nem lóghatnak ki a node alsó részéből.
- Az időmodulok minimális használható méretet kaptak; a kijelzett idő a tényleges rendelkezésre álló területből, mért szövegszélességgel skálázódik, ezért nagy node-ban tovább nő, kis node-ban pedig a vezérlők maradnak prioritásban.
- A macOS natív menü Apple/SF Symbol helyőrző ikonjai kikerültek. A parancsok most a **Pre’on jelenlegi vékony vonalas ikonstílusára épülő saját PNG menüikonokat** használják; a kapcsolható menüpontok natív pipái megmaradtak.
- A Slideshow elem ikonja a Layers és Properties felületen is következetesen a két egymásra helyezett képes Slideshow ikon.
- A v0.22.3 rich-text jegyzet, a jegyzetháttér, a Single / Continuous / One Slide jegyzetlogika és a korábbi exportfunkciók változatlanul megmaradnak.

# Pre’on v0.22.3

## Rich Text Note, Presenter skálázás és natív menü finomítás

- A **Szöveges jegyzet** egyszerű plain-text mező helyett rich-text szerkesztőt kapott. A kijelölt jegyzetszöveg jobb klikkes menüjéből állítható a félkövér, dőlt, aláhúzott és áthúzott stílus, a szöveg- és kiemelőszín, a bekezdés/címsor, a betűméret, az igazítás, a felsorolás/számozás és a behúzás.
- A rich-text jegyzet HTML-je export előtt whitelist-alapú tisztításon megy át; a korábbi plain-text `notes` mező továbbra is megmarad kompatibilitási és keresési fallbackként.
- A közönségnek szánt HTML export továbbra sem tartalmazza sem a plain, sem a formázott előadói jegyzeteket. A Presenter export a megtisztított rich-text jegyzetet jeleníti meg.
- A **macOS natív menüsor** visszakapta az állapotjelző pipákat a kapcsolható nézetekhez és exportmódokhoz. A nem kapcsolható menüpontoknál a Tauri/macOS által támogatott natív ikonok jelennek meg.
- A **Presenter widgetek** mind a nyolc irányból továbbra is átméretezhetők; a resize hitboxok és sarokfogók nagyobbak és könnyebben elérhetők.
- A Presenter vezérlők rugalmasan törnek, a gombok/inputok nem lógnak ki a widgetből kis méretnél sem.
- A **Pontos idő / Időkeret / Deadline** kijelzések fontmérete a modul tényleges szabad területéből számolódik. Nincs korábbi felső fontméret-korlát: nagyobb widgetben az idő kijelzése is tovább nő, a vezérlők és segédszövegek helyének figyelembevételével.
- A **Slideshow** saját ikont kapott: két enyhén eltolva egymásra helyezett képkeret. Ez jelenik meg a felső menüben, toolbarban, Properties panelben és a hiányzó slideshow-média jelölésénél is.
- A v0.22.2 Single / Continuous / One Slide jegyzetlogika, a külön jegyzetháttér, a moduláris Presenter, a videó Start/End és a One Slide dinamikus oldalszám javítása változatlanul megmarad.

# Pre’on v0.22.2

## Presenter és jegyzetnézet javítások

- A HTML Presenter moduljai most valóban szabadon átméretezhetők mind a négy oldalukról és a sarkaikról, nem csak áthelyezhetők.
- macOS Tauri alatt a Fájl / Szerkesztés / Nézet / Prezentáció / Súgó menük a natív macOS felső menüsorba kerülnek; Windows és böngészős futás alatt megmarad a Pre’on saját menüsora.
- A jegyzetkártya alap háttérszíne jobban elkülönül a prezentációtól, és diánként külön színre állítható.
- Egy dia nézetben az aktuális dia és a saját jegyzete egymás mellett jelenik meg.
- Folyamatos nézetben minden dia a saját jegyzetkártyájával együtt látható.
- One Slide / Longform módban a hosszú prezentáció mellett egy dokkolt jegyzet jelenik meg, amely automatikusan a látható szekció jegyzetére vált; a jegyzet saját görgetése nem mozgatja a prezentációt.
- A vizuális One Slide jegyzet előnézetként jelenik meg a dokkban; szerkesztéséhez Egy dia vagy Folyamatos nézet használható.
- A régi alap jegyzetháttér automatikusan az új, elkülönülő alapárnyalatra migrál, az egyedileg beállított színek megmaradnak.

# Pre'on v0.22.1 – Flexible Notes & Modular Presenter

## Text Note és Visual Note

- Az Előadói jegyzetlap továbbra is opcionális, a **Nézet / View → Előadói jegyzetlap** kapcsolóval jelenik meg a Folyamatnézetben.
- A jegyzet többé nem kényszerül 16:9-es diaformára: minden diához külön, szabadon méretezhető **jegyzetkártya** tartozik.
- Az új alapméret **900 × 1200 (álló 3:4)**, lekerekített, külön jegyzet-megjelenéssel, így vizuálisan egyértelműen elkülönül a prezentációs diától.
- Két jegyzettípus választható diánként: **Text Note / Szöveges** és **Visual Note / Vizuális**.
- A Text Note egy egyszerű, folyamatos, saját belső scrollal rendelkező szövegfelület. Nincs karakterkorlátos „dia” logika; több ezer karakteres előadói szöveg is használható anélkül, hogy a következő dia sorába átlógna.
- A Visual Note megtartja a Pre'on normál vászoneszközeit: több szövegdoboz, kép, alakzat, média, guide, grid és réteg használható.
- A jegyzetkártya jobb alsó sarkából szabadon méretezhető; gyors **3:4** preset is elérhető, a vizuális jegyzet Properties paneljében pedig pontos szélesség/magasság és 3:4 / 4:3 preset állítható.
- Régi v0.22.0 jegyzetek migrációja: az üres vagy egyetlen szövegdobozos Notes Board automatikusan Text Note lesz, a meglévő szöveg megmarad; összetettebb vizuális jegyzetek Visual Note-ként maradnak.

## Moduláris HTML Presenter

- A Presenter felület fix panelrács helyett **szabadon rendezhető node/widget workspace** lett.
- Az Aktuális dia, Következő dia, Jegyzet, Vezérlés, Pontos idő, Időkeret és Deadline külön-külön **húzható és méretezhető** modul.
- A dia- és jegyzetpreview automatikusan újrailleszkedik a widget tényleges méretéhez; az óra kijelzése is a widgettel együtt skálázódik.
- Az egyedi Presenter elrendezés projektenként helyben mentődik, és megmarad újranyitáskor.
- Beépített layout presetek: **Standard**, **Notes Focus**, **Timer Focus**, valamint Reset.
- Text Note esetén a Notes widget folyamatos, görgethető hosszú szöveget mutat; Visual Note esetén a vizuális jegyzetkártyát rendereli a saját méretében.
- A smart Next/Prev továbbra is először a hosszú jegyzetet lapozza, és csak a jegyzet végén lépteti a prezentációt.

## Egyszerű HTML exportválasztás

- Új felső **Prezentáció / Presentation** menü került a Nézet mellé.
- Az export szándékosan két egyszerű módra szűkül:
  - **Standard HTML** – csak a tiszta közönségprezentáció készül (`index.html`), jegyzet és Presenter nélkül.
  - **HTML + Presenter** – a közönségfájlok mellett külön `presenter.html` készül a jegyzetekkel és vezérlővel.
- A Standard HTML payloadban a `notes` és `notesBoard` adatok továbbra sincsenek benne.

## One Slide dinamikus oldalszám

- Megerősített végállapot-kezelés: a sticky dinamikus oldalszám One Slide / Longform végén az **utolsó diaszámon marad**, és nem eshet vissza `1`-re akkor sem, ha a sticky scroll-tartomány hosszabb az authored diaszekcióknál.
- A React Present és a HTML/LAN runtime is az authored Longform tartományhoz clamped aktuális szekciót használ; a HTML dinamikus mező fallbackje is az utolsó diára áll.

## Kompatibilitás

- A v0.22.0 Presenter kapcsolat, időzítők, média-vezérlés és videó Start/End funkciói megmaradtak.
- A v0.21.2 Slideshow, v0.21.1 context menu és korábbi funkciók változatlanul megmaradtak.
- Verzió: **0.22.1**.

# Pre'on v0.22.0 – Presenter Workflow

## Jegyzetlap mint artboard

- Az **Előadói jegyzetlap** továbbra is alapból kikapcsolt; a **Nézet / View → Előadói jegyzetlap** kapcsolóval jeleníthető meg.
- A v0.21.3 oldalsó companion elrendezése kivezetve: a jegyzet most a **Folyamatnézet közös vásznán**, a hozzá tartozó dia mellett, közel azonos méretű artboardként jelenik meg.
- A folyamat így párokból áll: **Dia 1 + Jegyzet 1, Dia 2 + Jegyzet 2, …**; a dia vagy a jegyzet artboardra kattintva ugyanazon Pre'on szerkesztőmotorral szerkeszthető az adott felület.
- A Notes nézet bekapcsolásakor a workspace folyamatnézetre vált, hogy az összes dia–jegyzet pár áttekinthető maradjon.
- Minden új jegyzetlap automatikusan kap egy nagy, jól olvasható, **38 px-es alap szövegdobozt**, amely azonnal szerkeszthető, átméretezhető, formázható vagy törölhető.
- Régi, üres v0.21.x jegyzetlapok első v0.22 migrációkor megkapják ezt a starter szövegdobozt; ha v0.22-ben később kézzel törlöd, a program nem hozza újra létre.
- A korábbi plain-text speaker notes migrációja továbbra is megmarad.

## HTML Presenter

- A desktop HTML export most külön **`presentation.html`** közönségnézetet és **`presenter.html`** előadói felületet készít; az `index.html` kompatibilitási közönségnézet marad.
- A `presentation.html` tiszta marad: nem kap Presenter gombot és a közönségnek szánt projektpayload továbbra sem tartalmaz jegyzetet.
- A `presenter.html` egy gombbal megnyitja a `presentation.html`-t, majd `postMessage`-en kommunikál vele; ahol elérhető, BroadcastChannel is használható kiegészítő szinkronként. **Külön Node/Python/webszerver nem szükséges.**
- Presenter nézet: aktuális dia, következő dia, vizuális Notes Board, előző/következő vezérlés, fekete kép, fullscreen kérés és média play/pause.
- Hosszú jegyzetnél a Next/Space/PageDown először a jegyzet következő részére görget; csak a jegyzet alján lép tovább a prezentáció. A visszalépés ugyanezt fordítva kezeli.
- A jegyzet zoomja és a Presenter panelméretek kényelmesen állíthatók.
- Három időpanel került a Presenterbe: **pontos idő**, **időkeret / visszaszámláló** és **befejezési időpont / deadline**. Az idő kijelzésének mérete panelenként növelhető vagy csökkenthető.
- A Presenter a közönségnézettől állapotot kap az aktuális diáról, így a vezérlés normál és One Slide/Longform prezentációban is együtt mozog.
- A `presenter.html` természetesen tartalmazza a megjelenítendő előadói jegyzeteket; a `presentation.html` nem.

## Videó prezentációs beállítások

- A videó lejátszó-navigációja alapértelmezetten **kikapcsolt** marad, és külön kapcsolható be a Properties panelben.
- A **Kezdés** és opcionális **Vége** időpontok migrációja normalizált; Present és HTML lejátszás ezekhez igazodik.
- A Presenter média gombja az aktuális dia videóit és slideshow-it tudja play/pause állapotban vezérelni.

## One Slide dinamikus oldalszám

- További javítás a sticky dinamikus oldalszámhoz: a One Slide / Longform végére érve **nem ugorhat vissza 1-re**.
- A sticky elem a teljes scroll-élettartama alatt a viewport aktuális szekciójának dinamikus értékét használja, a pin tartomány után is.
- A javítás React Present Mode-ban és a HTML/LAN runtime-ban is benne van.

## Kompatibilitás

- A v0.21.2 Slideshow, v0.21.1 context menu, v0.21.0 productivity tools és a korábbi projektmigrációk megmaradtak.
- Verzió: **0.22.0**.

# Pre'on v0.21.3 – Presenter Notes Board & One Slide dynamic numbering

## Presenter Notes Board

- Új, vizuális **Előadói jegyzetlap / Presenter Notes Board** minden diához.
- A jegyzetlap alapból rejtett; a **Nézet / View → Előadói jegyzetlap** kapcsolóval jeleníthető meg.
- Bekapcsolva a dia és a hozzá tartozó jegyzetlap egymás mellett látszik. A másik felületre kattintva az válik aktív szerkesztési vászonná.
- A jegyzetlap ugyanazt a Pre'on elem- és szerkesztőrendszert használja, mint a dia: szöveg, képek, alakzatok, média, grid, guide-ok, igazítás, rétegek és a meglévő formázóeszközök használhatók rajta.
- A jegyzetlap külön háttérrel, saját guide-okkal és griddel rendelkezik, és diánként külön mentődik a `.preon` projektbe.
- Régi projektek hagyományos plain-text speaker note tartalma első migrációkor automatikusan vizuális szövegdobozként kerül a jegyzetlapra.
- A jegyzetlap tartalma privát szerkesztő/presenter adat: a közönségnek szánt HTML/LAN projektpayloadból a notes és notesBoard mezők is eltávolításra kerülnek; PDF-ben a jegyzetlap soha nem renderelődik.
- A jegyzetlapon használt asseteket az Asset panel használatban lévőként kezeli, így nem törölhetők véletlenül.

## One Slide dinamikus oldalszám

- Javítva a sticky/pinned dinamikus oldalszám One Slide / Longform módban.
- Rögzített dinamikus oldalszám görgetés közben már az aktuálisan nézett szekció számát mutatja, nem marad a forrásdia számán.
- A működés Present Mode-ban és a hordozható HTML/LAN runtime-ban is követi a viewport aktuális One Slide szekcióját.
- A normál Slide Presentation dinamikus oldalszám működése változatlan.

## Kompatibilitás

- A v0.21.2 Slideshow, a v0.21.1 dinamikus jobb klikk menü és a korábbi funkciók változatlanul megmaradtak.
- Verzió: 0.21.3.

# Pre'on v0.21.2 – Slideshow

## Új Slideshow elem

- Új, önálló **Slideshow** médiaelem: egyetlen képkereten belül több kép váltható egymás után.
- Egy dián tetszőleges számú, egymástól független slideshow helyezhető el.
- A képek sorrendje drag & drop-pal vagy a sorrendgombokkal módosítható; képek hozzáadhatók és eltávolíthatók.
- A slideshow indulhat automatikusan a dia megjelenésekor vagy az elemre kattintva.
- Opcionális kattintásos play/pause vezérlés és loop mód.
- Állítható képenkénti idő, **Cut** (azonnali váltás) és **Fade** (áttűnés), valamint külön fade-idő.
- Az editor Properties paneljében helyi Preview indítható anélkül, hogy a teljes prezentációt el kellene indítani.

## Képkeret és médiafunkciók

- A Slideshow ugyanazokat az alap képkeret-beállításokat használja, mint a kép: Cover / Contain / Fill, tartalompozíció, nagyítás, sarokkerekítés, keret és maszk.
- Kép dobható közvetlenül meglévő slideshow-ra; több fájl egyidejű dobásakor minden kompatibilis kép hozzáadódik.
- Meglévő workspace-ben a Slideshow eszköz automatikusan bekerül az Image mellé, ha az Image eddig is része volt az ikonsornak.
- A slideshow-képek asset-használata követve van, ezért használatban lévő kép nem törölhető véletlenül az Asset panelből.

## Present / HTML / LAN / PDF

- Present módban a slideshow a beállított automatikus vagy kattintásos lejátszással fut, és a dia elhagyásakor leáll.
- HTML és LAN exportban ugyanaz a Cut/Fade, időzítés, loop és kattintásos működés érhető el.
- Longform HTML/LAN nézetben az automatikus slideshow csak akkor fut, amikor a saját szakasza látható.
- PDF/thumbnail kimenet szándékosan az első képkockát használja, így a statikus export determinisztikus.

## Kompatibilitás

- Régi Pre'on projektek változtatás nélkül megnyithatók; a slideshow-adatok migrációja biztonságos alapértékeket használ.
- A v0.21.1 dinamikus jobb klikk menü, a v0.21.0 productivity tools és a v0.20.9 startup/overflow hotfix változatlanul megmaradt.

# Pre'on v0.21.1 – Dynamic Context Menu

## Saját jobb klikk menü

- Új, teljesen Pre'on-stílusú **dinamikus context menu** a vásznon, szerkeszthető objektumokon és dia-bélyegképeken.
- A menü automatikusan más profilt választ vászon, szöveg, alakzat, média, többes kijelölés és dia esetén.
- Alapból csak a legfontosabb műveletek látszanak; az adott helyzetben nem értelmezhető parancsok automatikusan el vannak rejtve.
- Új almenük az Arrange, Align, Select Same, Add és képillesztés műveletekhez.
- A fontos szerkesztőparancsok mellett projekt-, export-, panel- és prezentációs parancsok is hozzáadhatók.
- Szöveg közvetlen szerkesztése közben a natív szövegkijelölési context menu megmarad, hogy a kijelölt karakterek másolása/beillesztése ne keveredjen az objektumszintű menüvel.

## Settings / Jobb klikk

- A Workspace ablak külön **Általános / Ikonsor / Jobb klikk** füleket kapott.
- A Jobb klikk fülön külön szerkeszthető a Canvas, Generic Object, Text, Shape, Image/Media, Multi-select és Slide Thumbnail profil.
- A parancsok sorrendje módosítható, elemek eltávolíthatók, elválasztók és almenük tehetők be.
- A teljes context-menu parancskönyvtárból bármely parancs közvetlenül hozzáadható az adott profilhoz.
- Profilonként és globálisan is visszaállítható az alapértelmezett menü.
- A régi workspace fájlok automatikusan megkapják az alap menüprofilt; a szándékosan üresre állított profil üres marad.

## Kompatibilitás

- A v0.21.0 pipetta, Effects, multi-select formatting, Select Same és Replace Font funkciói változatlanul megmaradtak.
- A v0.20.9 startup/overflow hotfix változatlanul megmaradt.

# Pre'on v0.21.0 – Productivity Tools

## Pipetta és stílusátvitel

- Új **Színpipetta** a felső eszköztárban. A kijelölt szöveg vagy shape színét a mintavétel után egy lépésben módosítja.
- Ahol a WebView támogatja a natív EyeDropper API-t, valódi képernyőpixelt mintáz; más környezetben a Pre'on saját szöveg-, shape- és diaszínei közvetlenül mintázhatók.
- A pipetta lenyílójában új **Formázáspipetta** van: a kijelölt célszövegekre átveszi a forrás szöveg tipográfiai formázását, a szövegtartalom és a textbox geometriája változatlan marad.
- Új **Stílus másolása / Stílus beillesztése** parancs az Edit menüben (`⌥⌘C` / `⌥⌘V`). Azonos elemtípusnál a releváns megjelenési tulajdonságokat, minden elemnél az opacity/effect megjelenést viszi át.

## Több szöveg közös formázása

- Több kijelölt textbox esetén megjelenik a közös **Szöveg** inspector.
- Egy lépésben módosítható a betűtípus, betűméret, font weight, bold/italic/underline/strike, sorköz, betűköz, szín és igazítás.
- Eltérő beállításoknál a mezők **Vegyes** állapotot mutatnak; csak az a tulajdonság változik minden kijelölt textboxon, amelyhez a felhasználó ténylegesen hozzányúl.

## Effects

- Új közös **Effektek** inspector szöveghez, shape-hez és médiaelemekhez.
- **Drop Shadow:** X/Y eltolás, blur, opacity és szín.
- **Blur:** ki/bekapcsolás és szabad mérték.
- **Glow:** méret, opacity és szín.
- Az effektek nem destruktív projektadatként mentődnek, régi projektek betöltésekor automatikusan biztonságos alapértékre migrálódnak.
- Az editor, Present/PDF scene és a hordozható HTML/LAN runtime ugyanazt az effektmegjelenést használja.

## Select Same és Replace Font

- Új **Azonos kijelölése** szekció: az aktív dián objektumtípus, szín, teljes stílus, illetve szövegnél font vagy fontméret alapján lehet egyező elemeket kijelölni.
- A **Szövegek / Text Overview** panel új **Replace Font** blokkot kapott.
- A Replace Font a teljes prezentációban – diákon, mastereken és Text Style rekordokban – lecseréli a kiválasztott betűcsaládot.

## Kompatibilitás

- A v0.20.9 startup/overflow hotfix változatlanul megmaradt.
- A v0.20.8 Box/Text Resize és Text Overview működése változatlanul megmaradt.
- A meglévő macOS/Windows release build folyamat változatlan.

# Pre'on v0.20.9

- Hotfix: az editor indulásakor fellépő üres ablak / React összeomlás javítva.
- Az overflow ResizeObserver ismét a tényleges textbox DOM node-ot figyeli.
- Az overflow-mérés védett: mérési kivétel többé nem tudja leállítani az editort.
- A v0.20.8 Text Overview és Box/Text Resize fejlesztései változatlanul megmaradtak.

# Pre'on 0.20.8 - Text resize and overview polish

- Fixed false-positive text overflow indicators by measuring intrinsic wrapped text size with tolerance instead of the rendered flex box scroll metrics.
- Switching Box / Scale Text resize mode now preserves the current text box dimensions and line wrapping.
- Editing text, changing fonts, or applying text styles no longer auto-expands Scale Text boxes to a single natural line.
- Scale Text mode now exposes corner handles only and scales pixel-based text spacing metrics together with font size.
- Added a small canvas-side Box / Text resize mode toggle on the selected text box.
- Moved Text Overview directly before Assets in the right panel.
- Restyled Text Overview as a continuous proofing view with subtle slide/text dividers and auto-height text fields.

# Pre'on 0.20.7 - Text Overview

- Uj **Szovegek / Text Overview** panel a jobb oldali panelsavban.
- A prezentacio osszes dia-szovegdoboza dian kent egy helyen szerkesztheto.
- Egy szovegre kattintva a szerkeszto a megfelelo diara ugrik es kijeloli a textboxot.
- **Find & Change**: elozo/kovetkezo talalat, egyedi csere es Change All az egesz prezentacioban.
- A dinamikus szovegmezok (pl. automatikus oldalszam) lathatok, de vedetten read-only modban maradnak.
- Valos renderelt mereten alapulo text overflow ellenorzes.
- Tulcsordulasnal egy kis **+** jel jelenik meg a Text Overview sorban es a textbox jobb also sarkanal a dián.
- A textbox meretet automatikusan koveto `scale` szovegmod a panelbol torteno szerkesztesnel is megmarad.

# Pre'on 0.20.6 – LAN Live Preview & Settings Polish

## LAN Live Preview

- A LAN megosztás most **élő preview**: a megosztási címet egyszer kell megnyitni, a Pre'on projekt módosításai rövid debounce után automatikusan új snapshotot publikálnak.
- A megnyitott LAN oldal verziótokent figyel, és új snapshotnál automatikusan frissül. One Slide módban a görgetési pozíciót frissítéskor megőrzi.
- One Slide / Longform módváltás és a projekt tartalmi módosításai is automatikusan átkerülnek a megosztott nézetbe; nem kell újra megnyomni a Megosztás gombot.
- GLB 3D modellek LAN megosztásnál file-safe, cache-elt data URL snapshotot kapnak, így a távoli böngésző nem függ a szerkesztőgép helyi fájlútvonalától.
- A normál HTML export nem kap live-reload kódot; az új figyelő kizárólag LAN megosztásnál aktív.

## Beállítások / téma

- A nyelvválasztó és a világos/sötét téma kapcsoló kikerült a felső fejlécből; mindkettő csak a Beállítások / Workspace ablakban található.
- Új **Automatikus** téma mód követi a macOS / Windows rendszer világos-sötét beállítását, és futás közbeni rendszertéma-váltásra is reagál.
- A világos mód fix Pre'on krémpalettát használ, így a háttér/szöveg kontrasztja nem borítható fel.
- Csak a **Sötét mód világossága** állítható; az érték Automatikus módban is a sötét rendszerállapothoz használódik.

## Tulajdonságok panel

- Első használatkor minden inspector-szekció alapból csukva indul.
- A nyitott/csukott állapotok localStorage-ba mentődnek, így app újraindítás után a Properties panel visszaáll az utoljára használt elrendezésre.

## App ikon

- A felhasználó által adott eredeti SVG logóból új, nagy felbontású 1024 px master ikon készült.
- A macOS ICNS, Windows ICO és Tauri PNG ikonok újragenerálva, ezért a Dock/Finder/Windows ikon nem alacsony felbontású forrásból skálázódik.
- Az ikon új háttere Pre'on krémszínű, a logó az eredeti `#819b7e` zöld maradt.

---

# Pre'on 0.20.5 – Cross-platform Release Build

## Splash / indulás

- A békás splash minimum megjelenési ideje 1,8 másodpercről **3 másodpercre** nőtt, hogy az animáció ne vágódjon le.
- A fő alkalmazás továbbra is a splash alatt töltődik, ezért a 3 másodperc nem egy külön, utólagos várakozás.
- A splash továbbra is keret nélküli és az aktuális kijelző közepére igazodik.

## macOS / Windows ablakkezelés

- A macOS `Overlay` title bar most már kizárólag macOS-en aktiválódik.
- Windows alatt a Pre'on visszaáll a natív Windows title barra, így a macOS traffic-light helyének fenntartott extra sáv nem tolja el a Windows UI-t.
- Platform-specifikus Tauri konfiguráció készült: `tauri.macos.conf.json` és `tauri.windows.conf.json`.
- Windows release buildben `windows_subsystem = "windows"` aktív, ezért a kész alkalmazás indításakor nem jelenik meg külön CMD/konzolablak.

## Release build scriptek

- `BUILD_MAC.command`: natív release build, `.app` + `.dmg`, majd a kész csomagok `RELEASE/macOS` alá kerülnek.
- `BUILD_WINDOWS.bat`: Windows release build, NSIS Setup EXE, majd a telepítő `RELEASE\Windows` alá kerül. A nyers release EXE is kimásolódik `Preon-portable.exe` néven, ha elérhető.
- Az `INDITAS.command` továbbra is kizárólag fejlesztői/teszt indító; a kész `.app` és Windows release nem függ a Termináltól, npm-től vagy a forrásmappától.

---

# Pre'on 0.20.4 – Header Layout & Performance Pass

## macOS fejléc

- A natív piros/sárga/zöld macOS ablakgombok megmaradtak, de külön felső titlebar-sávot kapnak.
- A Pre'on logó, dokumentumnév, menük, eszköztár és jobb oldali műveletek a traffic-light gombok **alatt** indulnak, így a natív fejléc többé nem tolja össze vízszintesen az eszköztárat.
- A fejléc továbbra is Overlay módban, a Pre'on Light/Dark témájába olvadva jelenik meg.
- Az üres felső titlebar-terület és a TopBar üres részei továbbra is használhatók az ablak húzására; a gombok és mezők nem indítanak ablakmozgatást.

## Font picker teljesítmény

- A korábban elmentett fontcsaládlista azonnal megjelenik; a program nem indít minden inspector-megnyitáskor új teljes rendszerfont-scan-t.
- Már meglévő family cache esetén a részletes HTML-embedding/fontfájl ellenőrzés csak a font picker megnyitása után, késleltetve indul, ezért a lenyíló azonnal reagál. Első futáskor egyetlen natív scan építi fel egyszerre a family és részletes rekordcache-t.
- A részletes scan eredményéből frissül a családlista is, így normál használatban nem fut egymás után két teljes fontfájl-bejárás.
- A fontlista virtualizált: egyszerre csak a látható sorok és kis ráhagyás renderelődik, nem több száz vagy ezer font preview. A görgetési állapot frissítése `requestAnimationFrame`-re van korlátozva.
- A hoveres élő fontelőnézet megmaradt, de rövid (90 ms) késleltetéssel csak a ténylegesen megállított betűn fut le, így gyors egérmozgatás közben nem méretezi/rerendereli újra folyamatosan a kijelölt szöveget.
- Az export státuszikonok lookupja előre felépített Mapből történik; megszűnt a teljes fontrekord-lista minden sorhoz történő újraszűrése.
- A telepített fontváltozatok részletes listája csak akkor töltődik, amikor a variáns mezőt ténylegesen használják.
- A natív részletes fontscan egy fontfájlt csak egyszer olvas be, és ugyanabból a byte-adatból készíti a family + embedding információt; az egyszerű és részletes natív lista közös cache-t használ, így nem indul két párhuzamos teljes bejárás.
- A ponttal (`.`) kezdődő macOS belső fontok továbbra sem jelennek meg.

## Általános teljesítmény-audit

- Gyakori elemmozgatás/formázás már nem deep-clone-olja a teljes prezentációt: csak az aktív dia/mester és a módosított elemek kapnak új objektumot. A drag/resize indításkori Undo snapshot is immutábilis projekt-referenciát használ teljes deep clone helyett. Az Undo/Redo előzmény ettől megmarad.
- Az automatikus mentés hosszabb debounce után, lehetőség szerint browser idle időben serializál, így kevesebb mikroszaggatást okoz szerkesztés közben.
- A bal oldali dia thumbnail lista csak a viewport közelében lévő jeleneteket rendereli; az offscreen thumbnailök könnyű placeholderként maradnak.
- Continuous és One Slide editor nézetben a távoli diák/szekciók teljes jelenete és médiája nem renderelődik, csak a látható tartomány körüli ráhagyás.
- One Slide Present módban szintén csak a viewport környéki szekciók teljes scene/media DOM-ja él; a layout és a Pin/overlay logika továbbra is a teljes dokumentummal számol.
- PDF thumbnail render célfelbontása jelentősen csökkent, miközben a Present/export minőség változatlan marad.
- Az Assets panel használatszámlálása egyetlen projektbejárásból készül; kép preview lazy/async, videó asset preview `preload=none`.
- Editorban a videóelemek nem töltenek elő automatikusan teljes videófájlt; Present módban továbbra is eager playback-ready marad.
- Gyakori renderutakon az asset-keresés előre felépített Mapből történik a sokszoros `assets.find(...)` helyett; a dia- és mesterthumbnailök ugyanazt a közös asset Mapet használják.
- A 3D `model-viewer` runtime csak akkor töltődik be, amikor tényleges 3D elem szükséges; thumbnail nem indít 3D engine-t.
- A PDF.js runtime és worker is csak az első tényleges PDF műveletnél töltődik be; PDF nélküli projektnél nem terheli az induló bundle-t.
- HTML/PDF export modulok csak export indításakor töltődnek be; a nagy 3D HTML runtime csak 3D-t tartalmazó exportba kerül.
- A békás splash kötelező minimum ideje 5 másodpercről 1,8 másodpercre csökkent; a fő React app közben párhuzamosan töltődik.
- A közös text measurement canvas újrahasznosul, így fontpreview és automatikus textbox-mérés közben kevesebb DOM/canvas allokáció történik.

## Kompatibilitás

- A v0.20.1 numerikus mező, téma-világosság, font export ikon, typography, Text Styles és Pin működés megmaradt.
- One Slide PDF továbbra is **normál prezentációméretű oldalakra szeletelve** készül; nem készül egyetlen óriási PDF-lap.

---

# Pre'on 0.20.3 – Window Drag Hotfix

- A témába olvadó macOS overlay fejléc megmaradt.
- A felső sáv üres területéről ismét húzható a teljes ablak.
- A fejléc gombjai, menüi és egyéb interaktív elemei kattinthatók maradnak, nem indítanak ablakmozgatást.
- Hozzáadva a Tauri natív `startDragging` jogosultság.

---

# Pre'on 0.20.2 – macOS Window Hotfix

- Javítva: a v0.20.1-ben a splash után a főablak fejléc nélkül maradhatott, mert hiányzott a `setDecorations` Tauri jogosultsága.
- A splash induláskor keret nélküli marad.
- A főablak visszakapja a natív bezárás / minimalizálás / nagyítás vezérlőket.
- macOS-en `Overlay` title bar: a natív traffic-light gombok a Pre'on saját, témaszínű felső sávján jelennek meg.
- A felső sáv követi a Light/Dark módot és a beállított téma-világosságot.
- A splash az egérmutatót tartalmazó kijelző munkaterületének közepére kerül; hiba esetén a Tauri `center()` a fallback.

---

# Pre'on 0.20.1 – UI + Font Hotfix

## Fontválasztó / HTML átadás

- A macOS belső, ponttal (`.`) kezdődő rejtett fontcsaládjai nem jelennek meg a fontválasztóban, a Recent/Favorites listában és a fontvariánsok között.
- A font neve mellett csak egy kompakt HTML-export státuszikon látszik. A jelentése kizárólag hover tooltipben jelenik meg.
- A státusz megkülönbözteti a közvetlenül beágyazható fontot, a korlátozott TTF/OTF fontot, a rendszer/fontgyűjtemény típust és az ismeretlen állapotot.
- A natív fontscan az OpenType embedding flaget is figyelembe veszi; TTC fontgyűjteményt nem jelöl közvetlen webfontként beágyazhatónak.

## Számmezők és gyorsértékek

- A Properties számmezői nem írják többé gépelés közben azonnal `0`-ra a tizedes értékeket. A magyar vessző (`0,5`) és a pont (`0.5`) is elfogadott.
- Az átmeneti gépelési állapotok (`-`, `0,`, `1,` stb.) a mezőben maradnak; a végleges normalizálás és min/max korlátozás Blur/Enter eseménynél történik.
- Új közös „dropdown + szabad bevitel” számmező került be. A lista csak gyorsértékeket ad, miközben ugyanabba a mezőbe tetszőleges pontos érték írható.
- Sorköz: `Auto` + 100/110/120/130/150/200% gyorsértékek, szabad kézi bevitellel.
- Betűköz: `Auto` + gyakori tracking értékek, szabad kézi bevitellel.
- Az `Auto` valódi automatikus állapot: sorköznél CSS `normal`, betűköznél természetes `normal` spacing.
- Ugyanez a közös mezőlogika már Forgatásnál és Átlátszóságnál is működik, így később más beállításokra is konzisztensen használható.

## Inspector / téma / splash

- A Properties címkék nem csúsznak az inputok mögé és nem törnek több használhatatlan sorba. Szűk helyen egy sorban maradnak, ellipszissel; a teljes cím hover tooltipben olvasható.
- A kétoszlopos kompakt mezőkben a címke az input fölé kerül, így a hosszabb magyar feliratok sem ütköznek a beviteli mezővel.
- A Workspace / Beállítások alatt új `Téma világossága` csúszka van. A sötét és világos mód saját értéket jegyez meg, és külön visszaállítható alapértékre.
- A fényerő az editor chrome fő felületeire terjed ki (panelek, toolbar, inspector, mezők, canvas-környezet, popupok), a prezentáció tényleges dia-artworkját nem módosítja.
- A békás induló splash ablak frameless: nincs title bar, bezárás/minimalizálás/nagyítás. Az editor betöltésekor a normál natív ablakdekoráció visszaáll.

## Kompatibilitás

- A v0.20 One Slide / Pin / Text Styles működése változatlanul megmaradt.
- One Slide PDF továbbra is normál prezentációméretű oldalakra van szeletelve; nem készül egyetlen óriási PDF-oldal.

---

# Pre'on 0.20.0 – Interaction Cleanup & Typography

## One Slide / Pin cleanup

- A v0.19 Horizontal One Slide / vertical → horizontal → vertical flow teljesen kikerült a normál editorból és a Present/HTML runtime-ból. A One Slide ismét kizárólag stabil vertikális flow-t használ.
- A Soft Pin kivezetve. Minden rögzített objektum pixelstabil Hard Pin logikát használ; régi Soft Pin projektadat migrációkor automatikusan Hard Pin lesz.
- A One Slide rögzítés ugyanazt az egységes `One Slide / görgetés` panelt használja kép, PDF, SVG/shape, szöveg, videó, web és 3D objektum esetén, ahol értelmezhető.
- A szövegdobozok is közvetlenül rögzíthetők ugyanazzal a Pin logikával, mint a képek.
- Videónál a Pin / tartomány beállítás kikerült a Videó panelből. A Videó panelben csak a videós lejátszás marad; a rögzítés és scroll-tartomány a közös One Slide panelben állítható.
- Scroll-controlled video továbbra is működik előre és visszafelé scrubbal; Pin esetén a videó stabilan a viewporthoz tapad.
- A korábbi Layers sorrend és section-seam javítások megmaradtak.

## Szövegkezelés – új, kompakt UI

- A korábbi automatikus `Title / Subtitle / Body / Caption` gyors preset sor kikerült.
- A fő Szöveg panel most a leggyakoribb műveleteket mutatja; ritkább beállítások külön összecsukható részekbe kerültek.
- Kompakt karakterformázó ikonsor, hover tooltippekkel: félkövér, dőlt, aláhúzott, áthúzott, ALL CAPS, kiskapitális, felső index, alsó index.
- Kompakt bekezdés-igazítás: bal, közép, jobb, sorkizárt.
- További tipográfia: betűvastagság finomhangolás, baseline shift, ligatúrák.
- Bekezdés/szövegdoboz külön blokk: első sor behúzás, előtte/utána térköz, belső margó, függőleges igazítás és box/scale resize mód.
- A Properties panel nyitott/csukott állapotai továbbra is stabilak objektumváltáskor.

## Valódi, kézi Text Styles

- Új projekt-szintű Text Styles rendszer.
- Nincs automatikusan generált Főcím/Alcím/Body stíluslista.
- `Új stílus a kijelölt szövegből`: a felhasználó saját névvel és saját formázással hozza létre a stílusokat.
- Stílus alkalmazható más szövegdobozra.
- `Stílus frissítése` a kijelölt szöveg aktuális formázását átvezeti minden ugyanahhoz a stílushoz kapcsolt textboxra.
- Stílus törlésekor a textboxok aktuális formázása megmarad, csak a kapcsolat szűnik meg.
- Régi projektfájlok automatikusan üres Text Styles listával migrálódnak.

## Export / kompatibilitás

- Az új text tulajdonságok editorban, Presentben, HTML/LAN runtime-ban és a React-alapú PDF renderben is megjelennek.
- Nem beágyazható fontnál az advanced typography nem készül hibás natív outline-nal; inkább CSS/font fallback marad.
- One Slide PDF továbbra is normál slide-méretű oldalakra van bontva.

---

# Pre'on 0.18.0 – Scroll Motion & Stability Audit

## One Slide / Scroll Motion

- Új általános **Scroll animáció** minden normál One Slide objektumhoz: opacity, scale, X és Y pozícióeltolás külön kezdő- és végértékkel.
- A Scroll Motion ugyanazt a scroll-tartomány motort használja, mint a Sticky, a scroll-controlled videó és a 3D Scroll rotate: képernyőnyi távolság vagy egy későbbi szekcióig tartó tartomány választható.
- Gyors presetek: **Fade up**, **Zoom in**, **Slide in**. A beállítások utána kézzel tovább finomíthatók.
- A Scroll Motion csak interaktív One Slide runtime-ban érvényesül. Hagyományos Slide módban, thumbnailben és PDF-ben az objektum szerkesztett alapállapota marad, ezért például egy 0%-ról induló opacity animáció nem tünteti el az elemet a statikus exportból.
- A dokumentum végén szükség esetén automatikus scroll-runway marad, így egy hosszabb scroll animációhoz nem kell kézzel szekciómagasságot növelni.

## Sticky / rétegsorrend javítás

- A Sticky / Hard Pin **nem emeli többé automatikusan legfelülre** a képet, videót, PDF-et, szöveget vagy 3D objektumot.
- One Slide Present módban és HTML/LAN exportban a pin idején is a meglévő Layers / dokumentumsorrend marad az alap. A pinned objektum fölötti tartalom továbbra is fölötte, az alatta lévő tartalom alatta jelenhet meg.
- HTML/LAN runtime-ban az aktív pin idejére maga a létező DOM médiaelem kerül át a fixed kompozitáló rétegbe, nem egy klón. Ez megőrzi a videó / 3D runtime állapotát.
- Az ideiglenesen áthelyezett HTML elemek saját helyőrző anchorral térnek vissza, így a pin feloldása nem változtatja meg véglegesen a DOM- és rétegsorrendet.
- A HTML fixed réteg a prezentáció vezérlői alatt marad, ezért egy teljes képernyős pinned objektum sem takarja el az Exit / Fullscreen kezelőket.

## One Slide hajszálvékony illesztési vonal

- A szekciók közti korábbi 1 px-es vizuális divider megszűnt.
- Az egymás melletti/egymás alatti One Slide háttérfragmentumok minimális vizuális átfedést kapnak editorban, Presentben, HTML/LAN exportban és PDF-rasterizálásnál is. Ez a zoom- és Retina/subpixel kerekítésből származó hajszálvékony seamet takarja el.
- A tényleges szekciókoordináták és a PDF-oldalbeosztás ettől nem változik.

## Teljes programforrás audit – talált és javított hibák

- **LAN fájlkiszolgáló útvonalbiztonság:** javítva egy percent-decoding utáni abszolút/parent path escape lehetőség. A LAN szerver most csak a létrehozott snapshot relatív fájljait szolgálhatja ki.
- Ugyanez a relatív útvonal-ellenőrzés bekerült a glTF dependency másolásba, HTML export asset célútvonalakba és LAN snapshot asset másolásba.
- HTML-app mappák rekurzív másolásakor a program nem követ symlinkeket, így nem tud könyvtárhurkot vagy véletlen külső fájlbehúzást létrehozni.
- LAN megosztásnál a korábbi snapshot rövid türelmi idő után törlődik, így az ismételt megosztások nem hagynak korlátlanul teljes másolatokat a lemezen.
- PDF document cache felszabadul asset törlésekor, unused-assets takarításkor, projektváltáskor és új projekt indításakor; a korábbi hosszú munkamenetek memóriafelhalmozása csökkent.
- Több összekapcsolt dia együttes duplikálásakor a belső navigációs és `until-section` scroll-célok most az újonnan létrehozott másolatokra mutatnak, nem az eredeti diákra.
- Dia törlésekor a rá mutató scroll range target is tisztul; az érvénytelenné váló `until-section` tartomány visszaáll képernyőalapú módra.
- Undo/Redo alatt törölt vagy már nem létező Master szerkesztési állapot nem ragad bent hibásan.
- Workspace import/reset azonnal szinkronizálja a tényleges DOM theme/language állapotot is.
- Böngészős Workspace import hibás JSON esetén kezelhető hibaüzenetet ad unhandled exception helyett.
- Az Assets panelből a korábban importált `html-app` asset újra behelyezhető a prezentációba.
- Locked objektumok nem mozdíthatók el véletlenül billentyűzetes nyilakkal akkor sem, ha Layersből kijelölhetők.
- Az angol UI-ban megszűnt a `Tapadás / Snapping` és `Pin behavior` fordítási kulcsütközés; a v0.18 új Scroll Motion mezőihez hiányzó fordítások is bekerültek.
- Font picker aktív elem szinkronja frissül a tényleges fontérték változásakor is.
- Splash / About / TopBar látható verziószámai közös `APP_VERSION` forrást használnak; a splashben maradt régi verziószám megszűnt.

## Export és kompatibilitás

- A **One Slide PDF változatlanul normál slide-méretű oldalakra szeletelve készül**. Nem készül egyetlen extrém magas PDF-page vagy óriási raster.
- Sticky, Scroll Motion, videó scrub és 3D scroll interaktív HTML/Present funkciók; PDF-ben a szerkesztett statikus alapállapot készül.
- A v0.17.1 Hard/Soft Pin, scroll-controlled videó, a v0.16/0.15/0.14 kompatibilitási mezők és korábbi projektek migrációja megmaradt.
- Verzió: 0.18.0.

---

# Pre'on 0.17.1 – Hard Pin & Inspector hotfix

- A One Slide objektumszintű Sticky alapértelmezése most **Pontos / Hard pin**. A rögzített elem külön, viewporthoz kötött overlay-rétegben jelenik meg, ezért scroll közben nem kell minden képkockán a pozícióját JavaScriptből utánaszámolni.
- A Hard pin a tartomány elején pixelstabilan rögzül, a tartomány végén pedig visszacsatlakozik a normál dokumentumfolyamba.
- Opcionális **Lágy / Soft pin** megmaradt a lebegőbb, enyhén utánkövető hatáshoz; ez nem alapértelmezett.
- A scroll-controlled videó scrub frissítése `requestAnimationFrame`-ben összevonja a gyors scroll eseményeket, és nem indít új seeket, amíg az előző seek folyamatban van. Ez csökkenti a röcögést trackpad / gyors görgetés mellett.
- Present Mode scroll állapotfrissítése képkockánként legfeljebb egyszer fut.
- HTML/LAN export ugyanazt a Hard / Soft pin logikát és összevont videó-scrubot kapta.
- A Properties panel lenyitott/összecsukott szekciói most megjegyződnek. Másik képre vagy azonos típusú másik objektumra kattintva a panel nem nyit/csuk át önkényesen.
- A Properties panel külön megjegyzi az objektum-, dia-, mester- és több-dia nézet görgetési pozícióját, így ki- majd visszakattintáskor sem ugrik vissza feleslegesen a panel tetejére.
- A panel szekcióinak sorrendje nem függ a kijelölt kép konkrét példányától; csak az értékek változnak.
- Régi v0.17 projektekben a hiányzó `pinBehavior` automatikusan `hard` értékre migrálódik.
- A One Slide PDF logika változatlan: továbbra is normál slide-méretű oldalak készülnek, nem egyetlen óriási PDF-lap.
- Verzió: 0.17.1.

---

# Pre'on 0.17.0 – One Slide Scroll Interactions

- A One Slide scroll workflow objektumszintű lett: normál elemekhez `Normal` vagy `Sticky / Pinned` viselkedés állítható.
- Sticky tartomány megadható görgetési távolsággal (0,25–12 képernyő) vagy egy kiválasztott későbbi szekcióig.
- A v0.16 látható `Szekció magassága` és `Sticky szekció` kezelői kikerültek a Properties panelből és a dia-lista metaadataiból. A régi projektek értékei kompatibilitás miatt megmaradnak.
- Új videó mód: `Görgetés vezérli`. Lefelé scrollozva a videó előre, felfelé scrollozva visszafelé scrubol; megálló scrollnál a videó is megáll.
- Scroll-controlled videónál két mód választható: `Oldallal együtt` és `Rögzítve lejátszás közben`.
- A videó scroll-tartománya képernyőkben vagy egy későbbi szekcióig adható meg; a Start / End videó-idő továbbra is meghatározhatja a scrubolható részletet.
- A GLB/glTF `Scroll rotate` interakció One Slide-ban ugyanazt a scroll-tartomány motort használja, és Sticky móddal rögzíthető az animáció alatt.
- Present Mode és HTML/LAN export ugyanazt az objektumszintű Sticky, videó-scrub és 3D scroll logikát kapta.
- A runtime automatikus scroll-runwayt biztosít, ha a dokumentum végén egy képernyőalapú effektnek több görgetési helyre van szüksége; ehhez nem kell a szekciómagasságot kézzel növelni.
- One Slide PDF export szándékosan változatlan: normál slide-méretű, oldalankénti szeletek készülnek, nem egyetlen óriási PDF-oldal.
- Régi projektek migrációja alapértelmezett scroll-beállításokat ad a korábban nem létező mezőkhöz, a normál Slide Presentation működését nem módosítja.
- Verzió: 0.17.0.

---

# Pre'on 0.16.0 – One Slide v2

- One Slide / Longform szekciónként szabad magasság: 25–600%, gyors 50/100/150/200/300% presetekkel.
- A szekciómagasság több kijelölt szekción egyszerre is módosítható; eltérő értékeknél `Vegyes / Mixed` állapot jelenik meg.
- A longform editor kumulatív, változó magasságú szekciólayoutot használ: az aktív szekció, a scroll/pan, a globális hit-test, a cross-section drag, a Smart Guide / snap és a preview-k ugyanazt a közös koordinátateret követik.
- Új alap `Sticky / Pinned section`: magasabb szekcióban a normál slide-magasságú tartalom rögzítve marad a scroll egy részén, majd a szekció végén elenged. Bekapcsoláskor 100%-os vagy kisebb szekció automatikusan 200%-ra nő.
- 100% vagy kisebb magasságra később visszaállított Sticky szekción a rögzítés inaktív, így nincs felesleges tartalomtúlnyúlás.
- Present Mode és az önálló HTML/LAN runtime is támogatja a változó szekciómagasságot és a Sticky viselkedést.
- Új elem-akció: `Navigáció / kattintás → Ugrás One Slide szekcióra`. Cél szekció és opcionális smooth scroll állítható.
- A navigáció Present Mode-ban és HTML/LAN exportban működik; hagyományos slide módban ugyanez az alapmechanizmus másik diára ugrást végez.
- HTML longform export a section targetet `#section=...` hash-ből is vissza tudja állítani.
- One Slide PDF továbbra is szándékosan normál méretű lapokra készül. A teljes változó magasságú longform canvas `project.height` méretű szeletekre bomlik; például egy 200%-os szekció két normál PDF-lapot is elfoglalhat. Egyetlen óriási PDF-page vagy raster továbbra sem készül.
- Sticky PDF-ben statikus longform elrendezésként exportálódik; a pinned viselkedés interaktív Present/HTML/LAN funkció.
- A v0.15 PDF média- és PDF import funkciók változatlanul megmaradtak.
- Régi projektek automatikus migrációja: hiányzó `longformHeightScale` → 1, `longformSticky` → false, elem navigáció → none.
- Verzió: 0.16.0.

---

# Pre'on 0.15.0 – PDF support

- Natív PDF asset támogatás: `.pdf` fájlok importálhatók a Média / PDF importálása paranccsal, drag & droppal és az Assets panelből.
- A PDF egy prezentációs médiaelem marad, nem szerkeszthető PDF-dokumentum: az oldalak vizuálisan jelennek meg a dián.
- Többoldalas PDF-nél kiválasztható az aktuális oldal; előző/következő oldalgomb és közvetlen oldalszámmező is elérhető.
- A PDF oldal ugyanazt a frame/crop logikát kapta, mint a képek: contain/cover/fill, X/Y pozíció, zoom, keret, sarokkerekítés és media mask.
- Többoldalas PDF egyetlen lépésben külön diákká importálható. Minden létrehozott dia ugyanazt az eredeti PDF assetet használja, csak az oldalszám tér el.
- Az Assets panel PDF-kártyájáról bármikor újra indítható az „oldalak külön diákként” import.
- Editor/thumbnail módban kisebb PDF raster készül a gyorsabb munkához; HTML/LAN export nagyobb felbontású export-only rastert használ. A `.preon` projektbe ezek a preview/export PNG-k nem kerülnek bele.
- A PDF preview cache korlátozott méretű, az exporthoz készülő nagy felbontású raszterek nem maradnak a cache-ben.
- PDF exportnál a beágyazott PDF-oldalak csak az éppen készülő kimeneti oldalhoz renderelődnek nagy felbontásban, így hosszú PDF-anyag importálása nem készít előre minden oldalból nagy PNG-t.
- One Slide / Longform PDF export továbbra is szándékosan oldalanként működik: egy látható szekció = egy normál PDF-oldal. Nem készül egyetlen óriási PDF-lap.
- Új npm függőség: `pdfjs-dist` a helyi/offline PDF-oldal rendereléshez. Az első v0.15 indításkor az `INDITAS.command` új dependency cache-t hoz létre.
- Verzió: 0.15.0.

---

# Pre'on 0.14.0 – Workflow & One Slide polish

- Javítva a GLB 3D modellek önálló HTML exportja: a használt `.glb` modellek desktop HTML exportnál beágyazódnak az exportált HTML-be, ezért `file://` megnyitáskor sem vesznek el külső fájl/CORS betöltési probléma miatt. A LAN megosztás továbbra is kiszolgált asset-útvonalat használ.
- One Slide / Longform globális objektum-hit-test: a szekcióhatáron átlógó objektum a látható részén a szomszédos szekció területéről is kijelölhető. Az objektum továbbra is egyetlen tulajdonos szekcióhoz tartozik.
- Több dia kijelölése: `Shift` = tartomány, `Cmd/Ctrl` = egyenként hozzáadás/elvétel.
- A kijelölt diák csoportosan húzhatók és átrendezhetők, szekcióba tehetők vagy szekción kívülre mozgathatók; a csoport belső sorrendje megmarad.
- Több kijelölt dián egyszerre állítható a Master, Hidden állapot, Transition, háttér öröklése, háttérszín, háttér kitöltése és közös kép/videó háttér. Eltérő értékeknél `Vegyes / Mixed` állapot látszik.
- A kijelölt diák egyszerre duplikálhatók és törölhetők; többes kijelölésnél `Cmd/Ctrl+D` és Delete/Backspace is kezeli a dia-csoportot, ha nincs objektum kijelölve.
- A One Slide PDF működése szándékosan változatlan: egy látható longform szekció = egy PDF-oldal; nem készül egyetlen óriási PDF-lap.
- Verzió: 0.14.0.

---

# Pre'on 0.13.1 – Hotfix

- Javítva az Arrow alakzat HTML/LAN exportgeometriája: most megegyezik az editor, a rajzolási preview és a Present Mode nyílformájával.
- One Slide / Longform módban a szekcióhatáron áthúzott elemek Smart Guide / Snap rendszere már a teljes közös vertikális workspace elemeit, guide-jait és grid-horgonyait figyelembe veszi.
- One Slide PDF export: **egy longform szekció = egy PDF-oldal**, de az oldalankénti rasterizálás a közös longform vásznat szeleteli, ezért a szekcióhatáron átlógó objektumok a következő oldalon is folytatódnak. Nem készül egyetlen óriási PDF-oldal, így elkerülhető a nagy raszterek miatti memória- és PDF-megjelenítő instabilitás.
- A longform editor és Present Mode szekciótartalmai átlátszó rétegen futnak a közös háttérréteg fölött, így egy szekció háttere nem takarja el az előző szekcióból átlógó elemeket.
- Verzió: 0.13.1.

---

# Pre'on 0.13.0

## Toolbar és alakzatok

- A Rectangle / Ellipse / Line külön toolbar eszközök helyett egyetlen lenyíló **Shape** eszköz készült.
- A Shape gomb ikonja mindig az aktuálisan kiválasztott alakzatot mutatja.
- Új alakzatok: lekerekített téglalap, háromszög, csillag, sokszög és nyíl.
- A teljes alakzatkészlet: Rectangle, Rounded Rectangle, Ellipse, Triangle, Star, Polygon, Line, Arrow.
- Az új shape-ek támogatják a meglévő color / gradient / image-GIF / video fill rendszert.
- Az alakzatrajzolás preview-ja követi az aktuális shape formáját.
- A Képkeret rajzolása külön négyzet + X ikont kapott.
- A Dinamikus oldalszám kikerült az alap toolbarból; a funkció és a Workspace-ből való kézi visszahelyezés megmaradt.
- Az Egy dia és Folyamatos nézet ikonok a felhasználói referencia alapján újrarajzolva.

## One Slide / Longform

- Új projektmód: `slides` / `longform`.
- View menüből elérhető a **One Slide / Longform**.
- Longform szerkesztőben a meglévő diák hézag nélküli függőleges szekciókként jelennek meg.
- A szekcióhatárok nem klippelik az elemeket; az objektumok vizuálisan átérhetnek a következő szekcióba.
- Szekciók közötti drag & drop megtartja a globális vizuális pozíciót és átadja az elemet a cél szekciónak.
- A cross-section rétegsorrend a szekció sorrendjéhez kötött, nem változik attól, melyik szekció aktív.
- A szekciók külön hátterei a közös longform canvas mögött renderelődnek.
- Present Mode longform projektnél egy függőlegesen görgethető teljes oldalt használ.
- HTML export longform projektnél egyetlen scrollozható oldalt generál.
- LAN megosztás automatikusan ugyanazt a longform HTML renderert kapja.
- A teljes longform oldal külső széle továbbra is klippel a tényleges prezentációs területre; csak a belső szekcióhatárokon lehet átlógni.
- Hidden slide-ok exportnál továbbra is kiesnek, longform módban a helyük is összezár.

## Kompatibilitás és verzió

- Régi projektek `presentationMode` nélkül automatikusan `slides` módba migrálódnak.
- Régi toolbarok Rectangle / Ellipse / Line elemei egy Shape gombbá migrálódnak.
- A régi v0.12 alaptoolbar oldalszám gombja eltűnik, de a v0.13-ban kézzel visszatett oldalszám gomb perzisztens marad.
- Verzió: 0.13.0.
