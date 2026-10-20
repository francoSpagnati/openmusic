# 05 · Design System — "Warm Editorial Vinyl"

> Status: **definitive** (supersedes the typography notes in `02_DESIGN_AND_NIELSEN.md`
> and the token table in `design_system_anti_ai_slop_ed_euristiche_di_nielsen.md`).
> Source of truth for tokens: `packages/shared/src/theme.ts` (`THEME`).
> Web mirror: `apps/web/src/app/globals.css` (CSS variables) + `apps/web/tailwind.config.ts`.
> Primitives: `apps/web/src/components/ui` (import from `@/components/ui` or a relative path).

---

## 1. Direction

OpenMusic should feel like **an independent record shop at closing time that also prints a
music magazine**. You flip through sleeves, read a review with a drop cap, and the person
next to you is playing something good.

Three ideas carry the identity:

1. **Paper and cardboard, not glass.** Surfaces are warm charcoal like a record-shop
   counter at night (dark) or uncoated magazine paper (light). A fine analog grain sits over
   everything. Borders are thin and matte. There are no coloured glows.
2. **Editorial hierarchy.** Headlines use an expressive variable serif (Fraunces). Metadata
   reads like the catalogue number on a record spine (mono, uppercase, tracked). Reviews get
   drop caps and pull-quotes.
3. **One warm accent.** Analog amber is the only brand colour. Green and red appear only to
   carry meaning (fresh, rotten, live), and always next to an icon or text.

### Signature touches (use them sparingly)

| Touch | Class / primitive | Where |
| --- | --- | --- |
| Analog grain overlay | `body::after` (global, automatic) | Everywhere; set `--om-grain-opacity: 0` to disable locally |
| Record-sleeve card (ring-wear circle, open edge, cardboard lift) | `.om-sleeve` / `<Card variant="sleeve">` | Album/release cards, reviews, featured blocks |
| Vinyl grooves disc | `.om-grooves` | Empty states, cover placeholders, "now playing" discs |
| Spinning record | `.om-spin-record`, `<Spinner>`, `<Avatar status="live">` | Loading, friends listening now |
| Editorial headline | `.om-headline` | Page titles, album titles, dialog titles |
| Italic deck (standfirst) | `.om-deck` | Line under a headline |
| Catalogue eyebrow | `.om-eyebrow` | Section labels, "LATO A · 1997", genres |
| Magazine double rule | `<hr class="om-rule">` | Section openers in long pages |
| Drop cap | `.om-dropcap` | First paragraph of a long review |
| Pull-quote | `.om-pullquote` | Critic quote highlights |

---

## 2. Typography (decision)

| Role | Font | Tailwind | Notes |
| --- | --- | --- | --- |
| Editorial / display | **Fraunces** (variable: `opsz`, `SOFT`, `WONK`, italic) | `font-editorial`, `.om-headline` | Headlines, album titles, review quotes, dialog titles |
| UI / body | **Plus Jakarta Sans** | `font-sans` (default) | Controls, body copy, navigation |
| Numbers | **JetBrains Mono** | `font-mono` + `tabular-nums`, `.om-tabular` | Durations, scores, counters, timestamps, catalogue labels |

Loaded with `next/font/google` in `apps/web/src/app/layout.tsx` as CSS variables
`--font-fraunces`, `--font-jakarta`, `--font-jetbrains-mono`.

**Why Fraunces + Plus Jakarta instead of Syne + Outfit**

- *Syne* is a wide display grotesque that has become a stock "creative agency / Web3 landing"
  face. It reads as a trend, not as a music magazine, and its extended widths waste space in
  album titles, which are often long ("Weird Fishes/Arpeggi").
- *Outfit* is a clean geometric sans with little character: it is part of the generic look
  the anti-AI-slop rules forbid.
- *Fraunces* is an "Old Style soft" serif inspired by 1970s display type (Windsor, Cooper),
  the era of the LP sleeve. Its variable axes let one family behave like several: high
  `opsz` and `SOFT 50` + `WONK 1` give characterful headlines, while low optical sizes stay
  readable in review body text. The italic is warm and suits pull-quotes and decks.
