# Pre’on v0.22.5

A v0.22.5 egy célzott hotfix. A Presenter Időkeret/Deadline node-jainak alsó vezérlősora most valóban a widgeten belül marad, a macOS natív menüikonok pedig 18 px-es raszter helyett vektoros forrásból készített Retina felbontású képeket használnak.

## v0.22.5 javítások

- **Időkeret:** a Start / Reset gombok nem vágódnak le a node alján.
- **Deadline:** ugyanaz a belső layout-javítás vonatkozik a határidő mezőre és Törlés gombra is.
- Kis node-oknál a vezérlők kompaktabbak, keskeny node-nál pedig az időkeret inputja külön sorba törhet.
- **macOS menüikonok:** 36×36 px Retina PNG-k, vektoros SVG forrásból; vizuálisan a Pre’on jelenlegi vékony vonalas UI-ikonjaihoz igazítva.
- Az SVG forrásfájlok is a csomag részei, hogy később a saját végleges ikonrendszer gyorsan behelyettesíthető legyen.

# Pre’on v0.22.4

A v0.22.4 a Presenter használhatósági javítása és a macOS menü vizuális egységesítése. A Presenter modulok most elrejthetők és visszaadhatók, az időzítő vezérlőgombjai mindig hozzáférhetők, a natív macOS menü pedig Apple rendszerikonok helyett Pre’on-stílusú saját ikonokat használ.

## v0.22.4 újdonságok

- **Presenter modulok elrejtése:** minden node fejlécén × gomb; a **Modulok** menüből bármikor visszakapcsolható.
- A modulok láthatósága és elrendezése projektenként helyben megmarad. Preset vagy Reset visszahozza a teljes alapmodulkészletet.
- **Időkeret / Deadline vezérlők:** az input, Start, Reset és Törlés gombok külön, fixen látható alsó vezérlősávban maradnak; a kijelzett idő csak a fennmaradó területet használja.
- Az idő kijelzése valódi mért szövegszélességből skálázódik, ezért nincs korai, mesterséges növekedési plafon.
- **macOS natív menü:** a kapcsolók pipái megmaradnak, a normál parancsok viszont a Pre’on jelenlegi line-icon világára épülő saját menüikonokat kapnak az Apple alapikonok helyett.
- **Slideshow:** a Layers és Properties helyeken is a külön, két egymásra helyezett képet jelölő ikon jelenik meg.

# Pre’on v0.22.3

A v0.22.3 a jegyzet- és Presenter munkafolyamat finomítása. A Text Note most már formázott, hosszú szöveges jegyzetként használható saját jobb klikkes formázómenüvel; a Presenter időmoduljai a widget méretével együtt folyamatosan skálázódnak; a macOS natív menüben újra látszanak az állapotpipák és a támogatott natív ikonok. A Slideshow külön, két egymásra helyezett képet ábrázoló ikont kapott.

## v0.22.3 újdonságok

- **Rich Text Note:** félkövér, dőlt, aláhúzott, áthúzott, szövegszín, kiemelés, címsor/bekezdés, betűméret, igazítás, lista, behúzás és formázás törlése.
- A formázás a kijelölt szövegre a **jobb klikkes jegyzetmenüből** alkalmazható; a ⌘B / ⌘I / ⌘U billentyűparancsok is használhatók.
- A formázott jegyzet biztonságosan tisztított HTML-ként mentődik, miközben plain-text fallback is készül.
- A **Presenter gombjai és mezői** rugalmasan törnek, így nem lógnak ki a kisebb node-okból.
- A **Pontos idő / Időkeret / Deadline** számok mérete automatikusan követi a node szabad méretét, fix felső fontméret-limit nélkül.
- A Presenter nyolcirányú resize fogói nagyobb, könnyebben megfogható területet kaptak.
- **macOS natív menü:** a kapcsolókhoz/radio-szerű választásokhoz visszakerültek a pipák; az egyszerű parancsoknál natív macOS ikonok jelennek meg, ahol a rendszer API támogatja.
- **Slideshow ikon:** a sima Image ikontól eltérő, két egymásra helyezett képkeretes jelölés.

# Pre’on v0.22.2

A v0.22.2 a v0.22.1 Presenter- és jegyzetrendszerének használhatósági javítása. A Presenter widgetek teljes modulmérete minden oldalról és sarokból átméretezhető. macOS-on a hagyományos alkalmazásmenük natív rendszer-menüsorként jelennek meg, míg Windows/böngésző alatt a beépített menüsor marad. A Note háttérszíne külön állítható és alapból is jobban elkülönül a diától. A jegyzetek az Egy dia és Folyamatos nézetben a dia mellett jelennek meg, One Slide/Longform nézetben pedig az aktuális szekcióhoz igazodó dokkolt jegyzetkártya használható.

