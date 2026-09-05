# Dev Log

One entry per meaningful change: what changed, why, when. Not a chat
transcript, not a commit-by-commit list, the reasoning that would otherwise
only exist in whichever session it happened in.
Append a new entry after finishing any meaningful piece of work, before the
session ends. See the instruction in `CLAUDE.md`. Newest entry at the top.
Format:

## YYYY-MM-DD — Short title

What changed, in plain sentences. Why, if it's not obvious from the what.
Anything a future session (in any tool) would need to know before touching
this area again.

---

## 2026-09-05 — Snapshot lock, lifecycle card, phone-first pages

Trey's issue list, same day:

- **Batch ingredient snapshot locks once brewing starts** (status leaves
  "planned"): remove buttons hidden AND deleteBatchIngredient refuses
  server-side. Same principle as brewed recipes: the snapshot is history.
  Additions stay allowed (bottling supplies land later); the panel heading
  says "locked: this is history now".
- **Active batch card follows the batch to the glass**: while fermenting it
  shows "Bottling ~<date>" from the (adjustment-aware) bottling-gate task;
  once conditioning it shows "In bottles day N of ~14 · First pour ~<date>"
  with a green progress bar. A batch stays the active batch until completed
  — "not complete till I can drink a beer".
- **Phone views are task-oriented, not shrunken desktop** (new
  .mobile-only/.desktop-only classes, ≤768px — iPads keep full tables):
  Purchases on a phone is a big "Scan a receipt" button plus a plain list
  (name, REVIEW badge for pending proposals, date, total); Stock is a
  shopping list grouped by kind with total on hand per product (water shows
  unlimited), no lots, no search, no chips. Desktop unchanged. Pattern for
  future pages: render both views, CSS picks one.
- Brew-day mode (timers/stopwatches, brief v2) is still NOT built; it's the
  next major feature and should get its own session.

Driven by Trey's SOLIGT calibration doc (RO water at 60F read 0.995) and
"I need a way to talk to Claude with the batch and change the data."

- **Instrument calibration on equipment**: calibrationOffset (+0.005 style,
  ADDED to raw readings — this flips applyInstrumentOffset's old subtract
  convention deliberately, matching Trey's doc; test updated),
  calibrationTempF, lastCalibratedAt, calibrationNotes. Form section on the
  equipment page. Raw readings stay stored untouched; correctedSg() in
  calc/gravity applies offset then temperature at display time, so refining
  the offset recalculates all history.
- **Corrected display everywhere it matters**: batch Gravity panel shows
  corrected OG/FG with itemized sub-line (raw 1.036 at 70°F · cal +0.005 ·
  temp +0.001), readings table corrected column includes the offset with a
  footnote naming the instrument, dashboard active-batch card matches,
  quick calc prefills the offset. Single-instrument assumption: newest
  calibrated active equipment wins; readings get an instrument FK only if a
  second hydrometer ever appears. Attenuation row compares against the
  batch's yeast lot's published attenuationPercent and badges when >10
  points apart (usually instrument, not beer).
- **batch_tasks table**: schedule stays DERIVED, but rows here override a
  derived task's due date (taskKey set) or add custom tasks (taskKey null,
  key "custom:<id>"). nextActions(batch, adjustments) merges; dashboard and
  banner pass the rows. Completions keep working via the same keys.
- **Chat proposals v2**: batch check-ins now return {reply, actions[]} —
  add_reading / update_reading / move_task / add_task / update_batch
  (whitelisted fields: og, ogTempF, fg, fgTempF, brewDate, bottledDate,
  status). Stored in proposedActionsJson; each renders as an Apply button;
  appliedActionsJson tracks clicked indexes. NOTHING applies without a
  click. v1 rows (proposedReadingJson) still render. Live-tested: "log my
  Sep 4 raw 1.006 at 70F, move the confirm reading to Sep 7, add a cold
  crash task" produced exactly three proposals; applying them put
  Sep 4 · 1.006 · corrected 1.012 (fg) in the table and both tasks on
  Next up. ~1.2 cents per exchange.

Trey's ask: "give it a picture for Claude to look at and tell it what's
going on as it's happening, such as the gravity reading on day 10."

- New `batch_checkins` table: one row per exchange (note, optional photo,
  Claude's reply, an optional structured reading proposal, and the id of the
  gravity reading it became once logged). The conversation renders on the
  batch page as a permanent sidecar log; the last 8 exchanges also feed the
  next prompt so Claude remembers what it said.
- `lib/brewing/batch-chat.ts`: Sonnet + image input, streaming with
  maxRetries 0 (the recipe-lookup billing lesson), effort low, ~1 cent per
  check-in (verified via ai_usage: ~1k in / ~450 out tokens). The prompt
  carries batch context (recipe targets, fermentation day, all readings,
  prior check-ins) and demands JSON {reply, reading|null}. The model
  sometimes emits literal newlines inside the reply string — invalid JSON —
  so the parser escapes control characters inside string literals before a
  retry parse. Keep that repair if the prompt changes.
- Reading proposals are never auto-logged (same rule as receipts/labels):
  "Log this reading" copies the raw value + temp into gravity_readings with
  the check-in's timestamp and stamps loggedReadingId so the button
  becomes "logged ✓".
- Photos live in dirname(DATABASE_PATH)/batch-photos, served owner-only via
  /batches/checkins/[id]/photo, mobile capture="environment" so the phone
  opens the camera. 12 MB cap like labels.
- Live-tested end to end with a synthetic seven-segment "1.014 / 68F"
  display photo: Claude read both numbers, computed attenuation from the
  batch's OG and prior reading, advised recheck in 2-3 days, and one click
  logged Sep 4 · 1.014 · 68F into the readings table.
- Prod schema migration for this: `git pull` then run db:push in a
  throwaway node:22-alpine container mounting the checkout and the
  app-data volume (host has no Node; the runtime image has no drizzle-kit).

Trey installed the PWA and it "did not look good": the fixed 200px side nav
ate half a phone screen and squeezed content into word-per-line wrapping.