- *Plus Jakarta Sans* has slightly humanist, open shapes that stay legible at 12–14 px in
  dense UI, and it pairs with Fraunces without competing.
- Both were already named in `THEME.typography` and in the docs, so web and mobile now agree.

**Rules**

- At most one Fraunces headline per visual group. Do not set long UI labels in Fraunces.
- Every number that can change or be compared uses `font-mono tabular-nums` so columns do
  not jitter.
- `.om-eyebrow` is uppercase mono at 11 px/0.12em: use it for labels, never for sentences.
- Headings get `text-wrap: balance` and paragraphs get `text-wrap: pretty` automatically.

### Type scale (`THEME.typography.scale`, px, ratio ~1.25)

| Token | Size / line | Tailwind |
| --- | --- | --- |
| xs | 12 / 16 | `text-xs` |
| sm | 14 / 20 | `text-sm` |
| base | 16 / 24 | `text-base` |
| lg | 18 / 28 | `text-lg` |
| xl | 20 / 28 | `text-xl` |
| 2xl | 25 / 32 | `text-2xl` |
| 3xl | 31 / 36 | `text-3xl` |
| 4xl | 39 / 44 | `text-display-sm` (fluid 28→39) |
| 5xl | 49 / 52 | `text-display-md` (fluid 36→49) |
| 6xl | 61 / 62 | `text-display-lg` (fluid 44→61) |

Tailwind keeps its default `text-*` steps so existing pages do not shift; the editorial
display sizes are fluid `clamp()` values.

---

## 3. Colour tokens

Every value is checked against WCAG 2.2: all text roles reach **≥ 4.5:1** on `bg`,
`surface` and `elevated`; `borderStrong` reaches **≥ 3:1** for component boundaries.

| Role (`THEME.scheme.*`) | CSS var | Tailwind | Dark | Light | Use |
| --- | --- | --- | --- | --- | --- |
| bg | `--om-bg` | `bg-canvas` | `#14120F` | `#F5F0E6` | Page background (never `#000` or `#FFF`) |
| sunken | `--om-sunken` | `bg-sunken` | `#100E0C` | `#EAE3D4` | Inputs, wells, player groove |
| surface | `--om-surface` | `bg-surface` | `#1D1A16` | `#EDE6D8` | Cards, sidebars |
| elevated | `--om-elevated` | `bg-elevated` | `#27231E` | `#FBF8F2` | Dialogs, popovers, toasts, hover |
| border | `--om-border` | `border-line` | `#3A342C` | `#D9CFBD` | Hairlines and dividers (decorative) |
| borderStrong | `--om-border-strong` | `border-line-strong` | `#7D7262` | `#8A7F6E` | Input and outline-button boundaries |
| text | `--om-text` | `text-ink` | `#F2EBDD` | `#1C1915` | Primary text (15.8:1 / 15.4:1) |
| textSecondary | `--om-text-secondary` | `text-ink-secondary` | `#B8AE9C` | `#4F483E` | Metadata |
| muted | `--om-muted` | `text-ink-muted` | `#968C7C` | `#6A6255` | Least emphasis, still AA |
| accent | `--om-accent` | `bg-accent` / `text-accent` | `#E58A4A` | `#9A4716` | Primary action, active state, stars |
| accentStrong | `--om-accent-strong` | `bg-accent-strong` | `#F09C5F` | `#7F3A10` | Hover/pressed |
| onAccent | `--om-on-accent` | `text-on-accent` | `#14120F` | `#F5F0E6` | Text on an accent fill (7.2:1 / 5.6:1) |
| fresh | `--om-fresh` | `text-fresh` | `#5DB585` | `#2A6F48` | Score ≥ 70% |
| mixed | `--om-mixed` | `text-mixed` | `#D9A63E` | `#7A580B` | Score 45–69% (optional third state) |
| rotten | `--om-rotten` | `text-rotten` | `#E07360` | `#A63725` | Score < 70%, errors, destructive |
| live | `--om-live` | `bg-live` | `#5DB585` | `#2A6F48` | "Listening now" dot |
| focus | `--om-focus` | `outline-focus` | `#F4C27A` | `#9A4A16` | Focus ring |

