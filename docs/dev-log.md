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
