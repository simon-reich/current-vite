# Todo App – CLAUDE.md

## Oberstes Arbeitsprinzip: Code reusable halten, Single Source of Truth

Dieselbe Logik/dasselbe Markup darf nicht an mehreren Stellen im Code parallel existieren, wenn es dasselbe Konzept ausdrückt (z.B. eine Tag-Filter-Liste, eine Date-List-Nav). Ziel: eine Änderung an so einem Konzept lässt sich an **einer** Stelle machen, nicht an mehreren verstreuten Kopien, die man händisch synchron halten muss. Vor dem Bauen von etwas Neuem prüfen, ob eine bestehende Komponente/Funktion/ein bestehendes Pattern wiederverwendet statt dupliziert werden kann.

Das ist unabhängig davon, ob Code aktuell benutzt oder nur auskommentiert/inaktiv ist – auskommentierter Code für "brauchen wir vielleicht später wieder" ist völlig in Ordnung (siehe z.B. die Frame-Celebrations, aktuell auskommentiert zugunsten der Partikel-Celebrations, oben im Celebration-Abschnitt). Das Problem ist ausschließlich echte Duplikation derselben Sache an mehreren Stellen im aktiven Code.

**Gilt explizit auch fürs Styling, nicht nur für Markup/Logik.** Ein wiederkehrendes Design-Muster (z.B. ein Abstand zwischen mehreren nebeneinander sitzenden Icons) wird an **einer** Stelle definiert und von jeder Stelle, die dieses Muster zeigt, wiederverwendet/geteilt – nicht an jeder Stelle einzeln nach Augenmaß neu eingeschätzt oder als derselbe Zahlenwert separat hingeschrieben, auch wenn der Wert zufällig übereinstimmt. Zwei Gründe: (1) exakt wiederkehrende Muster lassen sich so ohne eigene Berechnung/Schätzung einsetzen, (2) alle Stellen, die dasselbe Muster zeigen, lassen sich über eine einzige Stellschraube gemeinsam ändern, statt mehrere Stellen von Hand synchron halten zu müssen. Wo ein Wert bewusst unabhängig bleiben soll (z.B. weil zwei Stellen zufällig ähnlich aussehen, aber unterschiedliche Konzepte sind und sich später unterschiedlich entwickeln könnten), muss das eine bewusste Entscheidung sein, keine Bequemlichkeit – im Zweifel wiederverwenden/teilen, nicht duplizieren.

## Projektübersicht

Minimalistische Single-Page Todo-App. Kein Backend, kein Server, kein Login. Alles läuft im Browser via localStorage. Exportierbar als JSON.

### Kernidee

Der Fokus liegt auf **Geschwindigkeit und Reibungslosigkeit** beim Anlegen und Verwalten von Todos — nicht auf Feature-Breite.

**Das Pool-Konzept:** Todos leben in einem persistenten Pool. Man wählt aus diesem Pool, was aktiv bearbeitet werden soll, und baut sich eine fokussierte Current-Liste (View: "Current", vormals "Current", davor "Today"). Der Pool eignet sich auch für wiederkehrende Aufgaben, weil ein Todo nicht zwingend "erledigt" werden muss — man kann es einfach wieder zurück in den Pool legen.

**Kein Tagesreset mehr.** Die Current-Liste ist nicht an einen Kalendertag gebunden und wird nicht mehr automatisch um 04:00 Uhr geleert. Sie bleibt bestehen, bis sie manuell leergeräumt wird (durch Abhaken oder Zurücklegen in den Pool).

**Die zwei Abhak-Modi** sind der zentrale Unterschied zu normalen Todo-Apps:
- **Done** — Todo ist wirklich erledigt, wandert ins Archiv (`completedAt` gesetzt).
- **Done for now** — Für den Moment fertig, aber das Todo bleibt im Pool. Nächste Mal wieder verfügbar. Ideal für Routinen und wiederkehrende Tasks. (Vormals "Done for today" – umbenannt, weil es keinen Tagesbezug mehr gibt. Auch im Code durchgängig umbenannt (`doneForNow`, `doneForNowOnDate`, Event `done-for-now`).)

> **Keine Sessions/Achievements.** Es gibt kein Tracking mehrtägiger Current-Zeiträume. Jedes Todo trägt einfach sein eigenes `completedAt`/`workLog` — der Kalender liest diese Timestamps direkt und zeigt pro Tag genau das, was an diesem Tag erledigt/bearbeitet wurde. Kein Reset, kein Session-Start/-Ende, keine Range-Highlights.

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

### UI-Text: immer Kleinschreibung

Labels, Buttons, Menüeinträge, Tooltips und Platzhaltertexte werden durchgängig kleingeschrieben (`lists`, `subs`, `tags`, `default`, `current` – nicht `Lists`, `Subs`, ...), auch wenn es sich um Eigennamen wie View-Namen handelt. Die Labels in den Swipe-Zonen (`TodoCard.vue`, siehe Swipe-Gesten-Sektion unten) erscheinen ebenfalls klein – das passiert dort rein über `text-transform: lowercase` in CSS (vormals `uppercase`), die Strings im Code selbst sind Title-Case (`Done`, `Done for now`, `Remove`, `Delete`, ...). Ganze Sätze (Fließtext wie Empty-States, z.B. "Nothing planned for this day.") folgen normaler Satzgroßschreibung – die Regel gilt für UI-*Chrome*, nicht für Prosa.

### Tooltips: `v-tooltip`, nie `title`

Hover-Infos an Buttons/Icons laufen über die globale Direktive `v-tooltip="'text'"` (`src/composables/useTooltip.ts`, Styling `.app-tooltip` in `base.css`: Ink-Fläche, Text in `--bg`), nicht über das native `title`-Attribut – das zeichnet der Browser in eigenen Farben, nicht stylebar. Ein gemeinsames Tooltip-Element für die ganze App, nur auf Hover-Geräten; Icon-only-Buttons bekommen dabei automatisch ein `aria-label`. Texte kleingeschrieben (siehe oben).

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
  inCurrent: boolean
  completedAt?: string  // ISO-Timestamp → landet im Archiv
  workLog: string[]     // ISO-Timestamps: je ein Eintrag pro "Done for now"-Tag
}

