---
name: Uzhunnungal Traders
description: Hill-produce trading management — coffee & black pepper, cash-basis accounting
colors:
  ink: "#1c1410"
  espresso: "#2a1c16"
  roast: "#3d2a22"
  paper: "#f6efe4"
  card: "#fffaf3"
  line: "#e4d5c4"
  muted: "#7a6556"
  coffee: "#7a3e1d"
  pepper: "#5c1f2e"
  gold: "#c9a227"
  ok: "#2f6b3a"
  warn: "#b45309"
  danger: "#9f1239"
  receive: "#1d5c4a"
  pay: "#8a2e1a"
  white: "#ffffff"
  cream: "#f3e6d6"
  sand: "#d8c4b2"
  sand-dim: "#cbb8a6"
  sand-label: "#a68f7c"
  row-hover: "#fbf4ea"
  selected-row: "#f3e6d4"
  tag-bg: "#efe3d2"
  tag-pepper-bg: "#f3dce3"
  tag-warn-bg: "#ffedd5"
  tag-ok-bg: "#dcfce7"
  tag-pay-bg: "#fee2e2"
  tag-receive-bg: "#d1fae5"
  tag-gold-bg: "#f3e5bd"
  due-pay-line: "#f3c4b8"
  due-receive-line: "#b8e4d4"
  due-ok-line: "#cfe8d4"
  alert-error-bg: "#fbe7ec"
  alert-error-line: "#f2c2d0"
  logout-hover: "#ffcdd2"
  mark-shine: "#e8c47a"
  mark-depth: "#3d1a12"
  bill-pink: "#f8e7ec"
  bill-red: "#b91c1c"
  rule-light: "#b9a896"
typography:
  display:
    fontFamily: '"Fraunces", Georgia, serif'
    fontSize: "clamp(26px, 4vw, 32px)"
    fontWeight: 600
    lineHeight: 1.2
  metric:
    fontFamily: '"Fraunces", Georgia, serif'
    fontSize: "28px"
    fontWeight: 400
  modal-title:
    fontFamily: '"Fraunces", Georgia, serif'
    fontSize: "22px"
    fontWeight: 600
  brand:
    fontFamily: '"Fraunces", Georgia, serif'
    fontSize: "18px"
    fontWeight: 600
  doc-title:
    fontFamily: '"Figtree", "Segoe UI", sans-serif'
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "0.14em"
  body-lg:
    fontFamily: '"Figtree", "Segoe UI", sans-serif'
    fontSize: "16px"
    fontWeight: 400
  body:
    fontFamily: '"Figtree", "Segoe UI", sans-serif'
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  body-sm:
    fontFamily: '"Figtree", "Segoe UI", sans-serif'
    fontSize: "13px"
    fontWeight: 600
  label:
    fontFamily: '"Figtree", "Segoe UI", sans-serif'
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.06em"
  label-md:
    fontFamily: '"Figtree", "Segoe UI", sans-serif'
    fontSize: "12px"
    fontWeight: 600
  label-sm:
    fontFamily: '"Figtree", "Segoe UI", sans-serif'
    fontSize: "10px"
    fontWeight: 700
    letterSpacing: "0.12em"
  icon:
    fontFamily: '"Figtree", "Segoe UI", sans-serif'
    fontSize: "24px"
    fontWeight: 400
rounded:
  xs: "6px"
  sm: "8px"
  md: "10px"
  mark: "12px"
  lg: "16px"
  xl: "18px"
  xxl: "20px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
components:
  button-primary:
    backgroundColor: "{colors.espresso}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  button-gold:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  button-secondary:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
  tag:
    backgroundColor: "#efe3d2"
    textColor: "{colors.coffee}"
    rounded: "{rounded.pill}"
    padding: "3px 8px"
---

# Design System: Uzhunnungal Traders

## Overview

**Creative North Star: "The Estate Ledger"**