# Pre'on v0.22.1

A v0.22.1 a Presenter Workflow második köre: a jegyzet már nem „második dia”, hanem választható **Text Note / Visual Note** kártya, a HTML Presenter pedig szabadon rendezhető és méretezhető widget-workspace.

## v0.22.1 újdonságok

- **Nézet / View → Előadói jegyzetlap** továbbra is alapból kikapcsolt.
- A Folyamatnézetben a dia mellett külön jegyzetkártya jelenik meg, de a jegyzet **nem 16:9-hez kötött**.
- Alap jegyzetméret: **900 × 1200, álló 3:4**; a kártya jobb alsó sarkából szabadon átméretezhető.
- Diánként választható **Szöveges** és **Vizuális** jegyzet.
- A Szöveges jegyzet egy saját scrollos, folyamatos szövegfelület: több ezer karakter sem növeli szét a Flow sort és nem lóg rá a következő diára.
- A Vizuális jegyzeten továbbra is használhatók a normál Pre'on vászoneszközök.
- A jegyzetkártya megjelenése szándékosan eltér a diától: álló forma, lekerekített jegyzetlap, NOTE jelölés és külön háttér.
- A HTML Presenter moduljai – aktuális dia, következő dia, notes, vezérlés, óra, időkeret és deadline – **szabadon mozgatható és méretezhető widgetek**.
- A Presenter elrendezés projektenként automatikusan mentődik; Standard / Notes Focus / Timer Focus preset és Reset is van.
- Hosszú Text Note esetén a Presenter Next/Prev először a jegyzeten belül lapoz.
- Új felső **Prezentáció** menü: csak két exportmód van, hogy az export ne legyen túlbonyolítva.
  - **Standard HTML:** egyszerű közönségexport, `index.html`, jegyzetek nélkül.
  - **HTML + Presenter:** külön `presenter.html` + közönségprezentáció, az előadói jegyzetekkel.
- One Slide / Longform sticky dinamikus oldalszám végállapota megerősítve: a végén az utolsó szám marad, nem `1`.
- A v0.22.0 videó Start/End, alapból kikapcsolt videóvezérlő, Presenter média-kapcsolat és időzítők megmaradtak.

## v0.21.3 köztes verzió

- Bevezette a per-slide Presenter Notes Board adatmodellt és a Nézet kapcsolót.
- Első körös One Slide dinamikus oldalszám-követést adott.
- A v0.22.0 ennek a jegyzetfelületét alakítja át teljes, folyamatnézeti artboard workflow-vá, és erre építi a HTML Presenter rendszert.

## v0.21.2 újdonságok

- Önálló Slideshow elem, egy dián akár több példánnyal.
- Több kép hozzáadása, eltávolítása és drag & drop sorrendezése.
- Automatikus indulás dia betöltésekor vagy kattintásos indítás.
- Opcionális kattintásos play/pause és loop.
- Állítható képenkénti idő, Cut vagy Fade váltás és külön áttűnési idő.
- Editorban helyi Preview.
- Cover / Contain / Fill, tartalompozíció, zoom, maszk, keret és sarokkerekítés.
- Present, HTML és LAN lejátszás; PDF-ben stabil első képkocka.
- Meglévő slideshow-ra több képfájl egyszerre is ráhúzható.
- A Slideshow gomb a meglévő workspace-ek ikonsorában automatikusan megjelenik az Image után, ha az Image eszköz eddig is látható volt.

## v0.21.1 újdonságok

- Saját dinamikus jobb klikk menü vászonhoz, szöveghez, alakzathoz, médiához, multi-selecthez és dia-bélyegképhez.
- Settings → Jobb klikk: profilok, sorrend, elválasztók, almenük, teljes parancskönyvtár és alaphelyzet-visszaállítás.
- A helyzetben nem használható parancsok automatikusan el vannak rejtve.
- A közvetlen szövegszerkesztés natív karakter-szintű context menüje megmarad.

## v0.21.0 újdonságok

- Színpipetta + Formázáspipetta a felső eszköztárban.
- Több kijelölt textbox közös tipográfiai formázása Vegyes állapotkezeléssel.
- Közös Effektek panel: Drop Shadow, Blur és Glow.
- Stílus másolása / beillesztése.
- Select Same az aktív dián típus, szín, stílus, font vagy fontméret alapján.
- Replace Font a Text Overview panelben, teljes prezentáció + master + Text Style hatókörrel.
- Az Effects a Present/PDF és HTML/LAN kimenetben is megmarad.