interface AppState {
  todos: Todo[]
  tags: Tag[]
}
```

> **Date-Feature.** Der System-Tag `date` (intern weiterhin die ID `__loop__`, nur das Label wurde von "loop" umbenannt) gibt einem Todo optional ein `loopInterval`-Objekt mit `mode: 'once' | 'loop'`. `'once'` ist ein einmaliges Fälligkeitsdatum (`startDate`), `'loop'` die bestehende Wiederholung (`unit`/`count`/`startDate`). Ein fälliges Todo (once ab seinem Datum, loop nach der bisherigen Logik) wird automatisch nach Current geschickt, genau wie bisher — `'once'` bleibt dabei fällig (taucht bei Rückgabe in den Pool wieder auf), bis es tatsächlich erledigt wird.
>
> **"updates when done"-Toggle.** Optionaler Loop-Todo-Schalter (`loopInterval.rescheduleFromCompletion`, Default `false`, kein Effekt bei `'once'`/`weekdays`): lässt `doneForNow` den `startDate` auf den Abhak-Zeitpunkt verschieben, statt ihn fix zu lassen — die nächste Fälligkeit zählt dann ab dem tatsächlichen Abhaken. Checks blenden den Toggle über `:allow-reschedule="false"` aus (`CheckSchedule` hat kein passendes Feld dafür).
>
> **Current und Date Lists sind unabhängig.** `inCurrent` (Current-Mitgliedschaft) und `focusDates` (Date-List-Mitgliedschaft) sind zwei getrennte Flags, die sich nicht automatisch angleichen — eine Today-Date-List ersetzt Current nicht und umgekehrt. Einzige Ausnahme: ein fälliges Date-Todo (`loopInterval` gesetzt, egal ob `once` oder `loop`) landet automatisch in Current **und**, falls für heute schon eine Date List existiert, zusätzlich auf dieser (`runLoopSchedule`/`addTodo` in App.vue) — legt dabei aber nie selbst eine neue Date List an. Weil das für ein Date-Todo eine einzige "heute fällig"-Instanz ist, räumt "Done for now" bei einem Date-Todo beide Mitgliedschaften auf einmal weg, egal von welcher der beiden Listen aus abgehakt wird (`doneForNow`/`doneForNowOnDate` in `stores/todos.ts`). Ein normales Todo (kein `loopInterval`) bleibt dagegen strikt listen-gebunden: Done-for-now auf einer Liste lässt eine andere Mitgliedschaft (z.B. eine manuell zugewiesene künftige Date List) unangetastet.
>
> **Eine Date-List-Vorschau zeigt mehr als nur `focusDates`.** `todosForFocusDate(dateStr)` (und analog `checksStore.checksDueOn(dateStr)`) liest zusätzlich live, welche Date-Todos/Checks laut ihrem aktuellen `loopInterval`/`schedule` an `dateStr` fällig wären (`isLoopDueToday(interval, new Date(dateStr + 'T12:00:00'), ...)`) — nichts davon wird gespeichert, eine Future List ist rein zur Anzeigezeit berechnet. Ausnahme `once`: ein einmaliges Date-Todo bleibt zwar ab seinem Datum fällig, bis es erledigt ist, erscheint in der Vorschau aber nur an genau einem Tag – seinem Datum, bzw. heute, sobald das vorbei ist. Unerledigt rutscht es so jeden Tag einen weiter, statt auf allen künftigen Listen gleichzeitig zu stehen. Gleiches gilt für ein Loop-Todo: eine fällige, nicht abgehakte Instanz (`inCurrent`) steht weiter auf der heutigen Liste, auch an Tagen, an denen der Loop selbst nicht fällig ist – bis Done, Done for now oder "move to next day". Ändert sich ein Loop später (Intervall, Startdatum, Reschedule), stimmt jede schon existierende Vorschau automatisch weiter, ohne dass irgendwo nachgezogen werden müsste.
>
> **Overview versteckt `inCurrent`-Todos nur noch ohne Date Lists.** Mit aktivem Date-Lists-Feature bleibt ein Todo im Overview sichtbar, auch sobald es in Current ist (`filteredTodos` in `AllTodos.vue`, gated auf `themeStore.dateListsEnabled`) — sonst ließe sich ein Todo, das schon in Current liegt, nicht mehr zusätzlich einer Date List zuweisen. Ohne Date Lists ist es wieder exakt die ursprüngliche Single-Current-App: Current räumt das Overview wie eh und je auf. Plus-Icon und `focus`-Swipe-Zone (planen auf die gewählte Date List) gelten deshalb für jedes Todo gleichermaßen, unabhängig von `inCurrent`.
>
> **Overview sortiert die gewählte Date List nach vorne.** Bei aktivem Feature stehen im Overview alle Todos, die auf der in der Focus-Date-Pille gewählten Liste liegen (`todosForFocusDate(selectedFocusDate)`, also auch dort fällige Date-Todos), vor allen anderen; innerhalb beider Gruppen gilt die normale Sortierung (Datum/A–Z). Eine dünne, blasse Divider-Line über die volle Breite (`.selected-list-break`, im selben `.todo-wrap`, damit `useListFlip` weiter über die Grenze animiert) setzt diesen Pool vom Rest ab. Rein zur Anzeigezeit berechnet (`onSelectedListIds` in `AllTodos.vue`), nichts zusätzlich gespeichert — "zuletzt zugewiesen zuerst" geht deshalb bewusst nicht. Gilt nicht im Date-Filter "only" (eigene Fälligkeits-Sortierung).
>
> **Preset-Fenster: die nächsten 7 Tage sind immer als Ziel wählbar.** Sowohl Overviews als auch Currents Date-List-Nav in der linken Sidebar (`App.vue`) zeigen immer today/tomorrow + die nächsten 5 Tage als eigene Einträge, ausgegraut (aber klickbar, nie `disabled`) solange noch nichts draufliegt (`store.hasFocusDateList(dateStr)`) — ein rollierendes 7-Tage-Fenster ab heute (`presetWeekDates`), keine feste Kalenderwoche. Darüber hinausgehende Termine tauchen weiterhin nur auf, sobald tatsächlich etwas draufliegt (`upcomingFocusDates`, jetzt gefiltert auf alles jenseits des Preset-Fensters). In Current führt das Anwählen eines leeren Presets einfach zu "Nothing planned for this day." — unter der Liste (auch der leeren) sitzt dort ein kleiner Plus-Kreis (`.tag-add-btn`, gleiche `--chip-*`-Maße wie der Tag-Add-Kreis im Overview-Sidebar), der wie `Calendar.vue`s `planThisDay()` die Focus-Date-Pille auf dieses Datum setzt und ins Overview springt, bereit zum Befüllen.
>
> **Overview und Current teilen sich eine "gerade fokussierte Date List".** Zwischen den beiden hin- und herzuwechseln (Tab, Nav-Icons, ...) verliert die Auswahl nicht: Current → Overview übergibt das gerade betrachtete `viewingDate` an die Focus-Date-Pille (`themeStore.setSelectedFocusDate`), Overview → Current übernimmt umgekehrt `themeStore.selectedFocusDate` als neues `viewingDate` (`App.vue`s `route.path`-Watcher). `viewingDate` selbst wird sonst nirgends zurückgesetzt – auch ein Settings- oder Calendar-Abstecher verändert es nicht, Current zeigt danach wieder dieselbe Liste wie vorher.
>
> **Kein Current-Pool mehr, solange Date Lists aktiv ist.** Current und "die heutige Date List" waren fast dasselbe und parallel verwirrend — deshalb hat Current bei aktivem Date-Lists-Feature keine eigene, tagesunabhängige Ansicht (`viewingDate === null`) mehr: `viewingDate` (`App.vue`) startet in dem Fall direkt auf `todayStr()` statt `null` und wird beim Live-Toggeln des Features entsprechend nachgezogen (`null` ↔ heute); der "current"-Eintrag in der Sidebar-Date-List-Nav sowie die "Default"-Zeile in `ListsPanel.vue` sind komplett entfernt, `Current.vue`s `dateListCycle` (Back/Next) enthält `null` nicht mehr. Ohne Date Lists bleibt Current exakt die alte tagesunabhängige Pool-Ansicht (`inCurrent`-basiert) – dieser ganze Absatz gilt nur, wenn das Feature an ist. Das `inCurrent`-Datenmodell selbst bleibt unverändert bestehen (nötig fürs Zurückschalten sowie für die weiterhin bestehende Date-Todo-Verzahnung, siehe oben) – Todos, die schon `inCurrent` waren, verschwinden dadurch nicht: Overview zeigt bei aktivem Feature ohnehin alle Todos unabhängig von `inCurrent` (siehe unten).
>
> **Listen-Aktionen auf der zugeklappten Karte.** "Die Liste" ist in `TodoCard.vue` ein einziges Konzept (`isOnList`, `addToList`/`removeFromList`/`toggleList`): Current zeigt immer nur ihre eigenen Mitglieder, im Overview ist es mit Date Lists die gewählte Date List, ohne die `inCurrent`-Current-Liste. Nur dort wird nach Modus/Feature verzweigt – Icons, `zones`-Swipe und die C/D-Tasten rufen alle diese Funktionen auf (`obvious` = direkter Icon-Klick, unterdrückt den Toast). Zugeklappt zeigt eine Karte entweder nur `CirclePlus` ("add to list") oder, sobald sie auf der Liste ist – Overview wie Current, mit oder ohne Date Lists –, denselben Block: Priority-Flag, `CircleArrowRight` ("move to next day", nur mit Date Lists: `store.moveFocusDateToNextDay`, gleiche Date-Todo/`inCurrent`-Kopplung wie `doneForNowOnDate`) und `CircleMinus` ("remove from list"). Die Date List liest die Karte selbst (`listDate`: Overview → Focus-Date-Pille, Current → injiziertes `viewingDate`). Auf dem Phone sind diese Icons (wie alle `.card-btn`) ebenfalls sichtbar – vormals dort ausgeblendet. (Ein Dropdown dafür wurde ausprobiert und verworfen.)
>
> Overviews Klein-Icon (`CirclePlus`/`CircleMinus`) und der `focus`-Swipe-Zone-Slot (siehe Swipe-Gesten-Sektion unten) übernehmen bei aktivem Feature dieselbe Aufgabe wie zuvor das separate `CalendarPlus`-Icon – planen/entplanen auf die aktuell gewählte Date List (`assignFocusDate`/`unassignFocusDate`), statt `inCurrent` zu setzen. Ohne das Feature verhalten sich beide exakt wie zuvor (Current hinzufügen/entfernen). Das eigenständige `CalendarPlus`-Icon ist damit entfallen.

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
> Fälligkeit wird nicht wie bei Loop-Todos in einer `inCurrent`-Flag festgehalten, sondern rein aus `schedule` live berechnet (`todayChecks` im Store) — ein Check hat kein "aus Current entfernen", das rückgängig gemacht werden könnte, also keine `focusAddedAt`/`processedToday`-Buchführung nötig. Der Store hält dafür einen reaktiven `today`-Anker (`refreshToday()`), den App.vue an denselben drei Stellen wie `runLoopSchedule` aufruft (Mount, Mitternacht, Tab-Refokus) — ein `computed`, das nur `new Date()` liest, würde beim Tageswechsel sonst nie neu laufen. "Verpasst" (fällig laut `schedule`, aber nicht in `completedDates`) wird nirgends extra gespeichert, sondern von dem, der es braucht (Kalender-Tagesdetail, künftiges Analyse-Feature), aus `schedule` + `completedDates` abgeleitet.
>
> **UI:** `Current.vue` zeigt die fälligen Checks (`todayChecks`) unterhalb der Todo-Liste — kein Trenner, nur Abstand (`.checks-section`, 66px). In einer Date-List-Vorschau (`viewingDate` gesetzt) ersetzt `checksDueOn(viewingDate)` `todayChecks` — eine Future List ist eine vollständige Vorschau des Tages, Checks eingeschlossen, nicht nur Todos. Für jedes andere Datum als heute ist die Checkbox gesperrt (`.check-box.locked`, gleiches `previewLocked`-Prinzip wie bei Todos) — abgehakt werden kann ein Check erst, wenn der Tag tatsächlich da ist; der Klick auf den Titel öffnet trotzdem `CheckModal.vue` zum Bearbeiten. Einspaltig untereinander (bewusst nicht mehrspaltig — dafür ist `CHECK_TITLE_MAX_LENGTH` auch nicht mehr auf "zwei nebeneinander" gedeckelt, siehe oben). Jede Zeile: kleine eckige Checkbox (Radius an Rounded/Square gekoppelt, aber auf 3px gedeckelt statt voll `var(--radius)` — sonst wird die kleine Box im Rounded-Modus komplett rund; dazu ein dezenter Drop-Shadow wie bei den Todo-Cards) + reiner Text ohne Rahmen (anders als Tags/Todos), Font `var(--font-mono)`. Der ganze Pill ist blass (`opacity: 0.55`, abgehakt `0.3`, Hover `0.9`) statt durchgestrichen. Klick auf den Text öffnet `CheckModal.vue` (Add/Edit, wiederverwendet `LoopPicker` mit `:allow-once="false"`; auf Phones oberes Drittel statt zentriert, auf Desktop/Tablet 460px breit für die einzeilige Presets-/Weekdays-Zeile) zum Umbenennen/Neu-Kalibrieren/Löschen. Settings-Toggle `checksEnabled` (Theme-Store) blendet das gesamte Feature inkl. Kalender-Dot/-Sektion aus. `Calendar.vue` zählt abgehakte Checks für den normalen Aktivitäts-Dot mit (kein eigener Dot-Typ) und zeigt sie als eigene Sektion am Ende der Tages-Detail-Liste.

## Projektstruktur

```
todo-app/
├── src/
│   ├── components/
│   │   ├── TodoCard.vue         // Karte mit Swipe-Gesten, Tag-Menü, Check-Menü (Current)
│   │   ├── LoopPicker.vue       // Recurrence-Picker (once/loop/weekdays/custom), von Todo + CheckModal genutzt
│   │   ├── CheckModal.vue       // Add/Edit-Modal für Checks
│   │   ├── ColorPicker.vue      // HSV-Farbwähler für Settings
│   │   ├── icons/               // Custom SVG-Icons als Vue-Komponenten (siehe unten), ergänzen @lucide/vue
│   │   └── SettingsModal (entfernt – Settings ist eigene Route/View)
│   ├── views/
│   │   ├── AllTodos.vue         // Hauptliste (filtert: aktiv + nicht in Current)
│   │   ├── Current.vue          // Current-View (todayTodos, zwei Abhak-Modi, Checks-Zeile darunter)
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
│   ├── assets/icons/            // Rohe SVG-Quelldateien für Custom Icons (siehe unten), Namensschema <name>-NN.svg
│   ├── dev/
│   │   └── seed.ts              // Dev-only: befüllt localStorage mit Dummy-Todos
│   ├── router/
│   │   └── index.ts             // Hash-Router: /, /all, /current, /calendar, /settings
│   ├── App.vue                  // Shell: Sidebar, Head, Nav, Mobile-Tag-Panel
│   └── main.ts
├── index.html
├── vite.config.ts
└── package.json
```

## Kalender-View

`Calendar.vue` nutzt das `v-calendar`-Plugin und zeigt eine Monatsübersicht. Unter den Tagen erscheinen Dots:

- **Aktivitäts-Dot** – ein einziger, normaler Dot für jede Aktivität an diesem Tag: Todo *Done* (`completedAt`), *Done for now* (`workLog[]`) oder ein abgehakter Check (`completedDates`, nur bei aktivem Checks-Feature). Keine eigenen Dot-Typen pro Art.
- **Geplant-Dot** (nicht ausgefüllt, nur Umriss) – künftiger Tag mit bereits geplanter Date List (nur bei aktivem Date-Lists-Feature).

Ein Klick auf einen Tag öffnet eine Detail-Liste der an diesem Tag erledigten (`completedAt`) und bearbeiteten (`workLog`) Todos, unter dem normalen Tages-Label (z.B. "Tuesday, July 7, 2026"). Kein Konzept von mehrtägigen Zeiträumen — jeder Tag steht für sich. Die Overrides für v-calendar (Farben, Abstände) stehen in `src/styles/calendar.css`.

Die Liste selbst ist nicht nach Done/Done-for-now gruppiert (das bleibt nur als Icon pro Zeile erhalten: Doppelhäkchen bzw. einfaches Häkchen im Kreis, `CircleCheckIcon.vue`), sondern nach **Priority vs. Rest** — Priority ist schon überall sonst in der App das zentrale "das war wichtig"-Signal, und beantwortet im Rückblick eher "habe ich das Wichtige geschafft" als die eher buchhalterische Done/Worked-on-Unterscheidung. Titel laufen in der Kalender-eigenen Fancy-Font (`--font-playful`), nicht in der zufälligen Todo-Font aus AllTodos/Current — letzteres wurde kurz ausprobiert und wieder verworfen.

**Log + Undo.** Ein `calendar | log`-Umschalter oben im Kalender-View tauscht Monatsraster + Tagesdetail gegen eine Liste aller erledigten (Done) Todos (`store.completedTodos`, neueste zuerst, gruppiert nach Erledigungstag, gelöschte ausgeblendet). Erledigte Todos werden nie entfernt, nur über `completedAt` aus Overview/Current herausgefiltert — das Log braucht deshalb kein eigenes Datenmodell. Undo (`UndoDoneButton.vue`, im Log und bei Done-Einträgen im Tagesdetail) ruft `store.uncompleteTodo` auf: `completedAt` weg, das Todo ist wieder im Pool (Overview). Current-/Date-List-Mitgliedschaften kommen bewusst nicht zurück (`completeTodo` löscht sie und merkt sie sich nicht), `workLog` bleibt. Ein fälliges Date-/Loop-Todo rejoint Current danach sofort (`runLoopSchedule`).

## Typografie – Zufällige Schriftarten pro Todo

Jedes Todo-Item bekommt beim Rendern eine Schriftart aus einem Pool von 17 Familien zugewiesen. Die Logik liegt in `src/composables/useTodoFonts.ts`:

- **Deterministic:** Der Font wird per Hash der Todo-ID bestimmt — gleiche ID → gleicher Font, stabil über Re-Renders.
- **Kein Duplikat nebeneinander:** Wenn zwei benachbarte Todos denselben Font bekämen, wird der zweite automatisch um einen Slot verschoben.
- **17 Schriftfamilien** (alle selbst gehostet in `src/styles/fonts/`): Aleo, Amarante, Bodoni Moda, Cardo, EB Garamond, Faustina, Karla, Lora, Manrope, Merienda, Merriweather, Montserrat, Patrick Hand, Roboto, Roboto Condensed, Roboto Slab, Sorts Mill Goudy.
- Dateibenennung: `FontName-Style.ttf` (z.B. `BodoniModa-Italic.ttf`). `@font-face`-Deklarationen in `src/styles/fonts.css`.

## Custom Icons

Neben `@lucide/vue` (Standard-Icon-Set) gibt es eigene, handgezeichnete SVG-Icons für Stellen, an denen kein Lucide-Icon passt. Rohe Quell-SVGs liegen unter `src/assets/icons/<name>-NN.svg` (zweistellig durchnummeriert, falls mehrere Varianten eines Icons entstehen, z.B. `pool-01.svg`). Jedes Icon wird als eigene Vue-Komponente unter `src/components/icons/` inline gerendert (nicht per `<img>`/dynamischem Import wie die Celebration-SVGs) — nur so lässt sich `stroke`/`fill` auf `currentColor` umstellen und darüber `var(--ink)` einfärben, wie es das Oberste Designprinzip (nur vier Farbwerte) verlangt. Eine Icon-Komponente nimmt wie Lucide-Icons eine `size`-Prop (Default 24) und rendert `viewBox`/Pfade der Quelldatei 1:1, nur mit hartcodierten Farben durch `currentColor` ersetzt; enthält die Quelldatei `<clipPath>`-IDs, werden die über `useId()` pro Instanz eindeutig gemacht (mehrere Instanzen desselben Icons können gleichzeitig im DOM stehen, z.B. Desktop- und Mobile-Nav). Aktuell: `PoolIcon.vue` (aus `pool-01.svg`) für den Overview-Nav-Eintrag, anstelle des vorherigen Lucide-`Globe`. Außerdem `CalendarIcon.vue`: Lucides `CalendarDays` Pfad für Pfad nachgebaut (keine eigene Quell-SVG), damit Rahmen-Ecken (`rx`) und Linienenden der Rounded/Square-Einstellung (`themeStore.rounded`) folgen — als SVG-Attribute, nicht per CSS, weil ein CSS-Override (`rx: 0` usw.) nicht in jedem Browser griff (z.B. Firefox auf Android).

## Celebration-Animationen

Beim Abhaken eines Todos (Done oder Done for now, keine Unterscheidung) spielt eine kurze Full-Viewport-Hintergrund-Animation. Die Logik dafür liegt komplett im `<script>`-Block (nicht `<script setup>`) von `src/components/TodoCard.vue`.

> **Aktuell aktiv: die Frame-SVG-Animationen** (Cat/Whale/Penguin/Orca, `playFrameCelebration`/`resolveCelebrationConfig`/`ALL_CELEBRATIONS`, inkl. Pre-Completion-Teaser in `App.vue`), nicht die alten Partikel-Celebrations (Herzen/Konfetti/Ballons/Feuerwerk, `bgHearts`/`bgConfetti`/`bgBalloons`/`bgFireworks`) — deren Mechanik ist komplett stehen geblieben, nur in `celebrateBackground` (TodoCard.vue) auskommentiert, genau wie umgekehrt zuvor. Zurückschalten ist weiterhin ein Zweizeiler an genau zwei Stellen: `celebrateBackground`s eigener Aufruf (TodoCard.vue) und der Teaser-Watcher plus sein Import (App.vue). Der Rest dieses Abschnitts beschreibt weiterhin die Frame-Mechanik selbst (Assets, Tiers, Sizing), unabhängig davon, welche der beiden Varianten gerade aktiv ist.

**Assets:** Jede Animation liegt als drei Breakpoint-Varianten (Desktop/Tablet/Phone, siehe unten) unter `src/assets/animations/svg/<name>_<breite>.svg` (+ optional GIF-Referenzen fürs Original unter `src/assets/animations/gif/<name>_<breite>.gif`), z.B. `cat-black_1920.svg`/`cat-black_810.svg`/`cat-black_486.svg`. `<breite>` ist die für diesen Tier exportierte Pixel-Breite (1920/810/486) — nicht bloß derselbe Export skaliert, sondern eigenständig für diese Auflösung gezeichnet, Frame-Anzahl/-Timing können sich zwischen Tiers deshalb unterscheiden. Aufbau je Datei: eine `<g class="f fN">` pro Frame, alle mit `visibility:hidden`, plus `@keyframes fN`/`animation: fN <dauer>s step-end infinite`, die die Frames nacheinander sichtbar schalten — ein klassischer "Sprite-Sheet-als-SVG"-Export (z.B. aus ezgif). Pfade haben Default-Fill `#000000`.