The interface is the trader's bound ledger at the weighbridge: ink on paper, kept with a gold-nib pen. Warm espresso ink, cream paper surfaces, and one precious metal — gold — used the way a nib touches the page: rarely, and only where the hand commits an action. It is an Operate-mode system: scanability, one left axis, and honest numbers outrank expression, and the brand lives in precise details — the gold inset on the active nav line, tabular figures in money columns, the pepper tag beside the coffee one.

Density is working-desk density: forms stacked in one rhythm, tables flush with their cards, no decorative chrome. Components feel **tactile and confident** — solid fills, real borders, buttons you can press one-handed at a weighbridge. Printed output (party statements, the formal Bill of Supply) is the same identity on white: Fraunces headings, espresso rules, paper-tinted table headers — never foreign office grays.

**Key Characteristics:**
- Warm product-derived palette (coffee, pepper, gold) on paper tints — no cold grays anywhere, including print
- Fraunces serif for display and figures of account; Figtree for everything functional
- One spacing scale (4–32px) and one left axis per card: titles, table cells, and body copy align
- Cash-basis vocabulary rendered as `.tag` pills: pay/receive, expense/income, settled/pending
- Depth is a single soft ambient shadow on cards; everything else is flat paper

## Colors

The palette is brewed, not picked: every hue traces to the produce (coffee cherry, black pepper, cured bean) or the ledger (ink, paper, gold nib).

