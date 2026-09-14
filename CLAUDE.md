# Todo App – CLAUDE.md

## Projektübersicht

Minimalistische Single-Page Todo-App. Kein Backend, kein Server, kein Login. Alles läuft im Browser via localStorage. Exportierbar als JSON.

### Kernidee

Der Fokus liegt auf **Geschwindigkeit und Reibungslosigkeit** beim Anlegen und Verwalten von Todos — nicht auf Feature-Breite.

**Das Pool-Konzept:** Todos leben in einem persistenten Pool. Man wählt aus diesem Pool, was aktiv bearbeitet werden soll, und baut sich eine fokussierte Focus-Liste (View: "Focus", vormals "Today"). Der Pool eignet sich auch für wiederkehrende Aufgaben, weil ein Todo nicht zwingend "erledigt" werden muss — man kann es einfach wieder zurück in den Pool legen.

**Kein Tagesreset mehr.** Die Focus-Liste ist nicht an einen Kalendertag gebunden und wird nicht mehr automatisch um 04:00 Uhr geleert. Sie bleibt bestehen, bis sie manuell leergeräumt wird (durch Abhaken oder Zurücklegen in den Pool).

**Die zwei Abhak-Modi** sind der zentrale Unterschied zu normalen Todo-Apps:
- **Done** — Todo ist wirklich erledigt, wandert ins Archiv (`completedAt` gesetzt).
- **Done for today** — Für den Moment fertig, aber das Todo bleibt im Pool. Nächste Mal wieder verfügbar. Ideal für Routinen und wiederkehrende Tasks. (Name bewusst beibehalten, obwohl kein Tagesbezug mehr besteht.)

> **Keine Sessions/Achievements.** Es gibt kein Tracking mehrtägiger Focus-Zeiträume. Jedes Todo trägt einfach sein eigenes `completedAt`/`workLog` — der Kalender liest diese Timestamps direkt und zeigt pro Tag genau das, was an diesem Tag erledigt/bearbeitet wurde. Kein Reset, kein Session-Start/-Ende, keine Range-Highlights.

**Design-Philosophie:** Stylisch, aber nicht überladen. Jedes Feature muss sich rechtfertigen. Die App soll sich anfühlen wie ein gutes Notizbuch — immer griffbereit, nie im Weg.

**Personalisierung ohne Komplexität:** Zwei Farben steuern das gesamte visuelle System — Background und Ink. Aus der Ink wird automatisch eine dunklere Variante (`--ink-dark`) für Highlighting abgeleitet. Dimming erfolgt über Opacity (z.B. 0.35), nicht über eine eigene Farbvariante. Dazu wählbarer Corner-Radius (rund oder eckig) und Priority-Shadow-Stil (dark/mono). Mehr Optionen gibt es nicht — das ist bewusst.

### Oberstes Designprinzip: Nur vier Farbwerte

Das gesamte UI verwendet ausschließlich diese vier Werte — keine Ausnahmen:

| Token | Bedeutung |
|---|---|
| `--bg` | Hintergrundfarbe (vom Nutzer gewählt) |
| `--ink` | Hauptfarbe für Text und Elemente (vom Nutzer gewählt) |
| `--ink-dark` | Berechnete dunklere Ink-Variante für Highlighting/Akzente |
| `opacity` | Dimming über Transparenz (z.B. `0.35`), niemals als eigene Farbvariante |

**Verboten:** Eigene Hex-Werte, `rgba()`-Zwischenwerte, neue CSS-Variablen für Farben, Grau-Töne, Weiß, Schwarz oder jede andere Farbe die nicht aus diesen vier Werten ableitbar ist. Jede neue Farbe im CSS ist ein Fehler.

## Tech Stack

| Bereich | Entscheidung |
|---|---|
| Build Tool | Vite |
| Framework | Vue 3 + Composition API |
| State | Pinia + `pinia-plugin-persistedstate` |
| Storage | localStorage (JSON-Serialisierung) |
| Import/Export | Native File API (`showSaveFilePicker` / `showOpenFilePicker`) |
| Styling | Plain CSS / CSS Custom Properties |
| Kalender | `v-calendar` (Vue-Plugin) |
| Icons | `@lucide/vue` |
| Routing | `vue-router` |