**Responsive Tiers:** `currentViewportTier()` in `TodoCard.vue` wählt anhand von `window.innerWidth` einen von drei Tiers — dieselben Breakpoints wie sonst überall in der App (700px, 1024px, siehe mobile.css/layout.css): `phone` (≤700px) → `_486`, `tablet` (≤1024px) → `_810`, `desktop` (>1024px) → `_1920`. Jede Celebration braucht alle drei Tiers, kein Single-Tier-Fallback.

**Cover statt Contain:** Jede Celebration füllt den kompletten Viewport (bzw. bei `verticalAnchor: 'bottom'` den Viewport abzüglich der mobilen Bottom-Nav) auf beiden Achsen aus, statt auf einer Achse zu passen und auf der anderen Leerraum zu lassen — Überstand wird vom Overlay (`overflow:hidden`) weggeschnitten, nie reingezoomt. `buildFrameOverlay` berechnet den Skalierungsfaktor selbst aus dem `viewBox` der jeweiligen SVG (`Math.max(viewportWidth/naturalWidth, viewportHeight/naturalHeight)`) und setzt Breite/Höhe/Position der `<svg>` in px — kein CSS `object-fit`/`background-size`, weil eine inline `<svg>` (nötig fürs Umfärben der Pfade) beides nicht bekommt.

