# 05 · Design System — "Carta e argilla"

> Stato: **definitivo** (ADR-015, che sostituisce la parte visiva di ADR-008). I principi UX e
> le euristiche di Nielsen sono in `02_DESIGN_AND_NIELSEN.md`.
> Fonte unica dei token: `packages/shared/src/theme.ts` (`THEME.light`, `THEME.dark`).
> Web: le variabili CSS `--om-*` sono **generate** da `THEME` dal plugin `themeTokens` in
> `apps/web/tailwind.config.ts`; `apps/web/src/app/globals.css` contiene solo ombre, stili di
> base, classi editoriali e utility di movimento.
> Primitive: `apps/web/src/components/ui` (import da `@/components/ui`).
> Tema: `apps/web/src/lib/theme` (`ThemeProvider`, `useTheme`, script anti-flash).
> Contrasti: `npx tsx scripts/check-contrast.ts` (esce con errore se una coppia scende sotto AA).

---

## 1. Direzione

OpenMusic deve sembrare **una rivista musicale stampata su carta avorio, letta con calma**.
Pochi elementi, molto spazio bianco, tipografia che fa il lavoro che prima facevano texture e
ombre. Il colore è quasi tutto inchiostro e pietra; l'argilla (terracotta) compare solo dove
l'utente deve agire o capire dove si trova.

Quattro idee:

1. **Carta, non vetro.** Sfondo avorio (chiaro) o grafite calda (scuro). Le superfici si
   distinguono per un tono di pietra e un filo (bordo da 1 px), non per ombre.
2. **Gerarchia editoriale.** Un serif da giornale (Newsreader) per titoli, titoli di album e
   citazioni; un grottesco tranquillo (Instrument Sans) per l'interfaccia; un mono a cifre
   tabellari (Spline Sans Mono) per ogni numero.
3. **Un solo accento, usato poco.** Argilla per azione primaria, focus, voce di navigazione
   attiva e link. Verde e rosso solo per il significato (fresh, rotten), sempre con icona o testo.
4. **Movimento che risponde.** 150–250 ms, ease-out, traslazioni di 4–8 px. Niente si muove
   da solo se non per indicare un caricamento. Con `prefers-reduced-motion` tutto sta fermo.

### Ispirazione e limiti (vincolanti)