- App chrome styles moved from inline props into globals.css classes
  (.top-bar*, .side-nav*, .app-main, .page-header*) so media queries can
  reshape them. At 1024px and below (phones AND iPads in portrait — iPads
  are 768-834px wide, so a 768px cutoff missed them; Trey asked for the tab
  bar on his iPad): the side nav becomes a fixed bottom tab bar
  (icon + tiny label, copper top-border on the active tab, safe-area inset
  for iOS), the logo block shrinks to fit, main padding tightens and clears
  the tab bar, the big page-header icon hides, and headers wrap. Desktop
  ≥768px is pixel-identical to before. The admin "Users" link stays a
  seventh tab for admins on mobile (its section label hides).
- Tables already scrolled inside .table-wrap and .dash-grid already stacked
  at 1200px, so no page-level changes were needed.
- New home-screen icons (copper mug + foam on the theme slate, full-bleed,
  "purpose: any maskable") replace the "BB" text placeholder. They're
  generated by scripts-free Node (raw RGBA + zlib + hand-built PNG chunks)
  — the generator lives only in session scratch; regenerate by redrawing if
  the icon ever needs to change. Android caches PWA icons: after deploying,
  remove and re-add the home-screen shortcut to see the new one.

Trey's first sign-in on prod failed silently, retry worked, same for a test
account. Reproduced locally on a production build: on a cold login page a
fast submit can be eaten by the server-action machinery before hydration
finishes (the network trace showed the action POST 303 then aborted, a stray
native POST to the wrong URL killing the navigation, and no session row
created). Retrying always works because the page is hydrated by then. Over
the internet that pre-hydration window is easily 1-3 seconds, exactly when
someone with autofill hits Sign in.

Two changes:

- **Login is now a plain HTML form POSTing to `/api/login`** (route handler:
  same credential logic, cookie via setSessionCookie, 303 redirects with
  RELATIVE Location so the Caddy proxy can't cause an http hop; failures
  redirect to `/login?error=1` which the page renders). No client JS, no
  hydration dependency, works from first paint. The old `login` server
  action is gone; `logout` stays an action since it only runs from hydrated
  pages. Don't convert login back to a server action.
- **Pages under (app) use `requireUser()`** (session.ts) instead of
  `(await getCurrentUser())!`. The layout's redirect does NOT protect pages:
  Next renders layout and page in parallel, so every unauthenticated hit to
  a page crashed its render with "Cannot read properties of null" (noisy in
  prod logs, and one race away from a user-visible error page). New pages
  must call requireUser(), never assert non-null.

First production deploy, done live with Trey. The app runs at
https://brew.unieksoftware.com on a Lightsail $7/1GB Ubuntu 24.04 instance
(static IP 18.116.225.61, us-east-2), Docker compose (app + Caddy), 2G swap
(the build needs it), Cloudflare DNS-only A record so Caddy could get its
Let's Encrypt cert (which it did on first try).

Decisions a future session should know:

- **Production was NOT seeded.** Instead of `db:push` + `db:seed`, the local
  `data/` folder (checkpointed brewbuddy.db + receipts/) was scp'd up and
  copied into the `brew-buddy_app-data` volume. Prod carries the full local
  history: users, purchases, receipts, batch #1, lookup history. From today,
  **prod is the real data home and local is a stale fork** — don't copy local
  over prod again without asking; that would erase live data.
- Receipts and labels resolve to `dirname(DATABASE_PATH)/receipts|labels`,
  so in the container they live inside the `/data` volume alongside the DB.
  One volume backs up everything.
- When replacing the DB file in the volume, stop the app first and delete any
  leftover `brewbuddy.db-wal`/`-shm` from a previous run before restarting —
  they belong to the old file.
- Server `.env` (only on the box, never committed): DOMAIN, the rotated
  ANTHROPIC_API_KEY, and APP_SECRET (never rotate; it encrypts stored BYOK
  keys). Local `.env` has the same rotated key.
- Updating prod: `cd brew-buddy && git pull && docker compose up -d --build`
  (deploy.md §5).
- Still pending: S3 backup bucket + cron (deploy.md §1.5/1.6/3), deleting the
  old Anthropic key from the console (new key verified working), PWA install.



Trey's follow-ups to the recipe lookup, all live-tested with a Sonnet
"Old Speckled Hen clone" run:

- **Clone-meaningful ratings** per candidate, judged by the model and
  clamped 1-5 server-side: "True to the real pint" (fidelity + a one-clause
  why, e.g. yeast authenticity), "Easy brew day (your setup)" (simplicity),
  and a source-provenance badge: PUBLISHED SOURCE (green, named book/
  brewery data) / COMMUNITY RECIPE (blue) / AI CONSTRUCTED (orange). The
  prompt demands differentiated scores.
- **Equipment check**: the prompt now includes Trey's ACTIVE equipment list
  (name + category); ingredients are always buyable, so the model judges
  only gear: {ready, missing[], notes} → "✓ Your gear covers this" or
  "⚠ Needs: …" per card.
- **Lookup history** (`recipe_lookups` table: query + full suggestions
  JSON): every lookup is saved; "Past lookups" chips on /recipes/new reopen
  a run via ?lookup=id, server-rendered from the stored JSON — no second AI
  call, no cost. Cards were extracted to components/suggestion-cards.tsx
  (hook-free, renders server- AND client-side; the adopt form works in both).
- Adoption appends the ratings line and equipment note to the recipe notes
  so they survive past the lookup screen.
- Model is **Sonnet, permanently, by Trey's instruction** ("Always use
  sonnet do not change that").

---

## 2026-08-28 — BYOK + usage metering: the two-tier foundation

Trey's plan: a free bring-your-own-key tier and a paid hosted-key tier with
caps. The foundation is in (caps/billing deliberately NOT built until a
real second user exists):

- **lib/ai/runtime.ts** is now the only way AI calls get a client:
  `aiRuntime(user, feature)` returns the user's own key (BYOK) else the
  house key, tagged source byok|house. User keys are AES-256-GCM encrypted
  with APP_SECRET (new .env var — MUST be set in production too, and
  changing it orphans stored keys). Keys are never sent to the client;
  settings only learns a boolean.