- The CSS variables hold **RGB channels** (`--om-bg: 20 18 15`) so Tailwind opacity
  modifiers work: `bg-accent/10`, `border-fresh/40`.
- **Dark is the default.** The light "carta editoriale" scheme is opt-in with
  `<html data-theme="light">`, because the current pages were written dark-first.
- Legacy Tailwind names (`om-bg`, `om-card`, `om-interactive`, `om-text`, `om-secondary`,
  `om-muted`, `om-amber`, `om-fresh`, `om-rotten`, `om-border`) point at the same variables,
  so existing pages pick up the new palette without changes. Use the semantic names in new code.
- Legacy `THEME.colors.*` keys (used by mobile) are kept and now derive from
  `THEME.scheme.dark`.
- `prefers-contrast: more` promotes `border` to `borderStrong`, `muted` to `textSecondary`
  and removes the grain. `forced-colors: active` drops decoration and keeps real borders.

**Ambient album tint** (from the earlier ADR): when a page tints a surface with a cover's
dominant colour, clamp it to HSL L 18–25 % and S ≤ 45 % and keep text on `text`. Never tint
text or the accent.

---

## 4. Other tokens

| Group | Tokens | Web |
| --- | --- | --- |
| Spacing | 4 px grid: `THEME.space` 0…24 (0–96 px) | Tailwind default spacing (same 4 px grid) |
| Radii | `xs 2`, `sm 4`, `sleeve 6`, `md 8`, `lg 12`, `xl 16`, `pill` | `rounded-xs`, `rounded-sleeve`, default `rounded-*` |
| Shadow | `sm`, `md`, `lg`, `sleeve` (warm-tinted lift) | `shadow-om-sm/md/lg`, `shadow-sleeve`; legacy `shadow-analog`/`shadow-glow` now map to `om-md` |
| Duration | `instant 80`, `fast 140`, `base 200`, `slow 320`, `groove 1800` ms | `duration-fast`, `duration-base`… |
| Easing | `standard`, `enter`, `exit`, `tonearm` (gentle overshoot) | `ease-standard`, `ease-tonearm`… |
| Spring (mobile) | `THEME.spring.snappy`, `gentle` | n/a |
| z-index | `base 0`, `raised 10`, `sticky 100`, `playerBar 200`, `overlay 300`, `dialog 400`, `toast 500`, `tooltip 600` (grain 700, non-interactive) | `z-sticky`, `z-playerBar`, `z-toast`… |
| Animations | `spin-record`, `shimmer`, `toast-in`, `dialog-in` | `animate-*` |

**Motion rules:** UI feedback takes 140–200 ms with `ease-standard`. Only the record spin
loops. `prefers-reduced-motion: reduce` turns all animations and transitions into
near-instant changes globally, so state still changes but nothing moves.

---

## 5. Primitives (`apps/web/src/components/ui`)

All primitives are typed with strict TS, use Phosphor icons, show a visible `:focus-visible`
ring (`outline-focus`), and do not rely on colour alone.

```tsx
import {
  Button, buttonClasses, IconButton, Card, CardHeader, Avatar, Badge,
  Field, Input, Textarea, Tabs, Dialog, Skeleton, EmptyState, ErrorState,
  ToastProvider, useToast, RatingStars, starsFromRating, ratingFromStars,
  ScoreBadge, Spinner,
} from '@/components/ui';
```