## Datenmodell

```typescript
interface Tag {
  id: string        // uuid() mit Math.random()-Fallback für HTTP
  label: string
}

interface Todo {
  id: string            // uuid() mit Math.random()-Fallback für HTTP
  title: string
  tags: string[]        // Tag-IDs
  createdAt: string     // ISO-Timestamp
  inToday: boolean
  completedAt?: string  // ISO-Timestamp → landet im Archiv
  workLog: string[]     // ISO-Timestamps: je ein Eintrag pro "Done for today"-Tag
}

interface AppState {
  todos: Todo[]
  tags: Tag[]
}
```

> **Date-Feature.** Der System-Tag `date` (intern weiterhin die ID `__loop__`, nur das Label wurde von "loop" umbenannt) gibt einem Todo optional ein `loopInterval`-Objekt mit `mode: 'once' | 'loop'`. `'once'` ist ein einmaliges Fälligkeitsdatum (`startDate`), `'loop'` die bestehende Wiederholung (`unit`/`count`/`startDate`). Ein fälliges Todo (once ab seinem Datum, loop nach der bisherigen Logik) wird automatisch nach Focus geschickt, genau wie bisher — `'once'` bleibt dabei fällig (taucht bei Rückgabe in den Pool wieder auf), bis es tatsächlich erledigt wird.
>
> **"updates when done"-Toggle.** Optionaler Loop-Todo-Schalter (`loopInterval.rescheduleFromCompletion`, Default `false`, kein Effekt bei `'once'`/`weekdays`): lässt `doneForToday` den `startDate` auf den Abhak-Zeitpunkt verschieben, statt ihn fix zu lassen — die nächste Fälligkeit zählt dann ab dem tatsächlichen Abhaken. Checks blenden den Toggle über `:allow-reschedule="false"` aus (`CheckSchedule` hat kein passendes Feld dafür).

> **Projekte wurden entfernt.** Das Datenmodell kennt keine `Project`-Entität mehr. Tags sind das einzige Kategorisierungs-Feature.

> **Checks.** Eigene, bewusst kleinere Entität neben Todo — Hintergrund-Reminder statt vollwertiges Todo, kein Archiv, keine Tags, kein `once`. Store: `src/stores/checks.ts`.
> ```typescript
> interface CheckSchedule {
>   unit: LoopUnit          // wie LoopInterval, aber immer gesetzt — kein 'once'-Modus
>   count?: number
>   weekdays?: number[]
>   startDate: string       // ISO-Datum
> }
> interface Check {
>   id: string
>   title: string           // max. CHECK_TITLE_MAX_LENGTH (50) Zeichen
>   schedule: CheckSchedule
>   createdAt: string
>   completedDates: string[]  // ISO-Daten (YYYY-MM-DD), ein Eintrag pro abgehaktem Fälligkeitstag
>   deletedAt?: string        // Soft-Delete, gleiches Prinzip wie Todo.deletedAt
> }
> ```
> Fälligkeit wird nicht wie bei Loop-Todos in einer `inToday`-Flag festgehalten, sondern rein aus `schedule` live berechnet (`todayChecks` im Store) — ein Check hat kein "aus Focus entfernen", das rückgängig gemacht werden könnte, also keine `focusAddedAt`/`processedToday`-Buchführung nötig. Der Store hält dafür einen reaktiven `today`-Anker (`refreshToday()`), den App.vue an denselben drei Stellen wie `runLoopSchedule` aufruft (Mount, Mitternacht, Tab-Refokus) — ein `computed`, das nur `new Date()` liest, würde beim Tageswechsel sonst nie neu laufen. "Verpasst" (fällig laut `schedule`, aber nicht in `completedDates`) wird nirgends extra gespeichert, sondern von dem, der es braucht (Kalender-Tagesdetail, künftiges Analyse-Feature), aus `schedule` + `completedDates` abgeleitet.
>
> **UI:** `Focus.vue` zeigt die fälligen Checks (`todayChecks`) unterhalb der Todo-Liste — kein Trenner, nur Abstand (`.checks-section`, 66px). Einspaltig untereinander (bewusst nicht mehrspaltig — dafür ist `CHECK_TITLE_MAX_LENGTH` auch nicht mehr auf "zwei nebeneinander" gedeckelt, siehe oben). Jede Zeile: kleine eckige Checkbox (Radius an Rounded/Square gekoppelt, aber auf 3px gedeckelt statt voll `var(--radius)` — sonst wird die kleine Box im Rounded-Modus komplett rund; dazu ein dezenter Drop-Shadow wie bei den Todo-Cards) + reiner Text ohne Rahmen (anders als Tags/Todos), Font `var(--font-mono)`. Der ganze Pill ist blass (`opacity: 0.55`, abgehakt `0.3`, Hover `0.9`) statt durchgestrichen. Klick auf den Text öffnet `CheckModal.vue` (Add/Edit, wiederverwendet `LoopPicker` mit `:allow-once="false"`; auf Phones oberes Drittel statt zentriert, auf Desktop/Tablet 460px breit für die einzeilige Presets-/Weekdays-Zeile) zum Umbenennen/Neu-Kalibrieren/Löschen. Settings-Toggle `checksEnabled` (Theme-Store) blendet das gesamte Feature inkl. Kalender-Dot/-Sektion aus. `Calendar.vue` zeigt abgehakte Checks als eigenen (gedimmten) Dot-Typ und eigene Sektion am Ende der Tages-Detail-Liste.