- **ai_usage table**: every API response logs feature/model/source/tokens/
  searches/estCostUsd (PRICING map in runtime.ts is estimates for metering,
  not invoices). All five AI features wired through: receipt, rescan,
  label, recipe-lookup, combine, rename. logAiUsage never throws.
- **Settings → AI panel**: paste/replace/remove your key; shows this
  month's call count and ~cost. The future cap reads these same rows.
- hasApiKey() checks became userHasAiAccess(user) (own key OR house key).
- smoke-receipt/smoke-label scripts build a manual rt.

Next per the plan: deploy first, structure only until demand: per-user
caps + rate limits + billing wait for a real paying user.

---

## 2026-08-27 — AI recipe lookup: "Caffrey's clone" → top 3 candidates

New recipe page gained a lookup box (components/recipe-lookup.tsx +
lib/brewing/recipe-ai.ts): describe a beer, Claude returns the top 3
candidate recipes (differentiated: true-to-source / simplest / elevated),
each a full spec + ingredient bill rendered as a card with "Use this
recipe" — adoption creates the recipe + items (adoptSuggestedRecipe, JSON
through a hidden input, validated/clamped server-side) and lands on it as
want_to_brew.

Model: **claude-sonnet-5** by Trey's explicit call (recipe hunting is
exploratory and reviewed before adoption; contrast receipts, which stay on
Opus because they're read once and cached). Web search stays on (max 5) so
clones use published numbers; the prompt tells the model the brewer runs an
extract setup. Live test with Opus produced "Caffrey's Clone (true to
tap)" / "Easy Pint" / "Velvet" with 12 items on the first — took ~3 min;
Sonnet should be faster. Takes 30s-3min either way; the pending copy says so.

---

## 2026-08-27 — ROOT CAUSE: React 19 strips inline styles from action forms

Trey's "edit pages look broken until I refresh, then break again when I
navigate back" was diagnosed to a React 19 behavior: on CLIENT-SIDE
navigation, a `<form action={someFunction}>` loses its inline `style`
attribute entirely (className and the styles of child divs survive; the
server-rendered HTML keeps the style, which is why a hard refresh always
looked right). Not a stale-cache issue — reproduced on a fresh .next.

HOUSE RULE FROM NOW ON: **never put a `style` prop on a `<form>` element.**
globals.css has utilities (.form-stack/.gap-sm/.gap-lg, .form-row,
.form-inline, .form-inline-flex, .form-push-right, .form-no-shrink); for
panel forms move the panel/maxWidth/padding to a wrapper div; for grid
forms put the grid on a div INSIDE the form. Every form in the app (~25
sites) was swept accordingly. If a page ever again looks unstyled after
navigation but fine on refresh, look for a style prop on a form first.

---

## 2026-08-27 — Recipe polish round: filters, beer glass, targets, template

- **Style family chips** on the recipes list (lib/brewing/beer-color.ts):
  freeform style text classifies by keyword regex, ORDER MATTERS (barrel
  before stout, IPA before pale before the "ale" catch-all). Chips render
  only for families with recipes, so the row grows as styles arrive.
- **Beer glass icon** per card (components/beer-glass.tsx), Untappd-style:
  fill color from targetSRM via the standard SRM hex chart, else the
  family's typical SRM. Real number wins when present.
- **Block Party targets from the OFFICIAL sources** (vendor-page-first, same
  rule as receipts): OG 1.042 from NB's kit-sheet PDF (correcting 1.044),
  ABV 4.3% from the product page, FG 1.009 derived, IBU 18 kept as estimate
  (NB says only "low <25"), SRM left null (not published; forum clone
  numbers deliberately NOT used). Provenance in the recipe notes; seed
  matches. Locked edit form now shows derived "Brewed" status, not the
  stale stored want_to_brew.
- **BeerXML template for AI recipe hunting** (lib/brewing/beerxml-template.ts
  + copy button on the import page): a skeleton with unit-teaching comments
  (liters, kilograms) that Trey pastes into an AI chat, then imports the
  filled result. A test locks the template to parseBeerXml compatibility.
- Breadcrumbs ("← Recipes") on recipe detail and import pages.

---

## 2026-08-27 — Brewed specs lock; Duplicate makes the tweakable copy

Once a recipe has batches its ingredient bill is HISTORY (batch snapshots
and miss analysis reference it), so the spec locks: remove links and the
add form disappear (a note explains why) and addRecipeItem /
deleteRecipeItem refuse server-side when recipeIsBrewed(). Tweaks happen on
a copy: the Duplicate button (recipe header) copies the recipe + items as
"<name> (my version)", status want_to_brew, and lands on the copy's edit
page for renaming. Targets/notes on brewed recipes stay editable (Trey may
correct a typo); only the ingredient bill is frozen.

Also: recipes gained the READY TO BREW status (want_to_brew + all
ingredients in stock, derived live from brewability, never stored) and the
recipe Delete became a real button.

---

## 2026-08-27 — Admin users: search/pagination, inline edit, real buttons

Users page gets the standard treatment (TableSearch + 10/25/50/all) and an
inline per-row Edit (name/email/role) via a client table. Guards in
updateUser: email uniqueness, and you can't demote yourself (another admin
has to). Buttons instead of text links: Deactivate is red (.btn-danger),
Reset orange (--warning), Reactivate green. SECURITY note worth keeping:
the client table takes AdminUserRow (picked columns), never full user rows;
passing db rows to a client component would ship password hashes in the RSC
payload.

---

## 2026-08-27 — No em dashes in UI copy; theme applies on click

Trey's style call: no em dashes in interface text ("Bottling — gate: two
matching readings" reads wrong to him). Swept EVERY user-facing string —
labels, subtitles, placeholders, error messages, confirm texts — replacing
" — " with colons, periods, commas, semicolons, or parentheses as fits.
Kept: "—" as the empty-value placeholder in table cells, em dashes in code
comments, and in AI prompts (the model reads those, not Trey). Edit page
titles became "Edit · Name". Write UI copy without em dashes from now on.