**Eine neue Animation hinzufügen:**
1. Alle drei Breakpoint-SVGs nach `src/assets/animations/svg/<name>_1920.svg` / `_810.svg` / `_486.svg` legen.
2. Jede einzeln mit svgo verkleinern, dabei **`removeHiddenElems` deaktivieren** — sonst löscht svgo alle Frame-Gruppen, weil sie per Default `visibility:hidden` sind und erst per Keyframe sichtbar werden (Config-Beispiel siehe `celebrateCat`/`celebrateWhale`-Historie in der Git-Historie, Commit "svgo-Optimierung"). Faustregel: 40–60 % Ersparnis realistisch. **Fällt eine Datei trotzdem ungewöhnlich groß aus** (zweistellige MB, viel größer als andere Celebrations bei ähnlicher Frame-Zahl) — liegt fast immer an der Pfadanzahl pro Frame, nicht an der Frame-Zahl selbst: ein Export mit vielen kleinen Einzelformen pro Frame (Spritzer, Textur-Fragmente) statt weniger zusammengesetzter Pfade treibt die Dateigröße um Größenordnungen hoch (Beispiel: `orca-01`, 73 Frames aber ~217 Pfade/Frame statt der sonst üblichen ~10, 16 MB roh). `mergePaths` ist Teil von svgos Preset und fasst gleich gestylte Geschwister-Pfade pro Frame-Gruppe schon automatisch zusammen; reicht das nicht, zusätzlich `convertPathData: { floatPrecision: 0 }` überschreiben (ganzzahlige statt Sub-Pixel-Koordinaten — bei einer Viewport-füllenden Hintergrund-Animation nicht sichtbar, hat `orca-01` von 16 MB auf ~1,9 MB gebracht).
3. In `TodoCard.vue`s `ALL_CELEBRATIONS`-Map (`Record<CelebrationKey, CelebrationConfig>`) einen Eintrag ergänzen: `{ variants: { desktop, tablet, phone }, verticalAnchor? }`, wobei jeder Tier `{ importer: () => import('../assets/animations/svg/<name>_<breite>.svg?raw'), fallbackCycleMs }` ist — `fallbackCycleMs` ist die volle Zyklusdauer aus der `animation:`-Zeile in genau *dieser* Tier-Datei (z.B. `1.68s` → 1680; kann pro Tier variieren, siehe oben). `verticalAnchor` ist optional, `'center'` (Default) oder `'bottom'` — Penguin nutzt `'bottom'`, damit die Figur immer am unteren Viewport-Rand steht statt vertikal zentriert zu schweben/croppen.
4. Den Key auch in `CELEBRATION_KEYS` in `src/composables/useCelebrations.ts` ergänzen — das ist die einzige Stelle, die der Store (`sendToToday`, siehe unten) kennt, um eine Celebration zuzulosen.