| Primitive | Key props | Accessibility |
| --- | --- | --- |
| `Button` | `variant: primary \| secondary \| outline \| ghost \| danger`, `size: sm \| md \| lg`, `loading`, `loadingLabel`, `leadingIcon`, `trailingIcon`, `fullWidth` | `type="button"` by default; `aria-busy` and click-blocking while loading; label kept for stable width |
| `buttonClasses(opts)` | same style options | Style a Next `<Link>` as a button without nesting interactive elements |
| `IconButton` | `label` (required), `icon`, `variant: solid \| subtle \| ghost \| outline`, `size`, `pressed`, `loading` | `aria-label` + tooltip; `aria-pressed` for toggles |
| `Card` / `CardHeader` | `variant: surface \| sleeve \| outline \| sunken`, `padding`, `interactive`, `as`; header `eyebrow`, `title`, `level`, `action` | Semantic element via `as`; heading level is separate from size |
| `Avatar` | `name`, `src`, `size: xs…xl`, `status: live \| online \| ghost \| offline`, `decorative` | `role="img"` with name and status; initials fallback when the image fails |
| `Badge` | `tone: neutral \| accent \| fresh \| mixed \| rotten \| live`, `variant: soft \| outline \| solid`, `size`, `icon`, `mono` | Pair tone with icon/text |
| `Field` | `label`, `hint`, `error`, `required`, `hideLabel`, `aside`, render-prop child | Wires `id`, `aria-describedby`, `aria-invalid`, `aria-required` |
| `Input` / `Textarea` | All native props + Field props + `leadingIcon` (Input) | Built on `Field`; 16 px text on mobile to avoid iOS zoom; textarea auto-grows where `field-sizing` is supported |
| `Tabs` | `items: {id,label,icon?,count?,disabled?,content}[]`, `value`/`defaultValue`/`onValueChange`, `label`, `variant: underline \| pill` | WAI-ARIA tabs, roving tabindex, ←/→/Home/End |
| `Dialog` | `open`, `onClose`, `title`, `description`, `footer`, `size`, `dismissible`, `closeLabel` | Native modal `<dialog>` (focus trap, Esc, inert page); `closedby="any"` light dismiss with a fallback for Safari; scroll lock through `:has(dialog:modal)` |
| `Skeleton` | `shape: text \| rect \| circle \| cover`, `lines` | Decorative (`aria-hidden`); put `aria-busy` on the region |
| `EmptyState` | `title`, `description`, `icon`, `action`, `size` | Grooved disc by default; always offer a next step |
| `ErrorState` | `title`, `description`, `onRetry`, `retrying`, `action`, `variant: block \| inline` | `role="alert"`; human copy, never HTTP codes |
| `ToastProvider` / `useToast()` | `notify({title, description?, tone?, action?, duration?}) → id`, `dismiss(id)` | Polite region for info/success, assertive for errors; pauses on hover/focus; action supports Undo |
| `RatingStars` | `value` (0.5–5 stars or `null`), `onChange?`, `size`, `label`, `showValue`, `disabled` | Read-only is `role="img"`; interactive is a `role="slider"` with ←/→ ±0.5, PgUp/PgDn ±1, Home/End; pointer picks halves |
| `starsFromRating` / `ratingFromStars` | ADR-001 conversion `70 ↔ 3.5` | |
| `ScoreBadge` | `kind: critic \| audience`, `percentage \| null`, `totalReviews`, `status?`, `size` | Thumb up/down icon and text; full sentence in `aria-label` |
| `scoreStatus`, `FRESH_THRESHOLD` (70) | | |
| `Spinner` | `size`, `label` (`null` when decorative) | `role="status"` with a hidden label |
| `cn(...)` | class joiner | |

### Examples