## Projektstruktur

```
todo-app/
├── src/
│   ├── components/
│   │   ├── TodoCard.vue         // Karte mit Swipe-Gesten, Tag-Menü, Check-Menü (Focus)
│   │   ├── LoopPicker.vue       // Recurrence-Picker (once/loop/weekdays/custom), von Todo + CheckModal genutzt
│   │   ├── CheckModal.vue       // Add/Edit-Modal für Checks
│   │   ├── ColorPicker.vue      // HSV-Farbwähler für Settings
│   │   └── SettingsModal (entfernt – Settings ist eigene Route/View)
│   ├── views/
│   │   ├── AllTodos.vue         // Hauptliste (filtert: aktiv + nicht in Focus)
│   │   ├── Focus.vue            // Focus-View (todayTodos, zwei Abhak-Modi, Checks-Zeile darunter)
│   │   ├── Calendar.vue         // Kalender-View (v-calendar, workLog-Dots + Checks-Dots, Tages-Detail)
│   │   └── Settings.vue         // Farb-Theme, Corner-Style, Import/Export
│   ├── stores/
│   │   ├── todos.ts             // Pinia Store: Todos, Tags
│   │   ├── checks.ts            // Pinia Store: Checks (siehe Checks-Abschnitt oben)
│   │   └── theme.ts             // Pinia Store: Farb-Theme + gespeicherte Themes
│   ├── composables/
│   │   ├── useStorage.ts        // Import/Export Logik (File API + Fallback)
│   │   ├── useTheme.ts          // applyTheme() – CSS-Custom-Properties setzen
│   │   └── useTodoFonts.ts      // Font-Zuweisung: deterministic hash, kein Duplikat nebeneinander
│   ├── styles/
│   │   ├── base.css             // Resets, Design Tokens, Scrollbar
│   │   ├── fonts.css            // @font-face für alle 17 Schriftfamilien (./fonts/)
│   │   ├── layout.css           // Grid-Layout, Sidebar, Head, Content
│   │   ├── mobile.css           // Mobile Bottom-Nav, Tag-Panel, Breakpoints
│   │   └── calendar.css         // v-calendar Overrides
│   ├── styles/fonts/            // TTF-Dateien, benannt nach Schema FontName-Style.ttf
│   ├── dev/
│   │   └── seed.ts              // Dev-only: befüllt localStorage mit Dummy-Todos
│   ├── router/
│   │   └── index.ts             // Hash-Router: /, /all, /focus, /calendar, /settings
│   ├── App.vue                  // Shell: Sidebar, Head, Nav, Mobile-Tag-Panel
│   └── main.ts
├── index.html
├── vite.config.ts
└── package.json
```