**Warum kein `setTimeout` zum Entfernen:** Die Keyframes sind `infinite` (sie loopen selbständig weiter). `playFrameCelebration` begrenzt sie stattdessen per Web Animations API (`effect.updateTiming({ iterations: 1 })`) auf einen Durchlauf und wartet auf `animation.finished`, bevor das Overlay entfernt wird — ein reiner Timer würde bei geringer Verzögerung (Main-Thread-Jank) gegen den Loop-Restart racen und kurz das erste Frame nochmal aufblitzen lassen.

**Bundle-Größe:** Jede SVG wird per dynamischem `import(...?raw)` geladen (nicht statisch) — Rolldown packt sie dadurch in einen eigenen Chunk, der erst beim ersten Abspielen dieser Animation geladen und danach gecacht wird, statt das Hauptbundle aufzublähen.

**Welche Celebration ein Todo bekommt** wird nicht beim Abspielen zufällig gewählt, sondern einmal beim Senden nach Current (`sendToToday` in `stores/todos.ts`) fest zugelost und in `Todo.celebration` gespeichert (`CelebrationKey`, Shuffle-Bag `drawCelebrationKey()` in `src/composables/useCelebrations.ts`, aktueller Pool: `blackCat`, `whale`, `penguin`, `orca`). Bleibt fix, solange das Todo in Current ist; verlässt es Current und kommt später wieder rein, wird neu gelost. `TodoCard.vue`s `ALL_CELEBRATIONS`-Map kennt nur noch, *wie* ein Key gerendert wird (SVG-Tiers/Anchor), nicht mehr die Zufallslogik selbst — die lebt bewusst im Store, damit sie keine Kopplung an SVG-/Animations-Code braucht. Ein alter, aus `CELEBRATION_KEYS` entfernter Key (z.B. die frühere, nicht-schwarze `cat`-Celebration) kann in bereits persistierten Todos noch als `Todo.celebration`-Wert stehen — `resolveCelebrationConfig` in `TodoCard.vue` fängt das ab und lost in dem Fall einen frischen, aktuell gültigen Key nach, statt gegen ein `undefined`-Config zu laufen.