Theme moved out of the Profile form into its own Settings panel and applies
THE MOMENT a swatch is clicked (radio onChange → form.requestSubmit → a
dedicated setTheme action) — no Save button. updateProfile no longer
touches theme.

---

## 2026-08-27 — User menu, self-service settings, theme selector lands

The Copper/Stainless themes existed as CSS (`[data-theme=…]` variables)
since the design phase but had NO switcher. Now:

- **users.phone + users.theme** columns (live ALTER). Root layout reads the
  signed-in user's theme onto `<html data-theme>`; logged-out pages default
  Copper.
- **/settings** — self-service for EVERY user (regular users can't see the
  admin section, so this is their only account door): name/email/phone +
  theme swatch radios in one form (`updateProfile`, email-uniqueness
  checked, layout-scope revalidate so the top bar name and theme update
  immediately), change-password with current-password verification
  (`changePassword`, bcrypt 12 rounds, in lib/account/actions.ts).
  Phone is stored for the future text-alert feature — nothing uses it yet.
- **Top bar**: name + avatar is now a dropdown (user-menu.tsx) → My
  settings / Sign out. The standalone logout icon went away with it.
- **Dashboard cards de-wonked**: the auto-fit experiment made proportions
  worse; replaced with explicit CSS classes (.dash-row-main 2fr/1fr,
  .dash-row-three) + media queries stacking at 900/1200px, and default
  grid stretch so side-by-side cards are EQUAL HEIGHT (alignItems:start
  was the raggedness culprit).

---

## 2026-08-27 — Due-task notifications: banner on login, mark-done, undo

Trey: "when I log in something should pop up to say raise fridge to 70
today and I need to mark off that I did it." (Email/text is the v2 of this,
post-deploy.)

- Schedule tasks stay DERIVED from batch dates (schedule.ts) — only
  done-ness is stored: new `task_completions` table (batchId + stable
  taskKey like "raise-temp-d4"; NextAction gained `key`). Live CREATE TABLE.
- `DueTasksBanner` renders in the (app) LAYOUT so it shows on every page:
  tasks due today or overdue across all non-completed batches, each with a
  ✓ Done button. completeTask is idempotent; uncompleteTask is the undo.
  Actions revalidate with `revalidatePath("/", "layout")` — plain "/" only
  refreshes the page segment and the banner wouldn't clear elsewhere.
- Dashboard "Next up" shows done items struck through with green dot +
  undo; due items get the ✓ Done button.