Il proprietario ha chiesto un'atmosfera **ispirata** all'interfaccia di Claude / Anthropic
(claude.ai): calda, calma, minimale, editoriale. L'ispirazione riguarda solo il _linguaggio
visivo generale_ (carta calda, inchiostro quasi nero, accento terracotta parco, serif per i
contenuti e sans per l'interfaccia, molto spazio). **Non** prendiamo nulla di proprietario:

- nessun logo, nome, marchio, simbolo o illustrazione di Anthropic o Claude;
- nessun font proprietario (Styrene, Tiempos, Copernicus o simili): solo Google Fonts con
  licenza SIL OFL;
- nessun valore di colore copiato: la palette è nostra, calcolata per i contrasti AA (l'argilla
  chiara `#9C4423` è più scura e bruna di qualunque accento di riferimento);
- OpenMusic mantiene nome, marchio (`BrandMark`) e voce. Il testo dell'interfaccia non cita mai
  Claude o Anthropic.

---

## 2. Temi

Due temi, stessi ruoli semantici:

| Tema   | Carattere                                                                      |
| ------ | ------------------------------------------------------------------------------ |
| Chiaro | Carta avorio, inchiostro quasi nero caldo, pietra morbida per le card          |
| Scuro  | Grafite calda (né nero puro né grigio-blu), argilla schiarita per il contrasto |

**Come si sceglie il tema**

- Senza scelta dell'utente il sito segue `prefers-color-scheme` (anche con JS disattivato).
- La scelta (`light` / `dark`) è salvata in `localStorage["om-theme"]` (in `try/catch`) e
  messa su `<html data-theme="…">`. "Sistema" = nessun valore salvato, nessun attributo.
- Uno script inline nel `<head>` (`THEME_BOOTSTRAP_SCRIPT`) applica la scelta **prima del primo
  paint**: niente flash del tema sbagliato. `<html>` ha `suppressHydrationWarning` per questo.
- `ThemeProvider` (montato nel root layout) tiene React allineato: segue i cambi del sistema,
  degli altri tab (`storage`) e riconcilia dopo l'idratazione. Il cambio tema usa una View
  Transition (dissolvenza 200 ms) dove esiste, mai con movimento ridotto.
- `color-scheme` è sempre impostato su `:root`, quindi controlli nativi e scrollbar seguono il tema.
- Selettori generati: `:root` (chiaro, `color-scheme: light dark`), `@media
(prefers-color-scheme: dark) :root:not([data-theme="light"])` (scuro di sistema),
  `:root[data-theme="dark"]`, `:root[data-theme="light"]`.
- La variante Tailwind `dark:` segue la stessa regola (scelta esplicita, poi sistema).

```tsx
import { useTheme } from '@/lib/theme';
const { preference, resolved, system, setPreference } = useTheme();
// preference: 'light' | 'dark' | 'system'; resolved/system: 'light' | 'dark'
```

---

## 3. Tipografia

| Ruolo                | Font                                                            | Tailwind / classe                                             | Note                                                              |
| -------------------- | --------------------------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------------------- |
| Editoriale / display | **Newsreader** (variabile `opsz` 6–72, `wght` 200–800, corsivo) | `font-editorial`, `.om-headline`, `.om-deck`, `.om-pullquote` | Titoli, titoli di album, citazioni dei critici, titoli dei dialog |
| UI / testo           | **Instrument Sans** (variabile `wght` 400–700, `wdth` 75–100)   | `font-sans` (default)                                         | Controlli, navigazione, testo corrente                            |
| Numeri               | **Spline Sans Mono** (variabile `wght` 300–700)                 | `font-mono tabular-nums`, `.om-tabular`                       | Durate, punteggi, contatori, date, numeri di traccia              |

Caricati con `next/font/google` in `apps/web/src/app/layout.tsx` come variabili
`--font-newsreader`, `--font-instrument`, `--font-mono` (i vecchi nomi `--font-fraunces`,
`--font-jakarta`, `--font-jetbrains-mono` restano come alias in `globals.css`).

**Perché questi tre**

- **Newsreader** (Production Type, OFL) è disegnato per la lettura su schermo di testate
  giornalistiche: ha l'aria del quotidiano letterario che cerchiamo, senza la "stravaganza
  anni '70" di Fraunces (`WONK`, `SOFT`) che stonava con una direzione calma. L'asse `opsz`
  permette titoli sottili ed eleganti a 40–60 px e corsivi leggibili nelle citazioni.
- **Instrument Sans** è un grottesco contemporaneo con dettagli umanisti (aperture ampie,
  `a` e `g` morbide): neutro ma non anonimo, leggibile a 12–14 px. Evita i default
  onnipresenti (Inter, Geist) e non imita alcun sans proprietario.
- **Spline Sans Mono** ha lo **zero senza barra né punto** (DM Mono e JetBrains Mono rendevano
  "Ø1" nei numeri di traccia) e pesi reali 300–700, quindi il codice delle pagine che usa
  `font-semibold` sui numeri non produce grassetti sintetici.

**Regole**

- Un solo titolo Newsreader per gruppo visivo. Mai bottoni, etichette di form o testo UI lungo
  in serif.
- Ogni numero che cambia o si confronta usa `font-mono tabular-nums`.
- `.om-eyebrow` è ora **in minuscolo/sentence case**, sans 13 px, colore `fg-subtle`. Niente
  maiuscole spaziate. Usalo solo quando aggiunge contesto reale ("Album del 2007").
- Misura di lettura: `max-w-prose` (68 ch) per il testo, `max-w-narrow` (52 ch) per stati vuoti.
- Interlinea generosa: `body` 1,6; la scala sotto ha interlinee ampie.

### Scala (`THEME.typography.scale`, px)

| Token | Corpo / interlinea | Tailwind          |
| ----- | ------------------ | ----------------- |
| xs    | 12 / 18            | `text-xs`         |
| sm    | 14 / 21            | `text-sm`         |
| base  | 16 / 26            | `text-base`       |
| lg    | 18 / 28            | `text-lg`         |
| xl    | 20 / 30            | `text-xl`         |
| 2xl   | 24 / 32            | `text-2xl`        |
| 3xl   | 30 / 38            | `text-3xl`        |
| 4xl   | 36 / 42            | `text-4xl`        |
| 5xl   | 46 / 52            | `text-5xl`        |
| 6xl   | 58 / 62            | `text-6xl`        |
| —     | fluido 28→36       | `text-display-sm` |
| —     | fluido 34→46       | `text-display-md` |
| —     | fluido 40→58       | `text-display-lg` |

I `text-*` di Tailwind ora leggono questa scala (interlinee più ampie dei default).

---

## 4. Token di colore

Le variabili contengono **canali RGB** (`--om-bg: 246 242 234`), così i modificatori di
opacità funzionano: `bg-accent/10`, `border-fresh/40`.

| Ruolo (`THEME.light/dark`) | Variabile CSS          | Tailwind (canonico)       | Chiaro    | Scuro     | Uso                                               |
| -------------------------- | ---------------------- | ------------------------- | --------- | --------- | ------------------------------------------------- |
| bg                         | `--om-bg`              | `bg-canvas`               | `#F6F2EA` | `#1E1C19` | Sfondo pagina                                     |
| surface                    | `--om-surface`         | `bg-surface`              | `#EEE8DC` | `#272521` | Card, sidebar, gruppi                             |
| surfaceRaised              | `--om-surface-raised`  | `bg-surface-raised`       | `#FBF9F4` | `#302D29` | Dialog, toast, popover, input                     |
| sunken                     | `--om-sunken`          | `bg-sunken`               | `#EFEAE0` | `#191815` | Pozzetti (ricerca, segmented)                     |
| border                     | `--om-border`          | `border-line`             | `#E0D8C9` | `#3A3732` | Filo decorativo e divisori                        |
| borderStrong               | `--om-border-strong`   | `border-line-strong`      | `#867D6D` | `#847C71` | Confini di componenti (≥ 3:1)                     |
| text                       | `--om-text`            | `text-fg`                 | `#24211C` | `#ECE7DE` | Testo principale                                  |
| textMuted                  | `--om-text-muted`      | `text-fg-muted`           | `#5A534A` | `#BBB3A6` | Testo secondario, metadati                        |
| textSubtle                 | `--om-text-subtle`     | `text-fg-subtle`          | `#6F675B` | `#9C9487` | Minima enfasi, sempre AA                          |
| accent                     | `--om-accent`          | `bg-accent`/`text-accent` | `#9C4423` | `#DE8C66` | Azione primaria, nav attiva, link                 |
| accentHover                | `--om-accent-hover`    | `bg-accent-hover`         | `#82381C` | `#E9A281` | Hover/pressione dell'accento                      |
| accentContrast             | `--om-accent-contrast` | `text-accent-contrast`    | `#FCF8F2` | `#1E1C19` | Testo su riempimento accento                      |
| focus                      | `--om-focus`           | `outline-focus`           | `#9C4423` | `#E59B78` | Anello di focus                                   |
| fresh                      | `--om-fresh`           | `text-fresh`              | `#2E6A45` | `#72BC8E` | Positivo: punteggio ≥ 70%, successo, "in ascolto" |
| rotten                     | `--om-rotten`          | `text-rotten`             | `#A33340` | `#E9767F` | Negativo: < 70%, errori, distruttivo              |
| warning                    | `--om-warning`         | `text-warning`            | `#7F5409` | `#D7A64C` | Attenzione, punteggio diviso                      |
| overlay                    | `--om-overlay`         | `bg-overlay/40`           | `#24211C` | `#0F0E0C` | Base del backdrop (sempre con alfa)               |

### Contrasti misurati (`scripts/check-contrast.ts`)

Rapporto su `bg` / minimo su `bg`, `surface`, `surfaceRaised`, `sunken`. Soglie: testo 4,5:1;
bordi di componenti e focus 3:1 (WCAG 1.4.11).

| Ruolo                     | Chiaro            | Scuro             |
| ------------------------- | ----------------- | ----------------- |
| text                      | 14,36 / min 13,15 | 13,80 / min 11,12 |
| textMuted                 | 6,79 / min 6,21   | 8,19 / min 6,60   |
| textSubtle                | 4,99 / min 4,57   | 5,67 / min 4,57   |
| accent                    | 5,76 / min 5,27   | 6,52 / min 5,25   |
| fresh                     | 5,76 / min 5,27   | 7,53 / min 6,07   |
| rotten                    | 6,06 / min 5,54   | 5,96 / min 4,80   |
| warning                   | 5,92 / min 5,42   | 7,65 / min 6,16   |
| borderStrong (UI, 3:1)    | 3,64 / min 3,33   | 4,13 / min 3,33   |
| focus (3:1)               | 5,76 / min 5,27   | 7,52 / min 6,06   |
| accentContrast su accent  | 6,08              | 6,52              |
| border su bg (decorativo) | 1,27              | 1,43              |

Lo script verifica anche i badge "soft" (testo colorato su tinta all'**8%** del colore, sopra
`bg` e `surface`) e i badge "solid" (testo `bg` su colore): tutti AA. Per questo le tinte soft
sono all'8%, non al 12–14% di prima.

- `prefers-contrast: more` promuove `border` a `borderStrong` e `textSubtle` a `textMuted`.
- `forced-colors: active`: bottoni, icon button, tab e opzioni del tema selezionate mantengono un
  bordo visibile.

### Nomi rinominati e alias (le pagine esistenti continuano a funzionare)

| Vecchio nome (Tailwind / CSS)                                                                                                 | Nuovo canonico                                                                                            | Nota                                                                                          |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ink` / `--om-text`                                                                                                           | `fg` / `--om-text`                                                                                        | stesso valore                                                                                 |
| `ink-secondary` / `--om-text-secondary`                                                                                       | `fg-muted` / `--om-text-muted`                                                                            | secondo livello                                                                               |
| `ink-muted` / `--om-muted`                                                                                                    | `fg-subtle` / `--om-text-subtle`                                                                          | **attenzione:** il vecchio `ink-muted` è il _terzo_ livello, il nuovo `fg-muted` il _secondo_ |
| `elevated` / `--om-elevated`                                                                                                  | `surface-raised` / `--om-surface-raised`                                                                  |                                                                                               |
| `accent-strong` / `--om-accent-strong`                                                                                        | `accent-hover` / `--om-accent-hover`                                                                      |                                                                                               |
| `on-accent` / `--om-on-accent`                                                                                                | `accent-contrast` / `--om-accent-contrast`                                                                |                                                                                               |
| `mixed` / `--om-mixed`                                                                                                        | `warning` / `--om-warning`                                                                                |                                                                                               |
| `live` / `--om-live`                                                                                                          | `fresh` / `--om-fresh`                                                                                    |                                                                                               |
| `--om-shadow-rgb`                                                                                                             | `--om-overlay`                                                                                            |                                                                                               |
| `om-bg`, `om-card`, `om-interactive`, `om-text`, `om-secondary`, `om-muted`, `om-amber`, `om-fresh`, `om-rotten`, `om-border` | `canvas`, `surface`, `surface-raised`, `fg`, `fg-muted`, `fg-subtle`, `accent`, `fresh`, `rotten`, `line` | alias storici                                                                                 |
| `THEME.scheme.dark/light`                                                                                                     | `THEME.dark` / `THEME.light`                                                                              | `scheme` resta (mobile `themeFor()`)                                                          |
| `THEME.colors.*` (mobile)                                                                                                     | `THEME.dark.*`                                                                                            | chiavi piatte invariate, ora derivate dal tema scuro                                          |
| `ColorScheme.textSecondary`, `muted`, `elevated`, `accentStrong`, `onAccent`, `mixed`, `live`                                 | `textMuted`, `textSubtle`, `surfaceRaised`, `accentHover`, `accentContrast`, `warning`, `fresh`           | chiavi `@deprecated`, stessi valori                                                           |

`canvas`, `surface`, `sunken`, `line`, `line-strong`, `accent`, `fresh`, `rotten`, `focus`
non cambiano nome.

---

## 5. Altri token

| Gruppo         | Token                                                                                                                           | Web                                                                                                                                    |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Spaziatura     | griglia 4 px: `THEME.space` 0…24 (0–96 px)                                                                                      | spaziatura Tailwind standard                                                                                                           |
| Raggi          | `xs 4`, `sm 6`, `md 8`, `sleeve 10`, `lg 12`, `xl 16`, `pill`                                                                   | `rounded-xs`, `rounded` (= 6), `rounded-sm`, `rounded-md`, `rounded-sleeve`, `rounded-lg`, `rounded-xl`, `rounded-full`                |
| Ombre          | quasi zero: `sm` (filo), `md`, `lg` (solo livelli fluttuanti)                                                                   | `shadow-om-sm/md/lg`, `shadow-hairline` (bordo interno 1 px); `shadow-sleeve`, `shadow-analog`, `shadow-glow` restano come alias tenui |
| Durate         | `instant 100`, `fast 150`, `base 200`, `slow 250`, `groove 1800` (periodo dei loop)                                             | `duration-fast`… (default `duration` = 200)                                                                                            |
| Curve          | `out` (0.22, 1, 0.36, 1) = curva della casa; `standard`, `enter` (= out), `exit`; `tonearm` deprecato (= out, niente overshoot) | `ease-out` (default), `ease-standard`…                                                                                                 |
| Stagger        | `THEME.motion.stagger` = 40 ms, max 8 passi                                                                                     | `delay-stagger`, `.om-stagger`                                                                                                         |
| Distanze       | `THEME.motion.distance` 4 / 6 / 8 px                                                                                            | `--om-distance-sm/md/lg`                                                                                                               |
| Molle (mobile) | `snappy`, `gentle` (smorzate, senza rimbalzo)                                                                                   | n/d                                                                                                                                    |
| z-index        | `base 0`, `raised 10`, `sticky 100`, `playerBar 200`, `overlay 300`, `dialog 400`, `toast 500`, `tooltip 600`                   | `z-sticky`, `z-toast`…                                                                                                                 |

Tailwind cambia il valore di `rounded-sm/md/lg/xl` e `rounded` (più morbidi dei default).

---

## 6. Movimento

**Regole**

- Il movimento risponde a un'azione (aprire, confermare, cambiare scheda) o segnala un
  caricamento. Un solo ingresso orchestrato per vista; niente "fade-up su ogni sezione".
- Durate 150–250 ms, curva `ease-out`, traslazioni 4–8 px. Solo `opacity`, `translate`,
  `scale` (compositor).
- Hover: cambia colore/bordo, non sposta. Pressione: `om-press` (scala 0,98).
- `prefers-reduced-motion: reduce`: le utility sotto non animano affatto; una rete globale
  limita le transizioni a colore/opacità, fa girare i loop una volta sola e spegne le View
  Transitions. **Non** usiamo il globale `animation-duration: 0.01ms` (rende alcune animazioni
  più brusche).

| Utility                                                                       | Effetto                                                                                                           |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `.om-enter`                                                                   | dissolvenza + salita 6 px, 250 ms (ingresso di una vista o di un blocco)                                          |
| `.om-fade`                                                                    | sola dissolvenza, 200 ms (pannelli dei Tabs)                                                                      |
| `.om-stagger`                                                                 | sul contenitore: i figli entrano a 40 ms di distanza, max 8 passi; `style={{ '--om-i': n }}` per forzare l'ordine |
| `.om-press`                                                                   | affondo del 2% mentre si preme (già su Button e IconButton)                                                       |
| `animate-fade-in`, `animate-fade-up`, `animate-dialog-in`, `animate-toast-in` | keyframe equivalenti per Tailwind                                                                                 |
| `animate-pulse-soft`                                                          | respiro di opacità 2 s per gli skeleton                                                                           |
| `animate-shimmer`, `animate-spin-record`, `.om-spin-record`                   | mantenuti per compatibilità (fermi con movimento ridotto)                                                         |

**View Transitions tra route:** non attivate. In Next 16 richiedono il flag sperimentale
`experimental.viewTransition` e `<ViewTransition>` di React (API instabile); `globals.css`
contiene già la dissolvenza calma e lo spegnimento con movimento ridotto, così l'attivazione
futura è una riga in `next.config.mjs`. Il cambio di tema usa già `startViewTransition`.

---

## 7. Classi editoriali (`globals.css`)

| Classe          | Aspetto                                                                         |
| --------------- | ------------------------------------------------------------------------------- |
| `.om-headline`  | Newsreader 450, `opsz` automatico, interlinea 1,12, -0,015em                    |
| `.om-deck`      | Newsreader corsivo, `fg-muted` (catenaccio sotto il titolo)                     |
| `.om-eyebrow`   | sans 13 px medio, `fg-subtle`, **senza maiuscole**                              |
| `.om-pullquote` | Newsreader corsivo 22 px con filo d'argilla di 2 px                             |
| `.om-dropcap`   | capolettera serif in colore testo                                               |
| `.om-rule`      | singolo filo `border`                                                           |
| `.om-sleeve`    | card in pietra con filo e raggio 10 (niente più anello d'usura né bordo aperto) |
| `.om-grooves`   | disco segnaposto con solchi tenui e piccola etichetta d'argilla                 |
| `.om-link`      | link d'argilla con sottolineatura leggera che si rafforza in hover              |
| `.om-tabular`   | mono + `tabular-nums`                                                           |
| `.om-paper`     | mantenuta, ora non fa nulla (la carta è lo sfondo)                              |

La grana analogica globale (`body::after`) è stata **rimossa**.

---

## 8. Primitive (`apps/web/src/components/ui`)

Tutte in TypeScript strict, icone Phosphor, anello `:focus-visible` in `focus`, nessun
significato affidato al solo colore.

```tsx
import {
  Button,
  buttonClasses,
  IconButton,
  Card,
  CardHeader,
  Avatar,
  Badge,
  Field,
  Input,
  Textarea,
  controlClasses,
  Tabs,
  Dialog,
  Skeleton,
  EmptyState,
  ErrorState,
  ToastProvider,
  useToast,
  RatingStars,
  starsFromRating,
  ratingFromStars,
  ScoreBadge,
  scoreStatus,
  FRESH_THRESHOLD,
  Spinner,
  ThemeToggle,
  cn,
} from '@/components/ui';
```

| Primitiva                      | Props principali (novità in **grassetto**)                                                                                                                                                        | Accessibilità                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `Button`                       | `variant: primary \| secondary \| outline \| ghost \| danger \| **link**`, `size: sm \| md \| lg`, `loading`, `loadingLabel`, `leadingIcon`, `trailingIcon`, `fullWidth`                          | `type="button"` di default; `aria-busy` e click bloccati durante il caricamento; bordo in forced-colors |
| `buttonClasses(opts)`          | stesse opzioni                                                                                                                                                                                    | per dare l'aspetto di bottone a un `<Link>`                                                             |
| `IconButton`                   | `label` (obbligatorio), `icon`, `variant: solid \| subtle \| ghost \| outline`, `size`, `pressed`, `loading`, **`shape: round \| square`** (default: round per `solid`, square per gli altri)     | `aria-label` + tooltip; `aria-pressed` per i toggle                                                     |
| `Card` / `CardHeader`          | `variant: surface \| **raised** \| sleeve \| outline \| sunken`, `padding`, `interactive` (ora solo bordo più forte, **niente sollevamento**), `as`; header `eyebrow`, `title`, `level`, `action` | elemento semantico con `as`                                                                             |
| `Avatar`                       | `name`, `src`, `size: xs…xl`, `status: live \| online \| ghost \| offline`, `decorative`                                                                                                          | `role="img"` con nome e stato; `live` è ora un anello verde fermo (niente vinile che gira)              |
| `Badge`                        | `tone: neutral \| accent \| fresh \| mixed \| rotten \| live`, `variant: soft \| outline \| solid`, `size`, `icon`, `mono` (**niente più maiuscole forzate**)                                     | abbinare il tono a icona o testo                                                                        |
| `Field`                        | `label`, `hint`, `error`, `required`, `hideLabel`, `aside`, figlio render-prop                                                                                                                    | collega `id`, `aria-describedby`, `aria-invalid`, `aria-required`                                       |
| `Input` / `Textarea`           | props native + Field + `leadingIcon` (Input)                                                                                                                                                      | campo carta `surface-raised`, bordo ≥ 3:1, focus = bordo 2 px d'argilla                                 |
| `Tabs`                         | `items`, `value`/`defaultValue`/`onValueChange`, `label`, `variant: underline \| pill`                                                                                                            | tab WAI-ARIA, ←/→/Home/End; il pannello ora mostra il focus e si dissolve al cambio                     |
| `Dialog`                       | `open`, `onClose`, `title`, `description`, `footer`, `size`, `dismissible`, `closeLabel`                                                                                                          | `<dialog>` modale nativo; backdrop `overlay` senza sfocatura                                            |
| `Skeleton`                     | `shape: text \| rect \| circle \| cover`, `lines`                                                                                                                                                 | decorativo; respiro `pulse-soft`, fermo con movimento ridotto                                           |
| `EmptyState`                   | `title`, `description`, `icon`, `action`, `size`                                                                                                                                                  | proporre sempre un passo successivo                                                                     |
| `ErrorState`                   | `title`, `description`, `onRetry`, `retrying`, `action`, `variant: block \| inline`                                                                                                               | `role="alert"`; icona `WarningCircle` al posto della faccina                                            |
| `ToastProvider` / `useToast()` | `notify({title, description?, tone?, action?, duration?})`, `dismiss(id)`                                                                                                                         | regioni live polite/assertive; pulsante chiudi 32 px                                                    |
| `RatingStars`                  | `value`, `onChange?`, `size`, `label`, `showValue`, `disabled`                                                                                                                                    | slider ARIA; stelle vuote in `line-strong` (≥ 3:1)                                                      |
| `ScoreBadge`                   | `kind`, `percentage \| null`, `totalReviews`, `status?`, `size`                                                                                                                                   | pollice su/giù + testo; frase completa in `aria-label`                                                  |
| `Spinner`                      | `size`, `label` (`null` se decorativo)                                                                                                                                                            | anello sottile, fermo con movimento ridotto; `role="status"`                                            |
| **`ThemeToggle`**              | `variant: segmented \| icon`, `size` (icon), `label` (default "Tema"), `className`                                                                                                                | vedi sotto                                                                                              |

### ThemeToggle

- `variant="segmented"` (default): tre radio native in un `<fieldset>` con legenda nascosta
  ("Chiaro", "Scuro", "Sistema, ora scuro"); frecce per cambiare, focus visibile sull'opzione.
  Riga di aiuto sotto ("Segue il sistema, ora chiaro."). **Per la pagina Impostazioni.**
- `variant="icon"`: un solo `IconButton` ("Passa al tema scuro/chiaro") per l'header o il
  piede della sidebar. Passa all'opposto di ciò che si vede; se il bersaglio coincide con il
  sistema cancella la scelta invece di salvarla (così non resta "bloccato" contro il sistema).
- Richiede `ThemeProvider`, già montato in `app/layout.tsx`. Il posizionamento in Navbar e
  Impostazioni spetta alle pagine.

```tsx
// Impostazioni → Aspetto
<ThemeToggle />
// Navbar / piede della sidebar
<ThemeToggle variant="icon" size="sm" />
```

### Esempi

```tsx
<Button loading={saving} loadingLabel="Salvataggio…" leadingIcon={<FloppyDisk />}>
  Pubblica recensione
</Button>

<Link href="/explore" className={buttonClasses({ variant: 'outline', size: 'sm' })}>
  Esplora
</Link>

<Card as="article" interactive>
  <CardHeader eyebrow="Album del 1997" title="OK Computer" level={2} />
  <ScoreBadge kind="critic" percentage={94} totalReviews={38} />
</Card>

<ul className="om-stagger grid gap-4">{items.map((i) => <li key={i.id}>…</li>)}</ul>

<p>Leggi la <a className="om-link" href="/critics">recensione completa</a>.</p>
```

---

## 9. Da fare / Da evitare

**Da fare**

- Usare i token canonici (`bg-canvas`, `bg-surface`, `text-fg-muted`, `border-line`) o `THEME`.
  Un nuovo ruolo va aggiunto a `ColorScheme` in `theme.ts` (il CSS si genera da solo) e misurato
  con `scripts/check-contrast.ts`.
- Separare con fili e spazio, non con ombre. Ombre solo su dialog, toast, popover.
- Un solo bottone `primary` (argilla) per vista; il resto `secondary`, `outline` o `ghost`.
- Titoli e citazioni in Newsreader; tutto il resto in Instrument Sans; numeri in mono tabellare.
- Etichette in sentence case. Lasciare respirare: `p-6`/`p-10` nelle card grandi, `gap-6`+ tra sezioni.
- Abbinare sempre fresh/rotten a icona e parola.
- Testare entrambi i temi (`node …/shoot.mjs <dir> light|dark`).

**Da evitare**

- `#000`, `#FFF`, `text-white`, `bg-black`, esadecimali nei componenti, gradienti, bagliori.
- Loghi, nomi, illustrazioni o font di Anthropic/Claude; copiare valori dal loro prodotto.
- Etichette tutte maiuscole spaziate, eyebrow sopra ogni titolo, numerazioni 01/02/03 su
  contenuti che non sono una sequenza.
- L'argilla come decorazione (icone colorate, sfondi tinti grandi, capilettera).
- Animare il layout, far entrare ogni sezione con un fade-up, loop che non indicano un caricamento,
  ignorare `prefers-reduced-motion`.
- Sollevamenti in hover (`hover:-translate-y`) e `shadow-*` su card statiche.
- Codici HTTP o stack trace nei messaggi.

---

## 10. Note di migrazione per chi possiede le pagine

1. Nulla si rompe: tutti i nomi vecchi sono alias (tabella §4). L'aspetto però cambia subito:
   pagine chiare di default se il sistema è chiaro, niente grana, eyebrow senza maiuscole,
   raggi più morbidi.
2. Sostituire `ink*` con `fg*` facendo attenzione allo slittamento (`ink-muted` → `fg-subtle`).
3. Rimuovere `hover:-translate-y-*`, `shadow-om-md` su card statiche, `uppercase tracking-*`
   sulle etichette, gradienti ambientali scuri pensati per il vecchio tema solo-scuro (es. la
   tinta della copertina in `ReleaseHero`: va limitata al tema scuro o resa tenue).
4. Montare `<ThemeToggle variant="icon" />` nella Navbar e `<ThemeToggle />` in Impostazioni.
5. Mobile: `THEME.light`/`THEME.dark` sono pronti; i font Newsreader / Instrument Sans /
   Spline Sans Mono vanno aggiunti con `@expo-google-fonts/*` in `apps/mobile/src/theme/fonts.ts`.