**Pre-Completion-Teaser:** Solange in Current das Done/Done-for-now-Menü einer Karte offen ist (`showMenu`), zeigt `showCelebrationTeaser(key)` bereits das erste Frame der für dieses Todo bereits fest zugelosten Celebration an — eingefroren (alle Frame-Animationen werden sofort nach dem Einfügen pausiert, bevor sie über Frame 0 hinaus laufen können) und blass über Opacity (`TEASER_OPACITY`, kein eigener Farbwert). Weil der Key am Todo hängt statt bei jedem Menü-Öffnen neu gewürfelt zu werden, zeigt jede Karte immer verlässlich *ihre eigene* Celebration — und `celebrateBackground(key)` beim tatsächlichen Abhaken spielt exakt das, was schon geteasert wurde. Ein `props.todo.celebration ?? drawCelebrationKey()`-Fallback (inkl. Nachtragen per `store.updateTodo`) fängt Alt-Todos ab, die `inCurrent` schon waren, bevor es dieses Feld gab.

## Entschiedene Design-Fragen

- **Kein Tagesreset mehr:** Die Current-Liste (`inCurrent`) wird nicht mehr automatisch geleert und bleibt bestehen, bis sie manuell leergeräumt wird.
- **Dark/Light Toggle:** Keins. Fixes Design (eine Variante).
- **Todo-Erstellung:** Add-Input in App.vue (Main-Head), immer sichtbar. Enter speichert. Bei vorhandenen Tags öffnet sich eine inline Checkbox-Liste zur direkten Tag-Zuweisung. Auf Desktop/Tablet fährt das Input bei Fokus über die Icons daneben auf die volle Kopfzeilenbreite aus (`expandAddInput` in App.vue: negative Margins genau um den Platz links/rechts, die Icons bleiben an ihrem Platz und blenden nur aus, gemeinsame Dauer `--add-grow-duration` in layout.css), damit längere Titel lesbar bleiben – Tippen geht sofort, die Animation hält nichts auf. Erst danach klappt das Tag-Dropdown nach unten auf (`addDropdownOpen`), beim Schließen schneller wieder nach oben, während das Input gleichzeitig zurückfährt. Ein `ResizeObserver` misst bei Fenster-Resize neu (sonst stimmen die px-Margins nicht mehr). Zurückgefahren wird über `onTodoBlur` bzw., wenn das Dropdown von woanders aus geschlossen wird (z.B. Escape im Sub-Feld), über den `showTagModal`-Watcher. Der Dropdown-Inhalt bleibt dauerhaft gemountet (nur `v-show`), damit beim Aufklappen nichts erst gebaut werden muss – `TagInlineCreate` wird pro Schließen neu gekeyt (`addDropdownSession`). Phone hat stattdessen sein eigenes Add-Sheet.
- **Zusatzfelder:** Tags direkt im Add-Input. Klick auf den Todo-Titel in der Karte öffnet Tag-Menü + Text-Edit (siehe TodoCard.vue).
- **Mobile:** Vollständig responsive, mobile-first CSS.

## Abhaken in Current – zwei Modi

- **✓ Done** – Setzt `completedAt`, Todo wandert ins Archiv.
- **◷ Done for now** – Fügt Timestamp zu `workLog[]` hinzu, setzt `inCurrent = false`. Todo bleibt im Pool.

## Swipe-Gesten auf Todo-Karten

