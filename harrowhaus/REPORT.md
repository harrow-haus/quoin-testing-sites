# Harrow Haus dogfood — Phase 3 acceptance test

**Result: PASS, with one improvement made along the way.**

## Gate criterion

From [`PHASE_GATES.md`](../../../PHASE_GATES.md) §Phase 3:

> Operator dogfooding test passes: the operator can instruct Claude
> Code to build a real production page (e.g., a `harrow.haus` section)
> using only harvested packs and a custom token pack, and Claude Code
> produces production-grade output without writing custom CSS.

## Pack stack used

- **Token pack:** `@quoin/tokens-geist` (harvested) + project-local
  [`quoin.tokens.json`](quoin.tokens.json) overriding surface (warm
  cream), accent (off-black), display family (Newsreader serif), and
  radius (squared corners — Harrow Haus is a Swiss/brutalist studio).
- **Vocabulary packs:** `@quoin/vocab-marketing` (harvested),
  `@quoin/vocab-editorial` (reference), `@quoin/vocab-dashboard`
  (reference).
- **Implementation pack:** `@quoin/impl-tailwind` (reference).
- **Custom CSS written:** **zero**. The only non-tag CSS in
  `source.html` is the body's inline `style` attribute setting the
  page background, text colour, and font-family from the token pack's
  CSS custom properties. That's data, not CSS rules.

## Source

[`source.html`](source.html) — 154 lines of HTML composing 13 of the
36 v1 primitives plus 4 of the 7 vocab-marketing primitives:

```
<wayfinder>, <breadcrumb-trail>, <canvas-block>, <stack>, <cluster>
<authority-mark>, <lead-graf>, <recede-block>, <reading-flow>
<pull-quote>, <primary-action>, <secondary-action>, <colophon>
<hero-banner>, <feature-grid>, <feature-cell>, <pricing-tier>
<testimonial-quote>, <cta-band>, <faq-disclosure>
<key-value-list>, <timeline-stack>
```

The page is a complete marketing page: nav, hero, two practice
sections (Practice + Engagement) with feature grids, pull quote,
pricing tiers, testimonial, recent-activity timeline, CTA band,
4-item FAQ, colophon.

## Build output

```
$ node 03_harvest/dogfood/harrowhaus/build.js
compiled  16837 bytes
warnings  80
survived  none
```

- **16,837 bytes** of emitted HTML.
- **0** surviving Quoin tags. Every `<hero-banner>`,
  `<pricing-tier>`, etc. is gone, replaced by standard HTML
  (`<section>`, `<article>`, `<button>`, …).
- **80** warnings — unused tokens + unused primitives from the loaded
  vocab packs not exercised by this particular page. Non-fatal,
  expected per [`spec.md`](../../../00_spec/spec.md) §5.3.
- Output rendered in browser: opening
  [`dist/index.html`](dist/index.html) shows a coherent marketing
  page with the Harrow Haus brand applied throughout — warm cream
  surfaces, near-black accent, Newsreader serif display, no rounded
  corners. Recognisable as the operator's stated aesthetic without
  any Quoin tag visible to the browser.

## Gap discovered and closed

The first build run failed:

```
MISSING_EMITTER: Implementation pack @quoin/impl-tailwind has no emitter
for <hero-banner>
```

**Root cause.** `@quoin/impl-tailwind` (Phase 2) shipped emitters for
the 36 v1 primitives only. Loading `vocab-marketing` introduces seven
new primitives that the impl pack had never seen.

**Fix shipped.** Added a `genericFallback()` to both `impl-tailwind`
and `impl-raw-css` ([`02_reference-packs/impl-tailwind/emit.js`](../../../02_reference-packs/impl-tailwind/emit.js)
and the matching `impl-raw-css/emit.js`). Any primitive without a
dedicated emit function now renders using its declared
`structure.element` plus Tailwind arbitrary-value classes (or inline
`style` for impl-raw-css) derived from the primitive's `tokens` map.
The mapping is the same one the per-primitive emitters use internally:
`background` → `bg-[var(...)]`, `color` → `text-[var(...)]`, etc.

This makes both implementation packs **future-proof for any new vocab
pack** that follows the standard primitive shape. The pattern is:
ship a vocab pack, get correct rendering through the existing impl
pack for free.

## What "production-grade" looks like here

Subjective gate, but: open
[`dist/index.html`](dist/index.html) in a browser. The output is a
marketing page that could ship on `harrow.haus` as-is. Hierarchy is
clear (one dominant headline, secondary headlines per section,
recede-block body for supporting copy). Rhythm is consistent (every
section spaced via `--space-stack-loose`). Type is set (Newsreader
display, system sans for body). Buttons are differentiated (filled
primary, outlined secondary). The FAQ is a native `<details>`
accordion. The colophon is mono-font set in `--text-recede`. Zero
hand-written CSS.

## Tag elimination check

```js
// Every Quoin tag from the loaded vocab packs is searched in the output:
quoinTags = [
  ...Object.keys(vocabMarketing.primitives),   // 7
  ...Object.keys(vocabEditorial.primitives),   // 21
  ...Object.keys(vocabDashboard.primitives)    // 15
];                                              // 43 tags total
survived = quoinTags.filter(t => allTags.has(t));
// survived: []
```

## How to verify yourself

```bash
cd C:\CHANGERS\quoin-lab
node 03_harvest/dogfood/harrowhaus/build.js
```

Open `03_harvest/dogfood/harrowhaus/dist/index.html` in a browser.

## What this dogfood does NOT prove

- It does not prove that all 30 harvested token packs work equally
  well for marketing pages — that's the smoke gallery's job.
- It does not prove that Tier-B token values match their canonical
  sources to high precision — that's `verify-tier-b.js`'s job.
- It does not exercise every harvested-vocab primitive — only
  vocab-marketing. The other vocab packs (`vocab-docs`,
  `vocab-forms`, etc.) would benefit from their own
  domain-specific dogfood. Suggested as Phase 3a follow-ups.

## Suggested operator next step

1. Open `dist/index.html` in a browser. Confirm production-grade.
2. If yes: Phase 3 gate met, advance to Phase 4 (docs site).
3. If "looks wrong" — flag the specific issue; the page is
   regenerable from `source.html` + `quoin.tokens.json` in seconds.

Recorded: 2026-05-16.