## Kalender-View

`Calendar.vue` nutzt das `v-calendar`-Plugin und zeigt eine Monatsübersicht. Auf Tagen mit Aktivität erscheinen farbige Dots:

- **Ausgefüllter Dot** – Todo wurde an diesem Tag als *Done* abgehakt (`completedAt` fällt auf diesen Tag).
- **Umriss-Dot** – Todo hatte an diesem Tag einen *Done for today*-Eintrag (Datum in `workLog[]`).

Ein Klick auf einen Tag öffnet eine Detail-Liste der an diesem Tag erledigten (`completedAt`) und bearbeiteten (`workLog`) Todos, unter dem normalen Tages-Label (z.B. "Tuesday, July 7, 2026"). Kein Konzept von mehrtägigen Zeiträumen — jeder Tag steht für sich. Die Overrides für v-calendar (Farben, Abstände) stehen in `src/styles/calendar.css`.

Die Liste selbst ist nicht nach Done/Done-for-today gruppiert (das bleibt nur als ✓✓/✓-Icon pro Zeile erhalten), sondern nach **Priority vs. Rest** — Priority ist schon überall sonst in der App das zentrale "das war wichtig"-Signal, und beantwortet im Rückblick eher "habe ich das Wichtige geschafft" als die eher buchhalterische Done/Worked-on-Unterscheidung. Titel laufen in der Kalender-eigenen Fancy-Font (`--font-playful`), nicht in der zufälligen Todo-Font aus AllTodos/Focus — letzteres wurde kurz ausprobiert und wieder verworfen.

## Typografie – Zufällige Schriftarten pro Todo

Jedes Todo-Item bekommt beim Rendern eine Schriftart aus einem Pool von 17 Familien zugewiesen. Die Logik liegt in `src/composables/useTodoFonts.ts`:

- **Deterministic:** Der Font wird per Hash der Todo-ID bestimmt — gleiche ID → gleicher Font, stabil über Re-Renders.
- **Kein Duplikat nebeneinander:** Wenn zwei benachbarte Todos denselben Font bekämen, wird der zweite automatisch um einen Slot verschoben.
- **17 Schriftfamilien** (alle selbst gehostet in `src/styles/fonts/`): Aleo, Amarante, Bodoni Moda, Cardo, EB Garamond, Faustina, Karla, Lora, Manrope, Merienda, Merriweather, Montserrat, Patrick Hand, Roboto, Roboto Condensed, Roboto Slab, Sorts Mill Goudy.
- Dateibenennung: `FontName-Style.ttf` (z.B. `BodoniModa-Italic.ttf`). `@font-face`-Deklarationen in `src/styles/fonts.css`.

## Celebration-Animationen

Beim Abhaken eines Todos (Done oder Done for today, keine Unterscheidung) spielt eine kurze Full-Viewport-Hintergrund-Animation. Die Logik dafür liegt komplett im `<script>`-Block (nicht `<script setup>`) von `src/components/TodoCard.vue`.

> **Aktuell aktiv: die alten Partikel-Celebrations** (Herzen/Konfetti/Ballons/Feuerwerk, `bgHearts`/`bgConfetti`/`bgBalloons`/`bgFireworks`), nicht die unten dokumentierten Frame-SVG-Animationen (Cat/Whale/Penguin/Orca) — deren Bildwirkung hat sich noch nicht rund angefühlt, deshalb vorerst zurückgeswitcht. Die Frame-Mechanik (`playFrameCelebration`, `resolveCelebrationConfig`, `ALL_CELEBRATIONS`, der Pre-Completion-Teaser in `App.vue`) ist komplett stehen geblieben, nur `celebrateBackground`s eigener Aufruf und der Teaser-Watcher in `App.vue` sind auskommentiert — Rückschalten ist ein Zweizeiler an genau diesen beiden Stellen. Der Rest dieses Abschnitts beschreibt weiterhin die Frame-Mechanik selbst (Assets, Tiers, Sizing), unabhängig davon, welche der beiden Varianten gerade aktiv ist.