## Korábbi Text Overview / resize fejlesztések

## v0.20.8 valtozasok

- Pontosabb text overflow meres: a + csak valodi tulcsordulasnal jelenik meg.
- Box / Scale Text modvaltaskor a textbox merete es a meglvo tordeles valtozatlan marad.
- Scale Text modban a sarokfogopontok aranyosan meretezik a dobozt es a szoveget.
- A kijelolt textbox jobb oldalan kozepen uj gyors Box / Text valtoikon van.
- A Text Overview az Assetek elotti, utolso elotti jobb oldali panel.
- A Text Overview folyamatos proofing-nezetet kapott finom elvalasztokkal es automatikus magassagu szovegmezokkel.

- Uj **Szovegek / Text Overview** panel az osszes dia-szovegdoboz egy helyen torteno attekintesehez es szerkesztesehez.
- Find & Change / Change All a teljes prezentacio szovegeiben.
- Text overflow jelzes kis `+` ikonnal a panelen es a textbox jobb also sarkaban.
- A dinamikus szovegmezok a panelen read-only modban jelennek meg.

## Gyors indítás fejlesztéshez

- macOS: `INDITAS.command`
- Ez fejlesztői indítás, ezért Terminal ablakot használ.
- A tesztelőnek vagy végfelhasználónak **nem ezt** kell átadni.

## Kész macOS app build

1. Futtasd a `BUILD_MAC.command` fájlt.
2. A script elkészíti az önálló `.app`-ot és a `.dmg` telepítőképet.
3. A kész fájlok a `RELEASE/macOS` mappába kerülnek.
4. Tesztelésre általában a `.dmg`-t érdemes elküldeni.

A Finderből indított kész `Pre'on.app` nem használ Node.js-t, npm-et vagy Terminal ablakot. Aláírás/notarizálás nélkül egy másik Mac Gatekeeper figyelmeztetést adhat; ez a későbbi terjesztési/aláírási kör feladata.

## Kész Windows app build

Windows gépen futtasd a `BUILD_WINDOWS.bat` fájlt.

A build gépen szükséges:
- Node.js LTS + npm
- Rust / Cargo
- Microsoft Visual Studio Build Tools, `Desktop development with C++` workload és Windows SDK
- WebView2 Runtime a legtöbb modern Windows 10/11 gépen eleve megtalálható

A script:
- szükség esetén telepíti az npm csomagokat;
- release Tauri buildet készít;
- NSIS `Setup.exe` telepítőt generál;
- a kész telepítőt a `RELEASE\Windows` mappába másolja;
- a nyers release EXE-t `Preon-portable.exe` néven is kimásolja, ha elkészült.

A tesztelőnek elsődlegesen a **Setup EXE**-t add át. Neki nem kell Node.js, npm vagy Rust.

## v0.20.6 változások

- **LAN Live Preview:** egyszer kell megosztani; a megnyitott böngészős nézet automatikusan frissül a Pre'on módosításaira.
- One Slide / Longform mód és 3D GLB tartalom is bekerül a live LAN snapshotba.
- A nyelv és téma váltása már csak a Beállításokban található.
- Téma módok: **Világos / Sötét / Automatikus**. Az Automatikus a macOS / Windows rendszer témáját követi.
- A világos mód fix paletta; csak a **sötét mód világossága** állítható.
- A Properties panel szekciói első induláskor csukva vannak, utána megjegyzik a nyitott/csukott állapotot.
- Az app ikon a mellékelt SVG logóból újragenerált nagy felbontású ICNS/ICO/PNG készletet használ, Pre'on krémszínű háttérrel.
- A békás splash minimum megjelenési ideje továbbra is **3 másodperc**.
- A `BUILD_MAC.command` és `BUILD_WINDOWS.bat` release build folyamat változatlanul megmarad.

## Fontos One Slide szabály

A PDF export One Slide esetén sem készít egyetlen óriási PDF-oldalt. A hosszú prezentáció normál prezentációméretű lapokra van szeletelve.

## Megjegyzés a build környezetről

A macOS csomagot macOS-en, a Windows csomagot pedig Windows gépen érdemes buildelni. A platformonkénti build scriptet közvetlenül az adott rendszeren futtasd.

A részletes verziótörténet a `CHANGELOG.md`, az ellenőrzések a `QA_REPORT.txt` fájlban találhatók.