### Primary
- **Espresso Ink** (#2a1c16): The voice of action — primary buttons, the sidebar gradient, the rules under printed letterheads. The darkest surface the system knows.
- **Ledger Gold** (#c9a227): The committing hand. Reserved for the active-nav inset, the save/print actions that finalize money (`button-gold`), focus rings, and the advance-deduction well's dashed border. Scarcity is the point.

### Secondary
- **Coffee Bean** (#7a3e1d): Links, input carets, the default tag, info toasts, and sub-headings inside wells.
- **Pepper Corn** (#5c1f2e): The second commodity's accent — `tag.pepper`, the `btn.pepper` variant. Never used for generic decoration.

### Tertiary
- **Receive Green** (#1d5c4a): Money coming in — `tag.receive`, due-box receive borders.
- **Pay Terracotta** (#8a2e1a): Money going out — `tag.pay`, due-box pay borders.
- **Settled Green** (#2f6b3a): OK states, success toasts, settled tags.
- **Warning Amber** (#b45309): Pending weights and amounts awaiting pricing.
- **Danger Rose** (#9f1239): Errors, delete intent, logout hover.

### Neutral
- **Deep Ink** (#1c1410): Body text.
- **Paper** (#f6efe4): Page background; tinted inset for the advance well and print table headers.
- **Card Cream** (#fffaf3): Card and modal surfaces — one step lighter than paper.
- **Hairline** (#e4d5c4): All borders, table rules, input strokes.
- **Muted Bark** (#7a6556): Secondary text, table headers, section labels.

**The One Nib Rule.** Gold appears at most once per view as an action (the committing button) plus once as wayfinding (the active-nav inset). If two gold buttons compete on one screen, one of them is lying about being final — demote it to espresso or secondary.

**The No Foreign Grays Rule.** Error, info, and neutral tints are derived from the palette (rose from danger, cream from card), never from `#f8f9fa`-style office grays. Printed documents keep the same rule: espresso rules and paper-tinted headers, not black-and-gray.

## Typography

**Display Font:** Fraunces (600; Georgia serif fallback)
**Body Font:** Figtree (400/600/700; Segoe UI fallback)

**Character:** Fraunces is the ledger's display hand — old-style warmth with sharp optical sizing — used for page titles, metrics, brand, and printed company names. Figtree is the working hand: compact, legible, unpretentious. The pairing says "kept books," not "software dashboard."

### Hierarchy
- **Display** (Fraunces 600, clamp(26px, 4vw, 32px), tight 1.2): Page topbar titles and printed company names.
- **Metric** (Fraunces 400, 28px): Balances and KPI figures — the numbers of account.
- **Modal Title** (Fraunces 600, 22px): Dialog headings (`.modal-title` — one spec, no inline variants).
- **Body** (Figtree 400, 14px): Table cells, form values, prose.
- **Label** (Figtree 600–700, 11–13px, 0.06–0.12em tracking, uppercase): Card titles, table headers, tags, nav group labels.
- **Numeric** (Figtree 400/700, tabular-nums via `.num`): Money and weight columns — always right-aligned, always tabular.

**The Two Hands Rule.** Fraunces never sets form controls, buttons, or table body text; Figtree never sets page titles or metrics. If a third voice appears (Helvetica, system display faces), it is a bug — print documents included.

## Layout

A 260px dark sidebar (espresso gradient, sticky) plus a fluid main column padded 24/32px. The sidebar's brand block, nav links, and logout button share one left axis (16px sidebar padding + 12px inset). The nav is grouped: **Trade · Money · People · Reports** under a standalone Dashboard, with uppercase group labels.

All rhythm comes from one spacing scale (`--s1..--s6` = 4/8/12/16/24/32). Direct children of a page (`card`, `grid`, `ledger-head`, `p`) carry a 16px bottom margin from CSS — never inline styles. Inside cards, first/last table cells have zero horizontal padding so column text aligns with the card title above it. Forms are single `stack` grids (12px gaps) with `.row`/`.row3` two- and three-up splits.

**Responsive:** Below 1100px the grids halve and the sidebar stacks above content. Below 700px: all grids and form rows collapse to one column, the sidebar becomes a compact top bar with horizontally scrolling nav pills (gold underline marks active), inputs jump to 16px (no iOS focus-zoom), small buttons grow to 36px targets, and wide tables scroll inside `.table-wrap` wrappers.

**The Own-Your-Axis Rule.** If an element needs nudging with an inline margin, the stylesheet is missing a rule — add the class, delete the style attribute.

## Elevation & Depth

Soft ambient lift, used once. Cards rest on paper with a single diffuse shadow; modals and toasts deepen the same shadow rather than inventing new ones. The sidebar, login gradient, and print documents are flat. No hard offset shadows, no colored halos, no glass.

### Shadow Vocabulary
- **Card Ambient** (`box-shadow: 0 10px 30px rgba(28,20,16,0.08)`): Default card lift. The only resting shadow.
- **Raised** (`box-shadow: 0 8px 24px rgba(28,20,16,0.18)`): Toasts and transient overlays above the page.
- **Print**: none — `@media print` strips all shadows.

**The Flat Ink Rule.** The sidebar and printed sheets never cast shadows. Ink sits on paper; it does not hover above it.

## Shapes

Gently curved, like worn leather corners. Buttons and inputs share a 10px radius (small buttons 8px), cards 16px, modals 18px, the login box 20px, tags fully round pills. Borders are 1px hairlines; the only 2px borders are the due-box variants and printed letterhead rules, where weight carries meaning.

## Components

### Buttons
- **Shape:** Gently rounded (10px; `.sm` 8px), 38px minimum height, inline-flex with 6px icon gap.
- **Primary (espresso):** Default action — espresso fill, white text.
- **Gold:** The committing action (save payment, print statement) — one per screen (see The One Nib Rule).
- **Secondary:** White fill, hairline border, ink text — cancel and utility actions.
- **Small (`.sm`):** 30px table-row actions (Repay, Print Formal Bill) — one spec everywhere.
- **Danger / Pepper:** Destructive and commodity-accented variants, used sparingly.
- **States:** disabled at 50% opacity; gold `:focus-visible` ring (2px, offset 2px) on everything interactive.

### Cards / Containers
- **Corner Style:** Soft (16px).
- **Background:** Card Cream on Paper.
- **Shadow Strategy:** Card Ambient only (see Elevation).
- **Border:** 1px Hairline; `due-box` variants thicken to 2px with pay/receive/ok tints.
- **Internal Padding:** 16px; titles are uppercase labels with 12px below.

### Inputs / Fields
- **Style:** White fill, 1px hairline, 10px radius, 10/12px padding; labels are 13px muted 600-weight above the control in a `stack` grid.
- **Focus:** Coffee border plus the global gold ring.
- **Error:** Errors surface as persistent `alert`-role toasts with a dismiss button, or `.alert.error` boxes (rose tint on cream) inside the page — never bare red text.

### Navigation
- **Style:** Dark espresso sidebar; links are 14px warm-sand text in 10px-radius pills, grouped under uppercase 10px labels.
- **Active:** Paper-tinted fill with a 3px gold inset bar and `aria-current="page"`.
- **Mobile:** Horizontal scrolling pill strip; active switches to a gold underline.

### Tags
- **Style:** Pill (999px), 11px 700-weight, tinted background with deep tinted text — default (cream/coffee), `pepper`, `warn`, `ok`, `pay`, `receive`, `gold`. They carry the cash-basis vocabulary; color is never the only signal (the label says the word).

### Tables
- Flush first/last cells, 11px uppercase muted headers with `scope="col"`, paper-warm row hover, right-aligned tabular numerics. Wide tables live in `.table-wrap` scrollers on small screens; `tr:hover` tints `#fbf4ea`.

### Toasts
- Top-right stack, 14px 600-weight white on ok/coffee/danger. Success and info fade in 4s (`role="status"`); errors persist with a dismiss button (`role="alert"`).

### Modal
- One system only: `openModal()` — centered 640px card on a 45% ink scrim, absolute close ×, `role="dialog"` + `aria-modal`, labelled by its heading, focus trapped inside, Esc/backdrop close, focus restored on exit. Native `<dialog>` is retired.

### Print Documents
- Shared `print.css`: A4 portrait, 15mm margins; `.print-doc` sheet, `.print-head` espresso rule under the letterhead, bordered `print-table` with paper-tinted headers, `.print-totals` with double-rule totals, `.sign-box` signature lines. The toolbar (`.print-bar`) and `.no-print` elements vanish on paper.
- The blank **Bill of Supply bill book** (`/bill-book`, `.bb-*`) follows traditional stationery: pure white sheet, thin ink rules, dotted fill lines, a light pink header accent (bill-pink, pepper-tint family), light tan row ruling (rule-light), and a red pre-printed serial (bill-red) — the one sanctioned red accent, because bill books demand it.

## Do's and Don'ts

### Do:
- **Do** space with the scale tokens (4/8/12/16/24/32) and let `.main` children inherit their 16px separation from CSS.
- **Do** render money right-aligned in tabular numerals (`.num`) and format through `format.ts` (`money`, `kg`, en-IN).
- **Do** use the tag vocabulary for direction of money — `pay`/`receive` — with the word in the pill, never color alone.
- **Do** give new dialogs to `openModal` with an `h3.modal-title`, and new tables `scope="col"` headers inside `.table-wrap`.
- **Do** keep printed output on the shared print system — Fraunces letterhead, espresso rules, paper tints.
- **Do** disable the submit button while a save is in flight, and toast the outcome (`success` short, `error` persistent).

### Don't:
- **Don't** introduce inline `style` attributes — a missing class is a stylesheet gap, not a license.
- **Don't** spend gold on more than one action per screen, or on anything that doesn't commit something.
- **Don't** use foreign grays, Helvetica, or system display faces — on screen or on paper.
- **Don't** build a second modal, print, or toast system; extend the existing one.
- **Don't** leave interactive targets under 36px on mobile, or inputs under 16px at phone width.
- **Don't** show raw IDs, enum constants, or sign ambiguity to users — names, words, and `Dr`/`Cr` conventions only.