- Overdue/due are CALENDAR-DAY comparisons (due dates are UTC-midnight
  date-onlys, "today" is the user's local date) — timestamp comparison made
  a task due today read OVERDUE all day. An unfinished task turns OVERDUE
  the next day and nags for up to 30 days past due.

---

## 2026-08-27 — Preserve-name flag; equipment cost entry removed

Two Trey rules landed:

- **preserveName** (bool, equipment + stock): Trey renames items to his
  liking ("Brewer's Edge Mash and Boil with Pump V2 (Series 2)" instead of
  the receipt's mouthful). A checkbox under the Name field marks the name as
  curated; applyProposal's same-item merge then keeps it (everything else —
  cost, purchase link, specs merge, restock quantities — still updates).
  Unchecked = receipt name wins, as before. Live ALTERs added the columns.
- **No manual cost entry on equipment**: paid gear arrives via purchases
  (money lives there); manually-added gear is the free stuff. Form lost its
  Cost field (so edits can't wipe receipt-sourced costs), the Entered-costs
  card went away, dashboard says "in gear". The list's Cost column stays —
  receipt-fed display with "part of kit" links (shortened; full purchase
  name in the tooltip). Equipment table: only Key specs wraps.

---

## 2026-08-27 — Stock finally moves: inline adjustments + batch consumption

Until now NOTHING decremented stock — batch 1's zeros were hand-seeded.
Trey's bottling question ("I use 48 bottles, deduct them, say used in
batch 1") exposed it. Four pieces, one mechanic:

- **Inline on-hand edit** (pencil on every lot row): free inflows — returned
  bottles, recounts, breakage — are ADJUSTMENTS, not purchases. `setOnHand`
  action; no fake purchase rows.
- **Use from stock** on the batch page: pick a lot + amount → writes the
  batch_ingredients snapshot line (house description style: name · AA% ·
  lot · gen) AND deducts on hand (clamped at 0). The used-in links and cost
  proration light up automatically.
- **Bottling day form** (shows when the batch has a bottle count): prefilled
  rows for bottles/caps/priming sugar guessed by name+type match, amounts
  defaulting to bottleCount/bottleCount/1 — transparent prefills the user
  confirms, never silent deductions. One submit, skippable rows.
- **Water never deducts** — the RO system is effectively unlimited; water
  lots snapshot into batches ("5.5 gal Home RO") but keep their quantity.

DELIBERATE: removing a snapshot line does NOT refund stock (button says so).
Silent inventory changes are how counts drift from the physical world —
corrections happen inline on the stock page where you can see the number.

---

## 2026-08-27 — Cost moves from stock list to the batch

Trey: cost doesn't matter while a packet sits on a shelf — it matters when a
batch consumes it. So the stock list dropped its Cost column (cost stays on
the lot's edit form and on purchases), and the batch page's "Ingredients as
brewed" panel now prices each snapshot line from its lot:

- Partially-used lots are PRORATED: amount used / lot quantity × lot cost,
  only when units match ("$2.65 of lot"). Full-lot use charges the lot price.
- Kit components show "kit" (hover names the kit) — the never-fake-kit-line-
  prices rule holds; they're counted, not guessed.
- Footer: "Batch cost (ingredients): $X.XX + N kit-priced items".
- A deleted lot's line shows no cost (snapshot text survives, price unknown).

Batch 1 reads "4 kit-priced items" and no dollar figure — correct, the
Essential kit never itemized prices. Future batches from individually
priced lots will sum properly.

(6 demo lots tagged notes='SAMPLE DATA' were added so Trey could try the
nested groups, then removed the same day once he signed off on the design.)

---

## 2026-08-27 — Stock availability filter; used lots link to their batch

Stock now answers "what can I brew with?" by default: Available (on hand > 0)
is the default view, with Used and All lots chips (mirrors equipment's
Active-default pattern). A lot referenced by a batch snapshot shows
"used in #N" linking to that batch — built from batch_ingredients joined to
batches, deduped per batch, passed to the client table as `usedIn` on each
lot. The links stopPropagation so they don't toggle group expansion. A lot
at zero WITHOUT a batch reference still reads "(used)" with no link (tossed/
spoiled). Availability filters LOTS before grouping, so a product's rollup
total under Available counts only what's actually on hand.

---

## 2026-08-27 — Stock rolls up by product, lots nest underneath

Trey's ask: 15 packs of US-05 shouldn't be 15 look-alike lines. The stock
list now groups by product (type + exact name): one line with the lot count,
total on hand (summed per unit), and the SOONEST best-by; clicking expands
the per-lot rows (lot number, key numbers, purchase link, edit/delete). This
is display-only — the per-lot data model is untouched, so batch snapshots,
replication numbers, and brewability all still key off individual lots.
Products with a single lot render flat (no pointless chevron). Pagination
counts PRODUCTS, not lots (a group never straddles pages). Search returned
to stock (it was removed earlier the same day, then wanted back once
grouping made name-matching useful); a search auto-expands its matches via
`defaultOpen` + a key that remounts the client table on q/filter/page change.

New pieces: `components/stock-table.tsx` (client — expansion state lives
here; imports the delete server action directly) and
`lib/inventory/stock-labels.ts` (typeLabels/typeBadge shared by server page
and client table — don't re-inline them in one side or they'll drift).
Also removed the decorative top-bar "Search recipes, batches…" (mockup
leftover, never functional — Trey doesn't want global search).

Gotcha hit while verifying: clicks on a freshly hot-reloaded page did
nothing because hydration hadn't caught up after several file writes — a
plain reload fixed it. Not an app bug.

---

## 2026-08-27 — Kit-apply duplicates merged into the seeded lots (data fix)

Applying the Essential starter kit created stock rows for ingredients the
seed data already described — those packets WERE batch 1 (the kit's Block
Party recipe kit), so "Gold liquid malt extract" duplicated "Gold LME",
"Willamette hop pellets" duplicated "Willamette, pellet" (lot HP15), etc.

Merged each pair into the ORIGINAL row (script in session scratchpad, not
kept): originals win because they hold the lot numbers/AA%/generation/best-by
AND are what batch_ingredients reference — renaming or re-pointing would have
broken the batch snapshot and brewability name-matching against recipes. The
import row donated its purchase link + purchase date (Aug 8), then was
deleted. On-hand stays at the originals' 0 (used) — the import rows' "6 lb on
hand" was false; that beer is fermenting. Unopened kit items (priming sugar,
caps, Oxygen Wash) had no counterpart and stand as-is.

Why this happened: kit components deliberately skip the same-item merge
prompt on apply (they always create fresh rows). Here the seed had
pre-described the kit's contents, a one-time artifact of building the app
mid-brew. If it recurs with real data, consider extending the merge prompt
to kit components.

---

## 2026-08-27 — Equipment quantity, flag-as-status, equipment search, mixed-order trim

Four refinements from Trey's testing:

- **equipment.quantity** (int, default 1): counts were being stuffed into specs
  text ("· 2 ct"). Real column now — form field, Qty column in the list, and
  applyProposal writes the AI-read quantity instead of appending to specs.
  Live ALTER + backfill parsed "N ct" out of existing specs (GoveeLife 2-pack,
  hose adapters). Quantity > 1 is for countable gear only — vessels and
  instruments stay one row per unit (see the Stock entry below).
- **Flag IS the status**: an active item with a warning flag ("not calibrated")
  now shows the flag as its status badge instead of "Active" + flag side by
  side. It still lives under the Active filter — only Retired removes gear
  from service. Trey's framing: "if it says not calibrated it's not active."
- **Equipment search + pagination**, same pattern as purchases (3+ chars
  debounced, 10/25/50/all). PurchaseSearch generalized into
  `components/table-search.tsx` (basePath + placeholder props); status chips,
  q, and size all survive each other via pageHref.
- **Mixed-order trim** in applyProposal: when lines are left unchecked
  (sunglasses on a brewing order), the purchase is renamed to the kept items
  (Sonnet low-effort, `nameForAccepted`, falls back to old name on failure)
  and totalCost becomes receiptTotal × keptLines/allLines — the receipt total
  includes tax, so the kept share carries its proportional tax. A note on the
  purchase records the math. The existing sunglasses order was fixed by hand:
  "Veco Spray Bottles Order", $80.60 → $16.23 (kept $14.99 of $74.46 in
  lines), spray bottles quantity 4.

Item line costs stay pre-tax; only the purchase totalCost is tax-inclusive.

---

## 2026-08-27 — Ingredients renamed to Stock; bottles are stock now

Trey's framing, which the model already secretly agreed with: the real split is
**durable vs consumable**, not equipment vs ingredients. So the consumables
side is now **Stock** — ingredients, supplies, chemicals, water, anything that
flows in and out on a quantity basis. Renamed all the way down so the code
doesn't lie: route `/ingredients` → `/stock`, nav + page "Stock", table
`ingredients` → `stock` (live ALTER TABLE rename; backup at
`data/brewbuddy.pre-stock.bak.db`), schema exports `stock`/`stockTypes`/
`StockItem`/`StockType`, actions `createStockItem`/`updateStockItem`/
`deleteStockItem`, component `stock-form.tsx`.

Deliberately NOT renamed: `batch_ingredients` + `ingredientId` (in a batch,
"ingredients as brewed" is the right word), `recipeItems.ingredientType`
(recipe lines are brewing inputs), and the AI proposal wire format
`kind: "equipment" | "ingredient"` (cached extraction logs store it; the UI
maps supply-type rows to a SUPPLY badge anyway).

Equipment stays one-row-per-unit even for identical duplicates — batches
reference a specific vessel (kettleId/fermenterId) and per-unit constants/
calibration are the point. Countable gear that leaves with the beer is stock:
**Brown bottles moved from equipment to stock** (supply, 50 ct) in both the
live DB and seed. Receipt-AI rules now classify bottles as a restockable
supply, never equipment — EXTRACTION_RULES_VERSION bumped to "3" (invalidates
cached reads, intentional).

Also: dashboard had a local `stock` variable that collided with the schema
import after the rename (renamed to `stockRows`), and the route-folder rename
needed the dev server stopped first (Next's watcher holds the directory on
Windows). Brief amended at the Ingredient entity section.

---

## 2026-08-27 — All primary keys are GUIDs; pending-review status; supplies labeled

Trey asked for integer keys to go away entirely (sequential ids leak record
counts in URLs), so every table's PK is now `text` with a
`crypto.randomUUID()` default, and every FK column is text to match.
`purchases.publicId` is gone — the id itself is the GUID; the migration reused
each purchase's old public_id as its new id, so purchase URLs survived. Data
migrated by export → rename to `data/brewbuddy.pre-guid.bak.db` → fresh
`db:push` → reimport with old-id→uuid maps (scratchpad script, FK check clean).
`batchNumber` stays an integer — it's a business number ("Batch #1"), not a key.
Code sweep: all actions take string ids, `[id]` pages dropped their
`Number(id)` guards and query by string, `findLikelyMatch` and every component
id prop is string-typed. Typecheck clean, 36/36 tests pass, all pages verified
in the browser on GUID URLs.

Mid-sweep, six component files turned up corrupted with systematic character
substitutions (every "p"→"u" in one, "t"→"y" in another). SOLVED later the
same day: it was the sweep script itself, not the disk. PowerShell flattens a
hashtable value of ONE nested pair — @(@('old','new')) becomes @('old','new')
— so the loop iterated the two strings, $pair[0] indexed the first CHARACTER,
and String.Replace(char, char) rewrote that character file-wide. Lesson for
future sessions: never use @(@(...)) with a single element for replace maps;
use [pscustomobject] lists, verify Contains() before replacing, and typecheck
immediately after scripted writes. Recovery both times: git checkout the
files, re-apply via the Edit tool.

Also from Trey's feedback:
- **Purchases list Status column**: "Needs review" (accent badge, links to the
  purchase) when a proposal is pending, "Applied" once imported, "—" when
  nothing was extracted. Answers "which purchases haven't I approved yet?"
- **Supplies labeled honestly**: bottle caps were badged INGREDIENT in the
  review table even though their type is supply. The Kind badge now shows
  SUPPLY (olive #7a8a5b, matching the inventory page), the items list on a
  purchase says "supply", and the inventory page is titled
  "Ingredients & supplies".

---

## 2026-08-26 — Purchase-flow hardening from live testing

Trey exercised the receipt flow with real Amazon/Northern Brewer orders; each round
of feedback landed as a refinement. Key design decisions:

- **Extraction log/cache** (`extractions` table, keyed userId+sha256 of receipt
  bytes): a receipt is only ever read by the AI once — identical bytes return the
  logged proposal instantly. Model economics follow: receipts use claude-opus-5 at
  default effort (read once, accuracy matters — Sonnet+low-effort missed kit items
  and misread the year), labels use claude-sonnet-5+low (verified accurate, frequent).
- **Rescan with feedback**: pending proposals have a hint box; rescan feeds the
  PREVIOUS result + the user's note back to the model ("keep what's right, fix
  this") and replaces the log entry. Never starts from scratch.
- **Read-once/apply-once**: proposalAppliedAt blocks re-reads while imported items
  exist; removing all imported items re-enables. Review table has editable
  quantities (min 1 enforced end-to-end).
- **Same-item merge**: non-kit lines matching an existing item (loose name match,
  shared inventory/match.ts) ask same-vs-new; "same" adopts the receipt's name,
  merges specs (user notes kept), sets cost + purchase link. Kit components never
  merge-prompt.
- **Purchase = one invoice, 1..many items** each with its own price; orderNumber
  column for admin lookups. Pending proposal is a DRAFT on the purchase — no
  inventory rows exist until Apply.
- vitest.config.ts added (vitest needs the @/ alias explicitly).

---

## 2026-08-26 — Milestones 3–5: brewing core, dashboard, deploy prep

v1 feature set is code-complete except BJCP style ranges and batch diff (v4). All
verified in the browser against seeded real data; 32 unit tests green.

**M3 — recipes & batches.** recipes/recipe_items (spec, not shopping list; Brewed/
Keeper display status DERIVES from batches — only idea/want_to_brew is stored),
batches with recipeName snapshot (survives recipe deletion), per-vessel kettleId/
fermenterId, `estimatedFields` JSON driving EST-vs-M chips per field, batch_ingredients
lot-linked snapshot, gravity_readings with cubic temp correction on display. BeerXML
import/export via fast-xml-parser with metric↔US conversion, round-trip tested.
Batch detail derives boil-off/kettle loss inline and warns on pitch >72°F. Pasted
order text is now a receipt (text/plain through the same AI review flow). Seeded both
recipes + batch 1 (post-boil deliberately null — the famous gap).

**M4 — the brains.** learnedConstants() averages MEASURED values only — a value listed
in estimatedFields never feeds a constant (tested against batch 1's exact case: its
estimates yield "no measured data", not fake numbers). nextActions() derives the
schedule (day-4 temp raise, day-10/13 readings, bottling gate, 2/4/8-week tastings)
from brewDate/bottledDate. checkBrewability() resolves recipe items against on-hand
stock with loose name matching (documented as rough). Dashboard = active batch +
next-up + setup + per-kettle constants + pipeline. Admin users page: create, reset
password (kills sessions), deactivate (kills sessions; self-deactivation blocked).

**M5 — deploy prep (code side done; AWS account steps are the user's).** PWA manifest
+ generated icons (charcoal/copper "BB") wired into metadata. docker-compose.yml =
app + caddy:2 (auto-HTTPS via {$DOMAIN}); Caddyfile; scripts/backup-to-s3.sh does a
proper `sqlite3 .backup` snapshot out of the docker volume, plus receipts, to S3.
docs/deploy.md is the full Lightsail runbook incl. seeding path (standalone image has
no tsx — seed from a Node checkout on the host against the volume path) and a
go-live security checklist. Service worker / offline timers deliberately deferred to
v2 brew-day work.

---

## 2026-08-26 — Milestone 2.5: purchases, kits, receipt AI import

Purchases group items bought together (kits/orders) with one total cost; receipts
attach to purchases and Claude can propose inventory rows from them.

- **Schema:** `purchases` (name, vendor, date, totalCost, receiptPath/Mime,
  proposalJson, notes); equipment + ingredients gained nullable `purchaseId`
  (FK, on delete set null — deleting a purchase keeps the items, drops the link).
- **Kit pricing rule implemented:** an item shows its own cost OR a "part of <kit>"
  link — never a fabricated split. Equipment "entered costs" sums only individually
  priced items; the Purchases page totals purchase costs. Don't double count.
- **Receipts are private uploads:** stored under data/receipts/ (next to the DB,
  inside the Docker volume), served ONLY through /purchases/[id]/receipt with
  session + ownership checks — never from /public. Server-action body limit raised
  to 15 MB in next.config for photo uploads (12 MB per-file cap in the action).
- **AI extraction (claude-opus-5, @anthropic-ai/sdk):** image or PDF receipt →
  base64 content block → JSON proposal stored in purchases.proposalJson. NOTHING is
  written until the user reviews the proposal table and applies checked rows — an AI
  misread must never silently become inventory (same principle as §10.4). Missing
  ANTHROPIC_API_KEY → clear inline error, not a crash. Applied ingredient rows get
  quantityOnHand = quantity (a new purchase is on the shelf).
- Real data: "Block Party Amber kit" purchase created; the 4 batch-1 lots linked to it.
- Gotchas: "use server" files may only export async functions (receiptsDir moved to
  storage.ts); editing next.config.ts restarts the dev server mid-session.

---

## 2026-08-26 — Milestone 2: equipment + ingredient lots

Equipment and ingredient-lot CRUD, live and verified in the browser (create, list,
filter, delete round-trip; real inventory seeded).

- **Schema:** `equipment` (category enum, status active|wanted|retired, freeform `specs`
  text, `flag` for badge-worthy warnings like "not calibrated") and `ingredients` (one
  row per PURCHASE LOT; type enum; nullable type-specific columns for hop AA%/form,
  fermentable PPG/°L, yeast strain/gen/temps/attenuation; `quantity` nullable because
  kit contents can be unknown, `quantityOnHand` for live stock — batches decrement it in
  M3). Wanted list = status filter, not a separate table.
- **Every server action re-checks the session and scopes by userId** — ownership
  enforced in the WHERE clause, not just the UI. Pattern to copy for all future actions.
- **Seed extended (idempotent per table):** brief §7 equipment (14 active + 7 wanted,
  costs null — receipts not itemized) and the 4 batch-1 lots (on-hand 0, "used").
- **Bug fixed + tested: UTC date shift.** Date-only values stored at UTC midnight
  rendered a day early in local time (07/2028 showed as 06/2028). All date formatters
  now pass `timeZone: "UTC"`. Any new date display must do the same.
- **Responsive rule:** data tables live inside `.table-wrap` (overflow-x: auto) so the
  page never scrolls sideways on a phone. Copy for all future tables.
- Delete uses window.confirm in a small client DeleteButton; forms are client
  components on useActionState over server actions returning {error}.

---

## 2026-08-26 — Milestone 1: scaffold, auth, shell (first code)

First code in the repo. Next.js 15 (App Router, standalone output) + TypeScript,
hand-scaffolded at the repo root (create-next-app refuses non-empty dirs). Verified
end-to-end in the browser: login → dashboard → all nav routes → admin page → sign out →
sign back in.

- **Stack pins:** drizzle-orm + better-sqlite3 (WAL mode, foreign_keys on), bcryptjs
  (pure JS — native bcrypt/argon2 builds are a pain on Windows), tsx for scripts.
  DB file at ./data/brewbuddy.db (env DATABASE_PATH), gitignored.
- **Auth is hand-rolled, deliberately:** users + sessions tables, bcrypt hashes,
  httpOnly cookie (90-day sessions — brew-day friendly), guard in the (app) layout via
  a React-cached getCurrentUser(). No Auth.js/Lucia — single-household app, fewer moving
  parts. Login returns one generic error for bad email OR password (no account probing).
  Deactivated users fail login and their sessions die on next request.
- **Theming as specced:** globals.css defines the token set; [data-theme="stainless"]
  overrides only accent tokens incl. --on-accent (dark text on light accent). Shell
  (TopBar, SideNav) matches the design canvas; ADMIN nav section renders only for
  admins, and /admin/users redirects non-admins.
- **Scripts:** db:push (drizzle-kit), db:seed (idempotent admin seed; dev default
  password), user:set-password (env-driven; the reset primitive until milestone 4's
  admin UI). NOTE: drizzle-kit push does NOT create ./data — mkdir first (db/index.ts
  does it at runtime).
- **Docker:** multi-stage node:22-alpine, standalone output, VOLUME /data, port 3000.
  Not yet built/run — that's milestone 5's deploy work.
- **Gotcha for future sessions:** running `npm run build` while `next dev` is live
  corrupts .next/ ("Cannot find module './670.js'") — stop dev (or use a separate
  build) first; fix is delete .next and restart. Browser tabs then hold stale chunks —
  hard reload.
- Placeholder pages state which milestone fills them. Trey's real account is set up
  (admin, full name). Milestone 2 next: equipment + ingredient lots CRUD.
- **CI + first tests:** GitHub Actions (.github/workflows/ci.yml): npm ci → typecheck →
  vitest → next build → docker build, on push/PR to main. First real unit tests cover
  src/lib/calc/gravity.ts (ABV, attenuation, temp correction, instrument offset,
  gravity points) — pulled forward from milestone 3 so CI has teeth.
- **Data finding:** the standard cubic temp correction puts batch 1's OG at ~1.039
  (1.034 read @ 95°F), not the 1.036 in the brief — the +0.001/10°F rule of thumb
  undershoots at high sample temps. Expect the app to disagree with the notebook here.
- **theme/ (101 MB purchased Luna assets) is gitignored** — licensed, design reference
  only, stays local. Do not commit it.

---

## 2026-08-26 — Themes, admin, and brew-day (v2) screens sketched

Design canvas now has two pages: "v1 screens" and "Brew day (v2)". Decisions since the
first sketch round:

- **Accent themes are named after brewing metals: Copper #c1703f is the default,
  Stainless #a9b7c6 is the second** (chosen over brass #d69a32 and a duller ochre after a
  side-by-side). One CSS variable drives the accent. Rule discovered via Stainless: each
  theme must declare its text-on-accent color — light accents need dark text on solid
  buttons and the brand block, not white.
- **Admin section:** two roles only — Admin (Trey; more possible) and User (identical
  rights, everything except the admin Users page). Users page = list, create, edit,
  reset password, deactivate (data kept, sign-in blocked). Deliberately no per-feature
  permissions. Sidebar shows an ADMIN section only to admins.
- **Brew-day flow (phone):** Start (plan from per-vessel constants + "must capture"
  list) → Checklist (timestamps, learned items tagged) → Live boil (countdown computed
  from start timestamps so locked screens can't drift, chiller alert at 15:00 left,
  foam watch) → Chill & capture (post-boil volume is a HARD GATE — the batch-1 lesson;
  OG temp-corrected with instrument offset; pitch button locks above 72°F). Same mode
  in the desktop shell; sidebar gains a "Brew day" item in v2.
- **One clock rule:** brew day starts at the Start tap; the setup checklist is inside
  the day (sample scenario: 8:26 start, heat at 9:04, 3 h 41 min total). All elapsed
  displays derive from that single origin — the review pass caught screens disagreeing.
- **Post-brew review screen:** predicted-vs-measured OG reconciliation, constants
  flipping EST → MEASURED, and the learned-checklist prompt. Sample math worth keeping:
  batch 1's OG 1.036 implies ~6.0 gal reached the fermenter (216 pts ÷ 36), not the
  ~5.5 eyeballed — vessel calibration is the fix.

---

## 2026-08-26 — v1 screens sketched; constants become per-vessel

Sketched all v1 screens as a design canvas (Claude Artifact "Brew Buddy v1 Screens"):
dashboard, equipment, ingredient lots, recipes, batches, batch detail, login, and a
phone dashboard — all in the Luna dark palette lifted from theme/ LESS source
(bg #2f323b, nav #24272e, accent #f6a821, Roboto). Decisions that came out of review:

- **System constants are per-vessel, not global.** Trey asked "what if I have more
  kettles?" — right call. Batch now records KettleId/FermenterId; each vessel learns its
  own boil-off/loss/chill rolling averages; a new kettle starts from zero. Brief §3/§4
  updated. The dashboard is an *overview* (active batch, next actions, setup, recipe
  pipeline) with only a small per-kettle constants card — not a constants shrine.
- **Fully dark chrome.** Luna's stock white top navbar was rejected; the header is dark
  (#24272e with amber brand block) on every screen. Build the real app that way.
- **Measured-vs-estimate is a UI language**: solid green "M" chip = measured, dashed
  amber "EST" chip = estimate, everywhere a number appears. This implements brief §10.4.
- **Brief arithmetic fix:** the §1 hop-scaling example said 1.2 oz for a 4.3% AA packet;
  correct AA scaling from the 6.8% lot is ~1.6 oz. Brief corrected — tests for
  HopWeightForTargetIBU should assert the 1.6 figure, not 1.2.

---

## 2026-08-26 — Dev log established

No code exists yet — the repo holds `docs/` and `theme/` only. Today was the
architecture-decision session; `docs/brew-buddy-brief.md` was heavily revised and is
the authoritative spec. Key decisions made today, and their reasons:

- **Stack: Next.js (React + TypeScript), not C#/Blazor.** The brief's original §2
  suggested Blazor; Trey overruled it and said to ignore anything code-related from the
  original brief text. Next.js won over a plain React SPA because the app needs a backend
  anyway (shared data across phone/desktop) and one codebase/one process beats two.
- **Database: SQLite, one file, via an ORM.** Chosen for zero cost and zero extra
  infrastructure; ORM specifically to keep a Postgres migration open if users ever grow
  beyond friends-scale. Do not introduce a database server without a scale reason.
- **Hosting: AWS, one small always-on VM (Lightsail or EC2) in Docker.** Trey chose AWS
  mid-discussion (originally home-hosted). Serverless/managed options were rejected
  because SQLite needs a persistent disk and RDS would triple the cost. Target ≤ ~$8/mo.
  HTTPS + domain required (PWA install won't work without it); nightly S3 backup of the
  db file.
- **PWA, one app for everything.** Brew-day mode is a section of the single app, usable
  on both phone (home-screen install) and desktop — explicitly NOT a separate stripped
  app. Timers must compute from start timestamps, not ticking counters (phones kill
  background pages).
- **Auth from day one, multi-user-shaped data.** Every owned record carries a user id;
  recipes get a private/shared flag. Single account (Trey) at launch; friends later.
  This was deliberately designed-in now because retrofitting ownership is miserable.
- **Luna v1.4 theme (`theme/`) is a design reference only** — look, layout, colors. Its
  HTML/AngularJS/Meteor code is dead tech; never port or evaluate it as code.
- **Roadmap expanded** (all accepted by Trey): auto-timestamped brew log, post-brew miss
  analysis, freshness-adjusted hop AA%/yeast viability, push reminders + "Today" screen,
  BeerXML import/export, live stock + brewability check, recipe backlog with statuses,
  off-flavor tags, learned checklist, photos/voice notes, BJCP style ranges.
- **§13 Integration platform added:** all device data (starting with Inkbird ITC-308 CSV
  in v3) flows through one adapter contract into a normalized `DeviceReading` table. No
  integration may invent its own tables or bypass the pipeline — that rule is what keeps
  future devices (Tilt/iSpindel/RAPT, kegerator) plug-and-play.

Next steps when coding starts: scaffold the Next.js app, then v1 per brief §6.
