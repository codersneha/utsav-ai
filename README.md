# ✿ UtsavAI — GenAI Celebration & Event Planner

> **PromptWars Virtual · Challenge 5 — Celebration & Event Planner**
> _"Create a GenAI-powered planning assistant that helps users organize weddings, birthdays, and community events with budgets, timelines, vendor checklists, and personalized ideas."_

UtsavAI (_utsav_ means "celebration" in Hindi) is a warm, festive planning companion for Indian families. **Describe your event in your own words — English, Hindi or Hinglish** — and it builds a complete, **editable** plan: a budget that adds up to the rupee, a task timeline with a day-of schedule, vendor checklists with questions to ask, and ideas personalised by **Google Gemini** — **grounded in real traditions**. A Bengali wedding gets its gaye holud, biye and bou-bhaat, each with its own décor and photo, and a _served_ menu in the right order (phuchka stalls → luchi → rice & dal → paturi → polao → chutney → mishti doi → rosogolla → mishti paan) — never a buffet. Change the menu without touching the décor, **find a venue on the map**, or **upload a photo you love** and let Gemini read its style. Tell the assistant _"we now have 50 more guests"_ and it proposes the change, shows exactly what it affects, and applies it only when you say so — with **Undo**.

**Live demo:** https://utsav-ai-one.vercel.app (try a one-click sample) · **Demo video:** `<your-video-link>`

---

## Chosen vertical & approach

**Vertical:** personal and community celebrations in India: weddings, birthdays and community events (society fests, cultural nights, fundraisers). Defaults are INR, Indian vendor categories and Indian cultural context.

**Persona:** a family member organising a celebration for the first time, whose biggest stress is _"Are we on budget, what do we do next, and what do we ask each vendor?"_

**Approach: "AI for creativity, code for correctness — and the user stays in control."** LLMs are great at personalised, creative suggestions but unreliable with arithmetic and dates, and they must never invent prices or claim a vendor is available. So UtsavAI splits the work:

| Layer                                                                         | Who does it                                               | Why                                                                                       |
| ----------------------------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Budget split, per-guest maths, guest-count impact, trade-offs, spend tracking | Deterministic, unit-tested TypeScript                     | Numbers must add up to the rupee; estimates are labelled as estimates                     |
| Timeline, priorities, dependencies, compression, slippage alerts              | Deterministic, unit-tested TypeScript                     | Dates must be correct and never silently in the past                                      |
| Vendor records (names, contacts, quotes, booking status)                      | **The user**                                              | Only real information the user enters — never AI-invented businesses                      |
| Cultural facts: each tradition's functions, décor, courses and serving style  | **A curated knowledge base** (11 traditions), in code     | The AI must not get culture wrong; facts are reviewed once and reused                     |
| Themes, décor, menu picks, activities, saving tips (+ refinement)             | **Gemini** (structured JSON), _within_ the knowledge base | Personalised to city, guests, budget, venue, diet and taste — invented dishes are dropped |
| Reading a décor photo (theme, colours, elements)                              | **Gemini vision**                                         | Turns "I want it like this" into colours and ideas                                        |
| Event-day run-of-show, vendor questions, tailored checklist tasks             | **Gemini** (structured JSON output)                       | Adapts logistics to this event; marked ✨ AI so users can tell suggestions from facts     |
| Follow-up conversation                                                        | **Gemini** with event, budget estimates and recent turns  | "Ask, listen, adapt"                                                                      |

If Gemini is unavailable (no key, quota, overload, timeout, offline), every AI feature **degrades gracefully** to curated content, so the user is never left with a blank screen.

## Problem statement → feature map

Covers the one-line brief and the detailed expectations from the Challenge 5 explainer session.