**Assets:** Jede Animation liegt als drei Breakpoint-Varianten (Desktop/Tablet/Phone, siehe unten) unter `src/assets/animations/svg/<name>_<breite>.svg` (+ optional GIF-Referenzen fürs Original unter `src/assets/animations/gif/<name>_<breite>.gif`), z.B. `cat-black_1920.svg`/`cat-black_810.svg`/`cat-black_486.svg`. `<breite>` ist die für diesen Tier exportierte Pixel-Breite (1920/810/486) — nicht bloß derselbe Export skaliert, sondern eigenständig für diese Auflösung gezeichnet, Frame-Anzahl/-Timing können sich zwischen Tiers deshalb unterscheiden. Aufbau je Datei: eine `<g class="f fN">` pro Frame, alle mit `visibility:hidden`, plus `@keyframes fN`/`animation: fN <dauer>s step-end infinite`, die die Frames nacheinander sichtbar schalten — ein klassischer "Sprite-Sheet-als-SVG"-Export (z.B. aus ezgif). Pfade haben Default-Fill `#000000`.

**Responsive Tiers:** `currentCelebrationTier()` in `TodoCard.vue` wählt anhand von `window.innerWidth` einen von drei Tiers — dieselben Breakpoints wie sonst überall in der App (700px, 1024px, siehe mobile.css/layout.css): `phone` (≤700px) → `_486`, `tablet` (≤1024px) → `_810`, `desktop` (>1024px) → `_1920`. Jede Celebration braucht alle drei Tiers, kein Single-Tier-Fallback.

**Cover statt Contain:** Jede Celebration füllt den kompletten Viewport (bzw. bei `verticalAnchor: 'bottom'` den Viewport abzüglich der mobilen Bottom-Nav) auf beiden Achsen aus, statt auf einer Achse zu passen und auf der anderen Leerraum zu lassen — Überstand wird vom Overlay (`overflow:hidden`) weggeschnitten, nie reingezoomt. `buildFrameOverlay` berechnet den Skalierungsfaktor selbst aus dem `viewBox` der jeweiligen SVG (`Math.max(viewportWidth/naturalWidth, viewportHeight/naturalHeight)`) und setzt Breite/Höhe/Position der `<svg>` in px — kein CSS `object-fit`/`background-size`, weil eine inline `<svg>` (nötig fürs Umfärben der Pfade) beides nicht bekommt.

**Eine neue Animation hinzufügen:**
1. Alle drei Breakpoint-SVGs nach `src/assets/animations/svg/<name>_1920.svg` / `_810.svg` / `_486.svg` legen.
2. Jede einzeln mit svgo verkleinern, dabei **`removeHiddenElems` deaktivieren** — sonst löscht svgo alle Frame-Gruppen, weil sie per Default `visibility:hidden` sind und erst per Keyframe sichtbar werden (Config-Beispiel siehe `celebrateCat`/`celebrateWhale`-Historie in der Git-Historie, Commit "svgo-Optimierung"). Faustregel: 40–60 % Ersparnis realistisch. **Fällt eine Datei trotzdem ungewöhnlich groß aus** (zweistellige MB, viel größer als andere Celebrations bei ähnlicher Frame-Zahl) — liegt fast immer an der Pfadanzahl pro Frame, nicht an der Frame-Zahl selbst: ein Export mit vielen kleinen Einzelformen pro Frame (Spritzer, Textur-Fragmente) statt weniger zusammengesetzter Pfade treibt die Dateigröße um Größenordnungen hoch (Beispiel: `orca-01`, 73 Frames aber ~217 Pfade/Frame statt der sonst üblichen ~10, 16 MB roh). `mergePaths` ist Teil von svgos Preset und fasst gleich gestylte Geschwister-Pfade pro Frame-Gruppe schon automatisch zusammen; reicht das nicht, zusätzlich `convertPathData: { floatPrecision: 0 }` überschreiben (ganzzahlige statt Sub-Pixel-Koordinaten — bei einer Viewport-füllenden Hintergrund-Animation nicht sichtbar, hat `orca-01` von 16 MB auf ~1,9 MB gebracht).
3. In `TodoCard.vue`s `ALL_CELEBRATIONS`-Map (`Record<CelebrationKey, CelebrationConfig>`) einen Eintrag ergänzen: `{ variants: { desktop, tablet, phone }, verticalAnchor? }`, wobei jeder Tier `{ importer: () => import('../assets/animations/svg/<name>_<breite>.svg?raw'), fallbackCycleMs }` ist — `fallbackCycleMs` ist die volle Zyklusdauer aus der `animation:`-Zeile in genau *dieser* Tier-Datei (z.B. `1.68s` → 1680; kann pro Tier variieren, siehe oben). `verticalAnchor` ist optional, `'center'` (Default) oder `'bottom'` — Penguin nutzt `'bottom'`, damit die Figur immer am unteren Viewport-Rand steht statt vertikal zentriert zu schweben/croppen.
4. Den Key auch in `CELEBRATION_KEYS` in `src/composables/useCelebrations.ts` ergänzen — das ist die einzige Stelle, die der Store (`sendToToday`, siehe unten) kennt, um eine Celebration zuzulosen.

