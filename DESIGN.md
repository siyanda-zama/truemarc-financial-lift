# Truemarc Consultants: site system (read before touching any page)

## What this site is for
Truemarc (Bethal, Mpumalanga, since 2015) helps South Africans who are **declined for credit**: bad payment
profiles, defaults and judgments, debt review (and exiting it), fraud listings, trace alerts, admin orders,
plus paralegal blacklisting help. Minor lines: labour relations, general consulting.

**The site is a lead machine.** Every page exists to move a worried visitor to one of three actions:
1. Complete the **free assessment** (`<Assessment />`: 3 one-tap questions → name + mobile). Primary.
2. **WhatsApp** (pre-filled message). 3. **Call** 061 544 9643.
Visitors are stressed, often on mobile, often on data. Be calm, clear, fast, respectful. Never shame.

Benchmark: SA banks (Old Mutual, Standard Bank, African Bank) for polish and trust, DebtSage for lead capture.

## Brand
- Tokens live in `src/styles/brand.css` (`:root`). Use them, never raw hex.
  Night `--night` ground · logo navy `--navy` · logo red `--red` (actions + highlights only) ·
  `--red-bright` for accent text on dark · `--mist`/white light sections · `--green` ONLY for positive status ("approved / cleared", "open now").
- Font: Hanken Grotesk Variable (already loaded). Headlines 700, tight tracking. Body 1.0625rem/1.6.
- Signature shape: the logo's **red ring** (+ navy "T" swoosh): `<Ring />` from `@/components/brand/Brand`.
  It doubles as a **credit score ring** (red → green = the client's story). Use ONE per view, give it a job.
- Logo: `<Logo />` (dark text, for white grounds) or `<Logo tone="light" />` (for dark grounds). Never re-typeset it.
- Photos (static images live in `/img/`; `/media/` is reserved on the server for runtime uploads): `/img/team-hero.webp`, `/img/consultant-female.webp`, `/img/consultant-male.webp` (+ `-960` versions).
  Stock-style; we will replace with real team photos later. Prefer bespoke CSS/SVG visuals
  (credit report cards, score rings, documents, stamps) over more stock.
- Section rhythm: alternate grounds (night → white → mist → night). Generous space: `.sec` uses `--sec` padding.

## Copy rules (non-negotiable; full list in ~/.claude/skills/brand-site-revamp/references/anti-slop.md)
- **No eyebrow/kicker labels** above headings. **No "01 / 02" ornamental numbering.** A heading stands alone.
- Headline = the promise in ≤ 7 words; a 2-line hero puts line 2 in the accent. Lede = ONE sentence.
- Section headings say the point ("Your name, cleared the legal way.") not the category ("Our services").
- Cards: title + ≤ 2 short lines. No three-sentence bodies. No walls of text, ever (except /learn articles,
  which are still scannable: short paragraphs, H2s every ~150 words, lists).
- Every section ends by leading somewhere (assessment, WhatsApp, call, or the obvious next section).
- South African English (organisation, licence, cheque). Rands as `R20,000`. Numbers as `061 544 9643`.
- **Facts only from the client:** since 2015 · 1,000+ clients helped · Bethal office address · phones · email ·
  hours · services list · "call back within 24 hours" · free consultation/assessment · "impacting lives".
- **Never write:** "100% success rate", guarantees of removal or approval, NCR registration numbers, fabricated
  testimonials/reviews/star ratings/quotes, invented statistics, "as seen on", fake team names. If a section
  needs any of these, build it so it's easy to drop real content in later and list it in your final report.
- Legal accuracy: South African credit law (National Credit Act, credit bureau retention rules, debt review
  process, rescission of judgments). When in doubt, be general and conservative, and flag it for review.
- Anything you wrote (headlines, steps, FAQ answers) is DRAFT copy for client approval; list it in your report.

## Components (use these; don't fork them)
| Import | Use |
|---|---|
| `Seo` from `@/components/Seo` | EVERY page: title (≤ 55 chars; " \| Truemarc" suffix auto-added, so don't repeat the brand), description (140–160), path, jsonLd; `type="article" published modified` on guides |
| `organizationLd, breadcrumbLd, serviceLd, articleLd` from `@/lib/schema` | JSON-LD builders |
| `PageHero` from `@/components/blocks/Blocks` | Dark inner-page hero: `lines`, `lede`, `actions`, `fine`, `visual`, `crumbs` |
| `SecHead, TrustRow, Steps, Faq, faqJsonLd, CtaBlock, GoLink` from `@/components/blocks/Blocks` | Shared sections. `CtaBlock` = closing section with the assessment; put it near the end of most pages |
| `Assessment` from `@/components/assessment/Assessment` | The lead funnel. Props: `source` (required, e.g. `"service:debt-review"`), `variant` hero/card/page, `preset` (SituationId), `firstQuestion` |
| `Icon, WhatsAppIcon` from `@/components/Icon` | Icons by name (lucide); WhatsApp glyph |
| `Logo, Ring` from `@/components/brand/Brand` | Brand lockup and signature shape |
| `BUSINESS, SERVICES, SITUATIONS, GOALS, DEBT_BANDS, PRIMARY_PHONE, ASSESS_PATH, waLink, serviceBySlug` from `@/lib/site` | All business facts. Don't hard-code phone numbers etc. |
| `track` from `@/lib/leads` | Analytics events: `track('cta_click', { placement })`, `click_call`, `click_whatsapp` |
| `usePageMotion(ref, extra?)` from `@/lib/motion` | One per page on the page root. Class contract documented in the file |
| `SplitText` from `@/components/bits/SplitText` | react-bits word-rise headline (hydration-safe patch inside). Use sparingly |

Shared CSS classes (brand.css): `.wrap .sec .sec--mist .sec--night .sec--tight .h1 .h2 .h3 .display .lede .fine
.muted .accent .btn (.btn--red/navy/white/ghost/line/wa, --sm/--lg/--block) .go .tile .card .chip .steps .trust`.
Tailwind is available but prefer the brand classes + your page CSS file. Tailwind preflight is ON
(lists have no bullets, headings inherit size): style article prose explicitly.
**Class-name collisions:** Tailwind generates a utility for any class name it sees, so a BEM class that equals a
Tailwind utility gets extra styles (we hit this: `.ring` drew a blue box-shadow). Always use block-prefixed names
(`.home-hero`, `.svc-card__grid`), never bare words like `ring`, `grid`, `table`, `hidden`, `container`, `shadow`,
`border`, `outline`, `sticky`, `prose`, `transform`, `filter`, `blur`, `contents`, `collapse`, `visible`.

## Motion
GSAP + ScrollTrigger + Lenis are wired (`src/lib/smooth.ts`, `src/lib/motion.ts`). Rules: purposeful, calm,
expo easing; one memorable scroll scene per page at most; pinned scenes only at ≥ 960px with motion allowed
(`DESKTOP_STORY` media query; mirror it in CSS so content stacks normally otherwise). Respect reduced motion.
Mark scroll-revealed blocks with `data-reveal`. Never animate the primary CTA out of view.

## SSR / prerender safety
`npm run build` prerenders every route to static HTML (`scripts/prerender.mjs`, `src/entry-server.tsx`) and
`npm run check` validates titles, descriptions, canonicals, og tags, one h1 and JSON-LD on every built page.
The client hydrates that HTML. While hydrating, `document.documentElement.dataset.hydrating === '1'`
(`isHydrating()` in `@/lib/motion`): SplitText renders visible without an entrance and `usePageMotion` skips hero
entrances and leaves on-screen `[data-reveal]` blocks alone. Guard any custom on-load `gsap.from` with
`if (!isHydrating())`, or the first paint blinks visible → hidden → visible.
- No `window`/`document`/`localStorage` at module top level or during render. Use them only inside effects/handlers.
- No randomness or `Date.now()` in render output. Content must render fully without JS (no content hidden until JS runs
  except via GSAP which only runs client-side).
- One `<h1>` per page. Real `<a href>`/`<Link>` for navigation. Images: width/height attributes, `loading="lazy"`
  below the fold, meaningful `alt` (empty alt for decorative).

## File ownership (agents must stay inside their files)
| Owner | Files |
|---|---|
| Lead | `src/lib/site.ts`, `src/lib/leads.ts`, `src/lib/smooth.ts`, `src/lib/motion.ts`, `src/components/blocks/*`, `src/components/brand/*`, `src/components/Icon.tsx`, `src/styles/brand.css`, `src/App.tsx`, `DESIGN.md` |
| Home agent | `src/pages/Home.tsx`, `src/components/home/*`, `src/styles/pages/home.css`, `src/components/assessment/*`, `src/styles/assessment.css` |
| Services agent | `src/pages/services/*`, `src/pages/HowItWorks.tsx`, `src/components/services/*`, `src/content/services.ts`, `src/styles/pages/services.css` |
| Company & content agent | `src/pages/About.tsx`, `Contact.tsx`, `FreeAssessment.tsx`, `Privacy.tsx`, `Terms.tsx`, `NotFound.tsx`, `src/pages/learn/*`, `src/content/articles.ts`, `src/components/company/*`, `src/styles/pages/company.css`, `src/styles/pages/learn.css` |
| SEO & technical agent | `index.html`, `vite.config.ts`, `src/main.tsx`, `src/entry-server.tsx`, `scripts/*`, `public/*`, `server/api/*`, `deploy-kit/*`, `.github/*`, `package.json` scripts, `src/components/Seo.tsx`, `src/lib/schema.ts`, `src/components/layout/*` |
Need a change in someone else's file? Don't make it: describe it in your final report.

## Verify before you report
- `npx tsc -p tsconfig.app.json --noEmit` and `npx vite build` pass.
- Dev server already runs at http://localhost:8080 (don't start another on 8080). Leads post to a dev stub that
  writes `.leads/leads.jsonl`.
- Screenshots: use `scripts/shot.sh <route> <out.png> [desktop|mobile] [height]` (headless Chrome; mobile is a true 390px
  viewport via an iframe). Do NOT use the claude-in-chrome browser tools (the lead is using that browser). Raw form:
  `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --hide-scrollbars --window-size=1440,900 --virtual-time-budget=8000 --screenshot=/path/out.png http://localhost:8080/route`
  (use a tall window, e.g. 1440x5000, to see the whole page; 390x3000 for mobile). Look at them.