Das Ziehen/Swipen einer Karte (`TodoCard.vue`) läuft über ein Zonen-Modell: feste, **rechtwinklige Dreiecke in den Bildschirmecken** (`zones` computed, Geometrie in `ZONE_LAYOUT`) werden beim Greifen einer Karte eingeblendet (inkl. Dim-Overlay über der ganzen App, `.swipe-zones-dim`), plus ein Hit-Test (`zoneDepth`/`deepestZoneHit`) mit einer **Kontakt-Box** statt des nackten Pointers: an der Kartengröße orientiert – jede Seite `ZONE_CONTACT_SCALE` (0.7) der Karte, also rund die halbe Kartenfläche, zentriert auf die Pointer-Position (`event.clientX/clientY`, bewusst nicht `info.point`, das ist page- statt viewport-relativ) und in die aktuelle Kartenposition (Grab-Rect + Drag-Offset, Drag-Rotation ignoriert) zurückgeschoben, wo sie überstehen würde. `ZONE_CONTACT_MAX` (360×220px) deckelt sie, damit sehr große Karten (z.B. mit ausgeklappten Subs) nicht fast überall irgendein Dreieck berühren und kein Abbrechen mehr zulassen. Berührt die Box mehrere Dreiecke, gewinnt das, in das sie am tiefsten hineinragt. Der rechte Winkel sitzt in der Ecke von `backdropRect` (Desktop/Tablet: Viewport, Phone: Content-Bereich ohne Bottom-Nav), um `ZONE_EDGE_INSET` (pro Tier, 15px bzw. 8px auf Phone) vom Rand abgesetzt, die schräge Kante zeigt zur Bildschirmmitte. Beide Schenkel sind **Anteile von Breite/Höhe** (nicht px), pro Tier (`currentViewportTier()`, phone/tablet/desktop) eigene Werte, optional per `overview`-Override nur fürs Overview (aktuell: größeres `focus`-Dreieck auf allen Tiers; das `delete`-Dreieck ist in beiden Views identisch) – die Dreiecke verformen sich also mit dem Bildschirm (breit/flach auf Desktop, hoch/schmal auf Tablet-Portrait). Jeder Slot hat bewusst eine **eigene Größe und Form, nicht symmetrisch** – ein gleichmäßiges Layout wirkte zu mechanisch/statisch. Gezeichnet als ein einziges Viewport-SVG (`zonePath`), Hit-Test, Pfad und Labels lesen alle dieselbe Geometrie (`buildZone`). Labels (`zoneLabelLayout`): ein Wort pro Zeile, in der rechtwinkligen Ecke verankert – linke Ecken linksbündig, rechte rechtsbündig, oben nach unten gestapelt, unten nach oben (letztes Wort in der Ecke). Eine gemeinsame Schriftgröße für alle Labels beider Views (`ZONE_LABELS` hält alle Label-Texte pro View/Slot, `allZoneLabelVariants` baut jede Kombination) – Overview und Current zeigen also dieselbe Größe, unabhängig vom Zustand der Karte: die größte, bei der jede Zeile jedes Labels noch im Dreieck liegt (äußere Zeilenecke innerhalb der Schräge, Wortbreiten per Canvas in der echten Schrift gemessen, gedeckelt auf `ZONE_LABEL_MAX`) – das kleinste Dreieck/längste Wort bestimmt also die Größe für alle (davon `ZONE_LABEL_SCALE`). Fette Display-Schrift (Gewicht + Kontur in Textfarbe, `--zone-type-weight`/`--zone-type-stroke`) teilen sich die Labels mit dem großen Ziel-Datum. Die Dreiecke sind immer scharfkantig – bewusst nicht an Settings rounded/square (`--radius`) gekoppelt. Lässt man die Karte außerhalb aller Dreiecke los, passiert nichts – die Karte federt einfach zurück; die freie Mitte ist der tote Bereich. Greift man eine Karte, die schon unter einem Dreieck liegt, zählt diese Zone **sofort** (bewusst keine Sperre) – man hat die Karte ja im Griff und zieht sie selbst raus, wenn man nicht dort ablegen will. Positionen: `focus` oben rechts, `date` oben links, `delete` unten links.

- **Overview (`mode="all"`):** ohne Date Lists: `focus`-Slot (oben rechts) → Current hinzufügen/entfernen; `delete`-Slot (unten links) → Delete mit Bestätigung; kein `date`-Slot. Mit aktivem Date-Lists-Feature entfällt Current komplett (siehe oben) – der `date`-Slot ist deshalb ganz weg, und der `focus`-Slot übernimmt stattdessen dessen alte Aufgabe: auf die aktuell im Focus-Date-Widget gewählte Date List legen/wieder entfernen (`assignFocusDate`/`unassignFocusDate`), Das Zonen-Label lautet immer `Add to list` (mit wie ohne Date Lists) bzw. `Remove from list`; welche Liste gemeint ist, steht bei aktiven Date Lists stattdessen groß beim Greifen (`today`/`tomorrow`/`TT/MM`, `zoneTargetLabel`/`.swipe-zones-target`): mittig im Bereich, auf allen Gerätegrößen. Bei einem `TT/MM`-Datum steht darüber der Wochentag, per Canvas-Messung exakt auf die Breite des Datums skaliert (bei today/tomorrow entfällt er). Das Ziel-Datum liegt in einer eigenen Ebene (`.swipe-zones-front`) über der gezogenen Karte – die Karte gleitet darunter durch. Nur noch zwei Slots (`focus`, `delete`) statt drei.
- **Current (`mode="current"`):** **dieselben drei Positions-Slots**, aber andere Bedeutung – `focus`-Slot → Done, `date`-Slot → Done for now, `delete`-Slot → Remove from Current (unkritisch, daher ohne Bestätigung, anders als Overviews Delete). Swipe löst die Aktion direkt aus, ohne vorher das Check-Menü zu öffnen; Tippen auf die Karte öffnet das Menü weiterhin als Alternative. Bei `previewLocked` (Lists-Panel-Vorschau eines künftigen Tages, siehe `ListsPanel.vue`) fehlen `focus`- und `date`-Slot komplett – nur Remove bleibt.
- Die Positions-Slots sind absichtlich reine "Ortsnamen" (nicht pro Modus neu benannt) – Overview und Current teilen sich ein einziges, von Hand austariertes Layout statt zweier separat zu pflegender.

Das frühere distanzbasierte `threshold`-Modell (Swipe-Distanz statt Ecken-Dreiecke, `SWIPE_MODE`-Umschalter) wurde komplett entfernt – nur noch über die Git-Historie erreichbar.

## Keyboard-Shortcuts (nur Desktop, > 1024px)