**Warum kein `setTimeout` zum Entfernen:** Die Keyframes sind `infinite` (sie loopen selbständig weiter). `playFrameCelebration` begrenzt sie stattdessen per Web Animations API (`effect.updateTiming({ iterations: 1 })`) auf einen Durchlauf und wartet auf `animation.finished`, bevor das Overlay entfernt wird — ein reiner Timer würde bei geringer Verzögerung (Main-Thread-Jank) gegen den Loop-Restart racen und kurz das erste Frame nochmal aufblitzen lassen.

**Bundle-Größe:** Jede SVG wird per dynamischem `import(...?raw)` geladen (nicht statisch) — Rolldown packt sie dadurch in einen eigenen Chunk, der erst beim ersten Abspielen dieser Animation geladen und danach gecacht wird, statt das Hauptbundle aufzublähen.

**Welche Celebration ein Todo bekommt** wird nicht beim Abspielen zufällig gewählt, sondern einmal beim Senden nach Focus (`sendToToday` in `stores/todos.ts`) fest zugelost und in `Todo.celebration` gespeichert (`CelebrationKey`, Shuffle-Bag `drawCelebrationKey()` in `src/composables/useCelebrations.ts`, aktueller Pool: `blackCat`, `whale`, `penguin`, `orca`). Bleibt fix, solange das Todo in Focus ist; verlässt es Focus und kommt später wieder rein, wird neu gelost. `TodoCard.vue`s `ALL_CELEBRATIONS`-Map kennt nur noch, *wie* ein Key gerendert wird (SVG-Tiers/Anchor), nicht mehr die Zufallslogik selbst — die lebt bewusst im Store, damit sie keine Kopplung an SVG-/Animations-Code braucht. Ein alter, aus `CELEBRATION_KEYS` entfernter Key (z.B. die frühere, nicht-schwarze `cat`-Celebration) kann in bereits persistierten Todos noch als `Todo.celebration`-Wert stehen — `resolveCelebrationConfig` in `TodoCard.vue` fängt das ab und lost in dem Fall einen frischen, aktuell gültigen Key nach, statt gegen ein `undefined`-Config zu laufen.

**Pre-Completion-Teaser:** Solange in Focus das Done/Done-for-today-Menü einer Karte offen ist (`showMenu`), zeigt `showCelebrationTeaser(key)` bereits das erste Frame der für dieses Todo bereits fest zugelosten Celebration an — eingefroren (alle Frame-Animationen werden sofort nach dem Einfügen pausiert, bevor sie über Frame 0 hinaus laufen können) und blass über Opacity (`TEASER_OPACITY`, kein eigener Farbwert). Weil der Key am Todo hängt statt bei jedem Menü-Öffnen neu gewürfelt zu werden, zeigt jede Karte immer verlässlich *ihre eigene* Celebration — und `celebrateBackground(key)` beim tatsächlichen Abhaken spielt exakt das, was schon geteasert wurde. Ein `props.todo.celebration ?? drawCelebrationKey()`-Fallback (inkl. Nachtragen per `store.updateTodo`) fängt Alt-Todos ab, die `inToday` schon waren, bevor es dieses Feld gab.