```tsx
<Button loading={saving} loadingLabel="Salvataggio…" leadingIcon={<FloppyDisk />}>
  Pubblica recensione
</Button>

<Link href="/explore" className={buttonClasses({ variant: 'outline', size: 'sm' })}>
  Esplora
</Link>

<IconButton label={isPlaying ? 'Pausa' : 'Ascolta anteprima'} pressed={isPlaying}
  icon={isPlaying ? <Pause weight="fill" /> : <Play weight="fill" />} variant="solid" />

<Card variant="sleeve" as="article" interactive>
  <CardHeader eyebrow="LP · 1997 · Parlophone" title="OK Computer" level={2} />
  <ScoreBadge kind="critic" percentage={94} totalReviews={38} />
  <ScoreBadge kind="audience" percentage={62} totalReviews={1204} size="sm" />
</Card>

<Input label="Email" type="email" autoComplete="email" required
  error={errors.email} hint="Non la mostriamo a nessuno." />

<Textarea label="La tua recensione" aside={`${text.length}/3000`} maxLength={3000}
  value={text} onChange={(e) => setText(e.target.value)} />

<RatingStars label="Il tuo voto per OK Computer" value={stars} onChange={setStars} showValue />
// persist: ratingFromStars(stars) → 10..100

<Tabs label="Profilo" items={[
  { id: 'diary', label: 'Diario', count: 128, content: <Diary /> },
  { id: 'reviews', label: 'Recensioni', content: <Reviews /> },
]} />

<Dialog open={open} onClose={() => setOpen(false)} title="Elimina recensione"
  description="Non potrai recuperarla."
  footer={<>
    <Button variant="ghost" onClick={() => setOpen(false)}>Annulla</Button>
    <Button variant="danger" onClick={remove}>Elimina</Button>
  </>} />

// once, near the root (e.g. in layout or a client Providers component):
<ToastProvider>{children}</ToastProvider>
const { notify } = useToast();
notify({ title: 'Brano salvato nello Scaffale', action: { label: 'Annulla', onAction: undo } });

<EmptyState title="Lo scaffale è vuoto"
  description="Salva un album dai Reels o dalla pagina di un disco."
  action={<Link className={buttonClasses()} href="/reels">Apri i Reels</Link>} />

<ErrorState variant="inline" title="La connessione con Spotify si è interrotta"
  description="I tuoi ascolti restano salvati." onRetry={reconnect} retryLabel="Riconnetti" />

<div aria-busy="true"><span className="sr-only">Caricamento…</span>
  <Skeleton shape="cover" /><Skeleton shape="text" lines={2} /></div>
```

---

## 6. Do / Don't

**Do**

- Use semantic tokens (`bg-surface`, `text-ink-secondary`, `border-line-strong`) or `THEME`.
  If you need a new role, add it to `THEME.scheme`, `globals.css` and the Tailwind config together.
- Use `font-mono tabular-nums` for every number, duration and percentage.
- Pair every status colour with an icon or a word (fresh = thumbs-up icon + %, rotten = thumbs-down icon + %).
- Use `<Card variant="sleeve">` for music objects (albums, tracks, reviews), and plain
  `surface` for UI containers (settings, forms).
- Use `.om-eyebrow` + `.om-headline` (+ `.om-deck` if needed) to open a page.
- Write copy like a record-shop clerk: "In rotazione tra i tuoi amici", "La puntina è saltata".
- Use `Button`'s `loading` state for async actions. Use `Skeleton` for first loads and
  `EmptyState` / `ErrorState` for the other two states every screen must design.
- Keep touch targets ≥ 40 px (`md` sizes) on mobile layouts.

**Don't**

- No `#000`, no `#FFF`, no purple/indigo/cyan, no neon gradients, no coloured `box-shadow` glows.
- No glassmorphism stacks. One `backdrop-filter` (the dialog backdrop) is enough.
- No hardcoded hex values in components. `text-white`/`bg-black` are banned too.
- Don't set long UI copy, buttons or form labels in Fraunces.
- Don't use colour as the only signal, and don't remove focus outlines (`outline-none`)
  without the `focus-visible` replacement the primitives already provide.
- Don't stack several signature touches on one element (grain is global; at most one of
  sleeve, grooves or drop cap per block).
- Don't animate layout or loop anything except the record spin, and never ignore
  `prefers-reduced-motion`.
- Don't show HTTP codes or stack traces to users.

---

## 7. Migration notes for page owners

1. Pages keep working: legacy `om-*` colours and `shadow-glow`/`shadow-analog` map to the
   new variables. Visually they shift to the warmer palette and `text-om-muted` now meets AA.
2. Replace ad-hoc buttons, inputs, modals and score boxes with the primitives above
   (`DualScoreBadge` → two `ScoreBadge`s; `ShareSongModal`/`StoryListeningModal` → `Dialog`).
3. Replace `text-white`, `bg-black/…`, hardcoded hex and `om-om-*` typos with semantic tokens.
4. Mount `<ToastProvider>` once in a client providers component when the first page needs it.