| Requirement                                                                 | Feature                                                                                                                                                                                                                                                                                                                                                  |
| --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intake: "ask a few practical questions"                                     | Occasion, date, city, guests, budget, priorities, **venue type, dietary needs, age group, colour palette**, free-text preferences — with accessible validation                                                                                                                                                                                           |
| Budgets: categorise expenses, user can adjust, compare to actual            | Category split by event type with priority boosts; **every planned amount is editable** (labelled _Estimate_ vs _Your amount_); expense tracker with over-plan alerts; unallocated / over-allocated totals                                                                                                                                               |
| "If the guest count increases, identify which cost"                         | Per-guest categories are marked, and the panel shows **what every 10 extra guests adds**                                                                                                                                                                                                                                                                 |
| "Don't present AI prices as confirmed"                                      | Amounts are computed in code and labelled as estimates; vendor quotes only come from the user                                                                                                                                                                                                                                                            |
| Trade-offs: "help users choose what matters most"                           | When food is underfunded or categories exceed the budget, UtsavAI offers **options the user chooses to apply**: fewer guests, a bigger budget, or moving money to food — never applied automatically                                                                                                                                                     |
| Timelines: structured tasks, deadlines, completion, priorities, countdown   | Milestones scheduled back from the event date (auto-compressed when time is short), **High/Medium/Low priorities, tick-to-complete with progress**, user-added tasks, countdown, **.ics export with reminders** and Google Calendar                                                                                                                      |
| "If venue booking is delayed, which tasks need attention?"                  | Tasks have **dependencies**; overdue tasks and the tasks that depend on them are flagged                                                                                                                                                                                                                                                                 |
| Day-of schedule                                                             | **Gemini drafts an event-day run-of-show** (validated HH:MM times), with a curated fallback                                                                                                                                                                                                                                                              |
| Vendors: define needs, questions to ask, organise quotes, pending/confirmed | Per-vendor checklist (+ ✨ AI tasks tailored to diet/venue/age group), **✨ AI questions to ask**, the user's own **vendor records** (name, contact, quote, status from shortlisted → confirmed), **lowest quote vs budget estimate**, Google Maps search                                                                                                |
| Personalised ideas that "ask, listen and adapt"                             | One card **per function** (e.g. haldi, wedding, reception — a reception never gets haldi décor) with a real photo, palette and Gemini's theme; a **course-by-course menu** with dish photos and Veg / Non-veg / Jain tags; activities and saving tips. **Change décor, menu or extras on their own** ("add ilish") — the other sections stay as they are |
| Cultural correctness                                                        | Gemini chooses only from checked dishes and functions for the tradition; code enforces course order, dish counts, vegetarian-only menus and a Jain-safe choice in every course                                                                                                                                                                           |
| Venues                                                                      | Check a booked venue on the map, or **find venues near any town** (e.g. Habra, Kolkata): event venues first, nearest first, with links to Google Maps for photos, ratings and reviews; choose one to save it                                                                                                                                             |
| Inspiration from a photo                                                    | Upload a décor photo; **Gemini vision** returns its theme, colours and elements, and can restyle just the décor to match                                                                                                                                                                                                                                 |
| Change test: "50 more guests, smaller budget, 2 weeks earlier"              | **Change details** revises in place and shows a **"what changed" report** (per-guest food, budget delta, tasks now due sooner or overdue) while keeping budget edits, completed tasks, vendors and spending                                                                                                                                              |
| Conversational assistant                                                    | **Ask AI** remembers recent turns and sees the event and budget estimates                                                                                                                                                                                                                                                                                |

## How it works

```
Browser (React + TS, Vite)                        Vercel Function (Node)
┌───────────────────────────────┐   POST /api/generate   ┌──────────────────────────────┐
│ PlannerForm ─validate─► plan  │ ─────────────────────► │ validate → rate-limit → cache│
│ buildBudget / buildTimeline   │ {mode: ideas|logistics │ prompt (data, not commands)  │
│ trade-offs / change report    │   |ask, details, …}    │                              │
│ buildChecklist (pure TS)      │ ◄───────────────────── │ Gemini generateContent       │
│ Ideas / Ask AI / tracker      │   validated JSON       │ (responseSchema JSON mode)   │
│ localStorage (guarded)        │                        │ parse + sanitise output      │
└───────────────────────────────┘                        └──────────────────────────────┘
```

- `src/lib/`: pure, framework-free domain logic — budget & trade-offs, timeline & dependencies, checklist & quotes, change report, validation, prompts, AI-output parsing, calendar export.
- `src/hooks/usePlanner.ts`: all plan state and actions in one hook; components stay presentational.
- `src/lib/culture/`: the tradition knowledge base (functions, palettes, décor, courses, dishes) and credited Wikimedia Commons photos; `validateMenu` keeps the AI inside it.
- `src/server/`: Gemini REST client (timeouts, retry, model fallback, image input), OpenStreetMap venue lookups, rate limiter, LRU cache and a pure `handleGenerate(Request) → Response` with six modes: `ideas` (whole plan or one section), `logistics`, `ask`, `extract`, `vision`, `venues`.
- `api/generate.ts`: a 5-line Vercel Function entry. The **API key stays on the server**.
- `src/components/`: accessible React UI. The plan view is lazy-loaded.