## Entschiedene Design-Fragen

- **Kein Tagesreset mehr:** Die Focus-Liste (`inToday`) wird nicht mehr automatisch geleert und bleibt bestehen, bis sie manuell leergeräumt wird.
- **Dark/Light Toggle:** Keins. Fixes Design (eine Variante).
- **Todo-Erstellung:** Add-Input in App.vue (Main-Head), immer sichtbar. Enter speichert. Bei vorhandenen Tags öffnet sich eine inline Checkbox-Liste zur direkten Tag-Zuweisung.
- **Zusatzfelder:** Tags direkt im Add-Input. Klick auf den Todo-Titel in der Karte öffnet Tag-Menü + Text-Edit (siehe TodoCard.vue).
- **Mobile:** Vollständig responsive, mobile-first CSS.

## Abhaken in Focus – zwei Modi

- **✓ Done** – Setzt `completedAt`, Todo wandert ins Archiv.
- **◷ Done for today** – Fügt Timestamp zu `workLog[]` hinzu, setzt `inToday = false`. Todo bleibt im Pool.

## Keyboard-Shortcuts (nur Desktop, > 1024px)

Alle Shortcuts leben in **einem einzigen** globalen `keydown`-Listener in `App.vue` (bewusst, siehe unten). Unterhalb der Desktop-Breite ist der komplette Handler deaktiviert – kein Tab-Cycling, keine Einzeltasten-Shortcuts.

- **Tab / Shift+Tab** – kein Todo offen: togglet zwischen All und Focus (Calendar ist nicht Teil dieses Cycles, siehe **C**). Ein Todo offen: schaltet stattdessen zwischen Karten durch (`cycleOpenCard`), trägt eine laufende Bearbeitung auf die nächste Karte weiter.
- **C** – Calendar togglen, kehrt zum vorher aktiven Haupt-View (All/Focus) zurück (nicht hart auf Overview verdrahtet) – gleiches Muster wie **X**/Settings.
- **S** – Sort togglen (Datum ↔ A–Z). Nur Overview, sonst No-Op.
- **G** – Grid/List togglen. Nur Overview, sonst No-Op.
- **N** – Fokus ins Add-Todo-Feld ("new"). Overview + Focus.
- **T** – Fokus ins Tag-Input in der Sidebar. Nur Overview – Focus ist nicht filterbar, das gesamte Tag-/Filter-Menü ist dort ausgegraut und inert.
- **A** – All-Filter (löscht jeden aktiven Tag-/Prio-/Date-Filter auf einmal). Nur Overview.
- **P** – Prio-Filter togglen. Nur Overview.
- **D** – Date-Filter durchzyklen (default → hide → only → default, startet auf "hide"). Nur Overview, kein Todo offen. Ist ein Todo offen, bedeutet **D** stattdessen Delete (Overview) bzw. Remove from Focus (Focus) – siehe TodoCard.vue's onCardKeydown. Kein echter Konflikt: genau wie bei Tab (View- vs. Karten-Cycling) sind beide Zustände gegenseitig ausschließend.
- **X** – Settings togglen, kehrt zum vorher aktiven Haupt-View zurück (nicht hart auf Overview verdrahtet).
- **Escape** – schließt/blurt immer das, was gerade offen/fokussiert ist (Add-Todo-Input, Tag-Input, offene Karte, Swipe-Delete-Bestätigung).

Alle Einzeltasten-Shortcuts (S/G/N/T/A/P/L/X) greifen nicht, während in einem Textfeld getippt wird, während eine Karte offen ist, oder mit gedrückter Modifier-Taste (Cmd/Ctrl/Alt).

**Wichtig:** Tab-Cycling zwischen Views und Tab-Cycling zwischen Karten dürfen nie zwei unabhängige Listener sein – das hat früher zu einem Bug geführt, bei dem eine offen gebliebene Karte (unbemerkt durch einen einfachen Klick) das View-Wechseln per Tab dauerhaft blockiert hat, weil Karten-Cycling nie schließt, nur immer zur nächsten Karte springt. Außerdem schließt ein View-Wechsel (gleich wodurch ausgelöst) immer jede offene Karte und sichert eine laufende Bearbeitung – ein View darf beim erneuten Betreten nie etwas offen/halb editiert zeigen.