Alle Shortcuts leben in **einem einzigen** globalen `keydown`-Listener in `App.vue` (bewusst, siehe unten). Unterhalb der Desktop-Breite ist der komplette Handler deaktiviert – kein View-/Karten-Cycling, keine Einzeltasten-Shortcuts.

- **Tab / Shift+Tab** – togglet immer zwischen All und Current (Calendar ist nicht Teil dieses Cycles, siehe **C**), auch bei offener Karte – die schließt dabei automatisch (inkl. Speichern einer laufenden Bearbeitung, siehe unten), trägt die Bearbeitung aber nicht auf eine Karte in der neuen View über.
- **↑ / ↓** – Karte für Karte durch die offene Liste (`cycleOpenCard`), nur wenn gerade eine Karte offen ist. Greift nicht, während der Titel gerade editiert wird (die Textarea braucht ↑↓ selbst zum Zeilenwechsel) – ein laufender Edit wird dann beim Wechsel einfach gespeichert, nicht auf die nächste Karte übertragen. In Current bewusst getrennt von **←→** (Done/Done-for-now im Check-Menü wählen), sonst würden sich beide Gesten überschneiden. Ist keine Karte offen, bedeuten dieselben beiden Tasten stattdessen: eine Date List weiter/zurück (`stepFocusDate`) – Overview und Current gleichermaßen, nur wenn Date Lists in den Settings aktiv sind (sonst existiert die Date-List-Nav in keiner der beiden Views). Overview schreibt dabei auf `themeStore.selectedFocusDate` (die Focus-Date-Pille), Current auf sein eigenes `viewingDate` (dieselbe Logik wie die Chevron-Buttons/`stepDateList`) – beide teilen sich denselben `dateListCycle` (rollierende Woche + weiter draußen liegende Date Lists).
- **C** – Calendar togglen, kehrt zum vorher aktiven Haupt-View (All/Current) zurück (nicht hart auf Overview verdrahtet) – gleiches Muster wie **X**/Settings. Ist eine Karte offen (Overview, Tag-Menü), bedeutet **C** stattdessen: Tags übernehmen und das Todo zu Current schicken (bzw. auf die gewählte Date List planen, falls Date Lists an sind) – siehe TodoCard.vue's onCardKeydown. Der Fokus wandert dabei auf die nächste Karte im Pool (bzw. die vorherige, falls es die letzte war), statt mit der wegfliegenden Karte mitzureisen. Kein echter Konflikt mit dem Calendar-Toggle: `shortcutsBlocked()` in App.vue schließt eine offene Karte für alle Einzeltasten-Shortcuts ohnehin schon aus, genau wie bei **D** unten.
- **O** – Sort/Order togglen (Datum ↔ A–Z). Nur Overview, sonst No-Op. (Vormals **S** – auf **O** verschoben, damit **S** für den Subs-Toggle frei ist, siehe unten.)
- **S** – Subs-Toggle togglen (nur wenn Subs aktiv sind), Overview und Current – ruft `toggleDesktopSubs()` auf, genau wie der Header-Icon-Klick selbst (route-abhängig: `expandOverviewSubs`/`expandCurrentSubs`). Sonst No-Op.
- **L** – Im Calendar: zwischen `calendar` und `log` umschalten (`themeStore.calendarViewMode`, persistiert – C bringt einen zurück in den zuletzt genutzten Modus; **C** selbst verlässt Calendar aus beiden Modi). Sonst: öffnet Overviews Focus-Date-Pille (den "plan ahead"-Datepicker) durch einen synthetischen Klick auf die echte Pille (`.focus-date-widget`, per `querySelector` über `focusDateWidgetSlotRef`) – bewusst kein Component-Ref/`defineExpose` auf FocusDateWidget.vue, um dessen internem State-Handling nicht in die Quere zu kommen. Nur Overview mit aktiven Date Lists, sonst No-Op.
- **G** – Grid/List togglen. Nur Overview, sonst No-Op.
- **N** – Fokus ins Add-Todo-Feld ("new"). Overview + Current.
- **T** – Fokus ins Tag-Input in der Sidebar. Nur Overview – Current ist nicht filterbar, das Tag-/Filter-Menü wird dort gar nicht erst gerendert (kein ausgegrautes Fallback mehr).
- **A** – All-Filter (löscht jeden aktiven Tag-/Prio-/Date-Filter auf einmal). Nur Overview.
- **P** – Prio-Filter togglen. Nur Overview.
- **D** – Date-Filter durchzyklen (default → hide → only → default, startet auf "hide"). Nur Overview, kein Todo offen. Ist ein Todo offen, bedeutet **D** stattdessen Delete (Overview) bzw. Remove from Current (Current) – siehe TodoCard.vue's onCardKeydown. Kein echter Konflikt: genau wie bei ↑↓ (Karten-Cycling) vs. diesem ganzen Einzeltasten-Block sind beide Zustände gegenseitig ausschließend.
- **X** – Settings togglen, kehrt zur vorher offenen View zurück (nicht hart auf Overview verdrahtet) – Calendar eingeschlossen, dort im zuletzt genutzten Modus (`calendar`/`log`), siehe `settingsReturnPath` in App.vue.
- **Escape** – schließt/blurt immer das, was gerade offen/fokussiert ist (Add-Todo-Input, Tag-Input, offene Karte, Swipe-Delete-Bestätigung).

Alle Einzeltasten-Shortcuts (O/S/L/G/N/T/A/P/X) greifen nicht, während in einem Textfeld getippt wird, während eine Karte offen ist, oder mit gedrückter Modifier-Taste (Cmd/Ctrl/Alt).

**Wichtig:** View-Cycling (Tab) und Karten-Cycling (↑↓) dürfen nie zwei unabhängige Listener sein – ein View-Wechsel (gleich wodurch ausgelöst) schließt deshalb immer jede offene Karte und sichert eine laufende Bearbeitung, egal über welche Taste er kommt – ein View darf beim erneuten Betreten nie etwas offen/halb editiert zeigen. Historisch war das sogar dieselbe Taste (Tab tat je nach Zustand das eine oder das andere) – das hat früher zu einem Bug geführt, bei dem eine offen gebliebene Karte (unbemerkt durch einen einfachen Klick) das View-Wechseln per Tab dauerhaft blockiert hat, weil Karten-Cycling nie schloss, nur immer zur nächsten Karte sprang. Seit ↑↓ fürs Karten-Cycling zuständig ist, kann dieser spezielle Bug so nicht mehr auftreten, aber das Prinzip (ein View-Wechsel räumt immer auf) gilt unverändert weiter.

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