## Design

A calm, festive identity instead of a form-and-table utility: ivory paper, rani pink, marigold and peacock-teal; **Fraunces** display type with **Plus Jakarta Sans** for text; a toran (door-garland) border; event headers coloured by occasion; and an Overview dashboard with a budget donut and progress rings. Every screen works at phone width, in light and dark mode, with reduced-motion support.

## Evaluation focus areas

### 🔐 Security

- The Gemini key lives only in a server environment variable and is sent in the `x-goog-api-key` header, never in a URL or the browser.
- **One validator shared by client and server** (`validateEventDetails`) does type checks, ranges and length caps, and strips control and markup characters.
- **Prompt-injection hardening:** user input is passed as JSON _data_ with an explicit system instruction to ignore instructions inside it. Output is constrained by `responseSchema`.
- **LLM output is treated as untrusted:** it is re-validated, length-capped and stripped of markup; invented vendor ids and malformed times are dropped. React escapes everything, and there is no `dangerouslySetInnerHTML`.
- Data saved in the browser is re-validated on load (it may be stale or tampered with), and plans saved by older versions are upgraded safely.
- **Photo uploads** are resized in the browser, then checked on the server by type, size and **file signature (magic bytes)** before Gemini sees them; they are never stored. Only photo requests may exceed the 16 KB body limit (2 MB cap).
- Venue lookups run on the server with an identifying User-Agent and a 24-hour cache; returned links are checked to point only at Google Maps and OpenStreetMap.
- API guards: method allow-list, `Content-Type` check, 16 KB body limit, capped conversation history, per-IP sliding-window **rate limiting** (429 + `Retry-After`), generic error messages (no internals leaked) and `Cache-Control: no-store`.
- Security headers via `vercel.json`: a strict **CSP** (`default-src 'self'`, no inline scripts; images only from the app and Wikimedia Commons), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`.
- External links use `rel="noopener noreferrer"`. No secrets are in the repo (`.env.example` only).

### ⚡ Efficiency

- No AI SDK: a tiny `fetch`-based Gemini client keeps the function small. The app shell is about 100 KB gzipped (including the tradition knowledge base) and the plan view (18 KB) is **code-split** with `React.lazy`. Charts are hand-built SVG (no chart library); fonts are self-hosted variable fonts loaded only for Latin text.
- **Server LRU cache** (30 minutes) avoids paying twice for identical requests. Ideas are also cached in `localStorage`.
- **Ideas and logistics load in parallel**; the server caches both. Changing one section regenerates only that section, with a smaller schema and prompt.
- Photos are lazy-loaded 500 px thumbnails; uploaded photos are shrunk to 1024 px before upload. Venue searches stop early once there are enough results and are cached for 24 hours.
- **Timeouts and retries**: the 20 s server budget is split across two attempts; an overloaded or stalled call is retried once on a second Gemini model. The client times out at 25 s and aborts stale requests.
- `useMemo` for derived plan and spend data. Immutable, long-cache headers for hashed assets.

### ✅ Testing

- **194 tests across 26 files** (Vitest + Testing Library), with about **97% line and 88% branch coverage** (`npm run coverage`).
- Unit tests: budget maths (exact sums, priority boosts, user overrides, guest impact, trade-offs that really fix the plan), timeline (compression, priorities, dependencies, slippage alerts, custom tasks), checklist & quote summaries, the change report (including the explainer's "50 more guests, smaller budget, two weeks earlier" case), validation, prompts, AI-output parsing, storage guards, calendar export, rate limiter and cache.
- Culture tests pin the facts: the Bengali wedding is served in the right course order and never as a buffet, vegetarian-only menus have no fish or meat, a reception-only plan has no haldi, invented dishes are dropped, Jain guests always get a safe choice, and every photo comes from Wikimedia Commons with a licence.
- API tests: every guard (405/413/415/400/429/503/502), all six modes (including section-only regeneration, image signature checks and venue lookups with polite request spacing), refinement, conversation-history capping, caching, retries and model fallback — with a mocked Gemini.
- **Contract tests** feed the real server handler's response into the real browser client, so the two can't drift apart.
- Integration tests drive each user flow: changing only the menu keeps the décor, finding and choosing a venue, reading a photo and applying its colours to the décor only, describe-your-event → wizard → overview → ideas → budget edits & trade-offs → timeline tasks → vendor records → refine → chat proposal → apply → undo → share link → export, plus one-click samples, fallbacks, corrupt storage and upgrading old saved plans.
- **Automated accessibility tests** run axe-core at every major UI state.
- CI (GitHub Actions) runs lint, typecheck, coverage and build on every push.

### ♿ Accessibility (WCAG 2.2 AA-minded)

- **0 axe-core violations — including colour contrast — on every screen (landing, wizard, all six plan tabs) in both light and dark themes, checked in a real Chromium browser**, plus axe checks inside the automated tests.

- Semantic landmarks, a skip link, and a logical heading order. Focus moves to the plan heading after submit, and to the change report after an edit.
- An error summary with links to the invalid fields, plus `aria-invalid`, `aria-describedby` and inline messages.
- WAI-ARIA **tabs** with roving tabindex and Arrow/Home/End keys. Native checkboxes, radios, `<progress>` and `<table>` with captions.
- `aria-live` regions announce loading, ideas and answers. `aria-busy` is set during generation.
- Visible `:focus-visible` outlines, 44 px touch targets, light and dark themes with AA contrast, `prefers-reduced-motion` support and print styles.

### 🧹 Code quality

- TypeScript `strict`, ESLint (typescript-eslint, react-hooks, **jsx-a11y strict**) and Prettier.
- Small, single-purpose modules. Pure functions are separated from UI and I/O, and side effects are injected (`fetchImpl`, `now`, `limiter`) for testability.

## Run locally

```bash
npm install
cp .env.example .env      # add GEMINI_API_KEY from https://aistudio.google.com/apikey
npm run dev               # http://localhost:5173 (the /api route works in dev too)
```

| Script                               | Purpose                     |
| ------------------------------------ | --------------------------- |
| `npm test`                           | Run all tests               |
| `npm run coverage`                   | Tests + coverage report     |
| `npm run lint` / `npm run typecheck` | Static checks               |
| `npm run build`                      | Production build to `dist/` |

## Deploy (Vercel, free tier)

```bash
npm i -g vercel
vercel                        # link the project
vercel env add GEMINI_API_KEY # paste your key (Production + Preview)
vercel --prod
```

Optionally set `GEMINI_MODEL` to use a different Gemini model. It can be a comma-separated list: a retry after an overload or stall moves to the next model. The default is `gemini-3.1-flash-lite,gemini-3-flash-preview`, the two fastest models in testing (about 3–5 s per request).

## Assumptions

- Users plan in **INR**. Budget templates reflect typical Indian mid-range splits and are meant as a starting point, not financial advice.
- Plans are saved **only in the user's browser** (no accounts, no personal data stored on servers).
- Rate limiting is per serverless instance. That is enough for a demo; production would use a shared store such as Redis or Upstash.
- Venues come from OpenStreetMap, so coverage varies by town; ratings, reviews and photos are one tap away on Google Maps. The app never invents vendor names or prices, and venue choice never changes the AI plan.
- Décor and dish photos are real photographs from Wikimedia Commons under free licences, credited and linked to their source. They show the closest traditional match, not the user's exact venue.
- The knowledge base covers 11 traditions (Bengali, Punjabi, Marwari, Gujarati, Marathi, Tamil, Kerala, Telugu, Muslim, Christian and modern/mixed). It is designed to grow, and families can always ask for changes.

## Tech stack

React 19 · TypeScript · Vite · Vitest · Testing Library · axe-core · lucide icons · Fontsource · Google Gemini API (text + vision) · Vercel Functions · OpenStreetMap Nominatim · Wikimedia Commons · Google Maps & Google Calendar links · WhatsApp click-to-chat

---

Built for **PromptWars Virtual** by Google for Developers × Hack2skill. #BuildwithAI #PromptWarsVirtual