## Implementierungs-Phasen

| Phase | Inhalt | Geschätzte Zeit |
|---|---|---|
| Phase 1 | Vite + Vue 3 + Pinia Setup, Routing, Basis-Layout & Nav (mobile-first) | ~1h |
| Phase 2 | Datenmodell + Pinia Store + localStorage Persistenz | ~1h |
| Phase 3 | All-Todos View: Inline-Input, Liste, Sortierung, Filter, Edit-Mode | ~2h |
| Phase 4 | Today View + zwei Abhak-Modi + 4-Uhr-Reset | ~1.5h |
| Phase 5 | Tags (Bulk-Input + Edit + Farbe) + Projekte (Settings Modal) | ~1h |
| Phase 6 | Kalender View – zwei Dot-Typen, Tages-Detail-Liste | ~1.5h |
| Phase 7 | Import/Export (File API) | ~30min |
| Phase 8 | Styling / Polishing – responsive, minimalistisches fixes Design | ~2h |

## Branches

| Branch | Zweck |
|---|---|
| `main` | Aktuelles Design: Neo-brutalist, keine runden Ecken, Flächen statt Borders, kräftige Farben (Orange-Rot, Gelb, Teal), harte Drop-Shadows. Ehemals auf `design/poppy` entwickelt, per Fast-Forward-Merge übernommen. |

Das ursprüngliche minimalistische Design (Phase 1–8, vor dem Poppy-Redesign) ist über die Git-Historie weiterhin erreichbar (z.B. `git log` vor dem Merge-Commit, oder ein Tag darauf, falls gewünscht).

## Entwicklungshinweise

- **Paketmanager ist `pnpm`, nicht `npm`.** Es existiert nur eine `pnpm-lock.yaml`, keine `package-lock.json`. Installs/Updates also mit `pnpm add`/`pnpm install` ausführen.
- IDs werden via `uuid()` in den Stores erzeugt – `crypto.randomUUID()` mit `Math.random()`-Fallback, damit die App auch über HTTP (non-secure context) funktioniert.
- `pinia-plugin-persistedstate` übernimmt localStorage-Sync automatisch.
- File API: `showSaveFilePicker`/`showOpenFilePicker` mit Fallback auf `a[download]` / `<input type="file">`.
- Kein TypeScript-Strict erforderlich, aber Interfaces aus dem Datenmodell konsequent verwenden.
- **Scrollbars sind in dieser App niemals sichtbar.** Jeder scrollbare Container (`overflow-y: auto`/`scroll`) braucht `scrollbar-width: none;` plus `&::-webkit-scrollbar { display: none; }`. Gilt für neue scrollbare Bereiche genauso wie für bestehende (`.main-content`, `.sidebar`, `.mobile-tags-panel`, `.day-detail-scroll`).

## Arbeitsweise mit Claude

- **Nach jeder bedeutenden Änderung committen** – nicht zu lange sammeln. Bedeutend heißt: neues Feature, sichtbare UI-Änderung, Bugfix, Refactoring einer Komponente.
- Commit-Messages auf Deutsch oder Englisch, kurz und beschreibend.
- Auf `design/poppy` kann frei experimentiert werden – trotzdem regelmäßig committen, damit der Fortschritt nachvollziehbar bleibt.
- **Alle UI-Inhalte (Labels, Buttons, Menüeinträge, Platzhaltertexte) immer auf Englisch.** Keine deutschen Begriffe im Interface.
- **Browser-Devtools (Firefox MCP: Screenshots, Snapshots, evaluate_script etc.) nur auf explizite Aufforderung nutzen.** Der Nutzer testet visuelle Änderungen selbst und gibt Feedback – das spart ihm Tokens. Nach CSS/Layout-Änderungen also nicht eigenständig verifizieren, sondern die Änderung kurz beschreiben und auf Feedback warten.
