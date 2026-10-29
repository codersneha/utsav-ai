# ✿ UtsavAI — GenAI Celebration & Event Planner

> **PromptWars Virtual · Challenge 5 — Celebration & Event Planner**
> _"Create a GenAI-powered planning assistant that helps users organize weddings, birthdays, and community events with budgets, timelines, vendor checklists, and personalized ideas."_

UtsavAI (_utsav_ means "celebration" in Hindi) turns a few details about your event into a complete, editable plan in seconds. It gives you a budget that adds up to the rupee, a timeline that works back from your date, vendor checklists, and ideas personalised by **Google Gemini**. You can also ask the planner follow-up questions.

**Live demo:** https://utsav-ai-one.vercel.app · **Demo video:** `<your-video-link>`

---

## Chosen vertical & approach

**Vertical:** personal and community celebrations in India: weddings, birthdays and community events (society fests, cultural nights, fundraisers). Defaults are INR, Indian vendor categories and Indian cultural context.

**Approach: "AI for creativity, code for correctness."** LLMs are great at personalised, creative suggestions but unreliable with arithmetic and dates. So UtsavAI splits the work:

| Layer                                         | Who does it                           | Why                                                           |
| --------------------------------------------- | ------------------------------------- | ------------------------------------------------------------- |
| Budget split, per-guest maths, spend tracking | Deterministic, unit-tested TypeScript | Numbers must always add up to your exact budget               |
| Timeline & deadline compression               | Deterministic, unit-tested TypeScript | Dates must be correct and never in the past                   |
| Vendor checklists                             | Curated templates per event type      | Reliable, complete, persistent progress                       |
| Themes, decor, food, activities, saving tips  | **Gemini** (structured JSON output)   | Personalised to city, guests, budget, culture and preferences |
| Free-form follow-up questions                 | **Gemini** with event context         | Conversational help ("How do I plan for rain?")               |

If Gemini is unavailable (no key, quota, timeout, offline), the app **degrades gracefully** to curated ideas, so the user is never left with a blank screen.

## Problem statement → feature map

| Requirement                           | Feature                                                                                                                                                                                                   |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GenAI-powered planning assistant      | Gemini generates personalised themes, decor, menu, activities and saving tips; an **Ask AI** tab answers follow-up questions with the event as context                                                    |
| Weddings, birthdays, community events | Three event types, each with its own budget template, timeline, vendor checklist and fallback ideas                                                                                                       |
| Budgets                               | Category split by event type, with **priority boosts** (e.g. "food matters most"), exact-rupee allocation, per-guest cost, unrealistic-budget warnings and an **expense tracker** with over-budget alerts |
| Timelines                             | Milestones scheduled backwards from the event date and **auto-compressed** when lead time is short. Export to **.ics** or **Google Calendar**                                                             |
| Vendor checklists                     | Per-vendor tasks with saved progress, plus **Google Maps** search links for vendors in your city                                                                                                          |
| Personalised ideas                    | Driven by event type, city, date, guest count, budget, priorities and free-text preferences (traditions, colours, accessibility needs)                                                                    |

## How it works

```
Browser (React + TS, Vite)                        Vercel Function (Node)
┌───────────────────────────────┐   POST /api/generate   ┌──────────────────────────────┐
│ PlannerForm ─validate─► plan  │ ─────────────────────► │ validate → rate-limit → cache│
│ buildBudget / buildTimeline   │   {mode, details}      │ prompt (data, not commands)  │
│ buildChecklist (pure TS)      │ ◄───────────────────── │ Gemini generateContent       │
│ Ideas / Ask AI / tracker      │   validated JSON       │ (responseSchema JSON mode)   │
│ localStorage (guarded)        │                        │ parse + sanitise output      │
└───────────────────────────────┘                        └──────────────────────────────┘
```

- `src/lib/`: pure, framework-free domain logic (budget, timeline, checklist, validation, prompts, calendar export).
- `src/server/`: Gemini REST client, rate limiter, LRU cache and a pure `handleGenerate(Request) → Response`.
- `api/generate.ts`: a 5-line Vercel Function entry. The **API key stays on the server**.
- `src/components/`: accessible React UI. The plan view is lazy-loaded.

## Evaluation focus areas

### 🔐 Security

- The Gemini key lives only in a server environment variable and is sent in the `x-goog-api-key` header, never in a URL or the browser.
- **One validator shared by client and server** (`validateEventDetails`) does type checks, ranges and length caps, and strips control and markup characters.
- **Prompt-injection hardening:** user input is passed as JSON _data_ with an explicit system instruction to ignore instructions inside it. Output is constrained by `responseSchema`.
- **LLM output is treated as untrusted:** it is re-validated, length-capped and stripped of markup. React escapes everything, and there is no `dangerouslySetInnerHTML`.
- API guards: method allow-list, `Content-Type` check, 8 KB body limit, per-IP sliding-window **rate limiting** (429 + `Retry-After`), generic error messages (no internals leaked) and `Cache-Control: no-store`.
- Security headers via `vercel.json`: a strict **CSP** (`default-src 'self'`, no inline scripts), HSTS, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy` and `Permissions-Policy`.
- External links use `rel="noopener noreferrer"`. No secrets are in the repo (`.env.example` only).

### ⚡ Efficiency

- No AI SDK: a tiny `fetch`-based Gemini client keeps the function small. The total app JS is about 79 KB gzipped, and the plan view is **code-split** with `React.lazy`.
- **Server LRU cache** (30 minutes) avoids paying twice for identical requests. Ideas are also cached in `localStorage`.
- **Timeouts** with `AbortController` (20 s on the server, 25 s on the client). Stale requests are aborted when a new one starts.
- `useMemo` for derived plan and spend data. Immutable, long-cache headers for hashed assets.

### ✅ Testing

- **88 tests across 17 files** (Vitest + Testing Library), with about **99% line and 92% branch coverage** (`npm run coverage`).
- Unit tests cover the budget maths (exact sums, priority boosts, warnings), timeline compression, validation, prompt construction, output sanitisation, the calendar export, storage failure modes, the rate limiter and the cache.
- API handler tests cover every guard (405/413/415/400/429/503/502) as well as caching and sanitisation, using a mocked Gemini.
- Integration tests cover the full user journey (form → plan → ideas → budget → timeline → checklist → Ask AI), the fallback path, restoring a saved plan and corrupt storage.
- **Automated accessibility tests** run axe-core at every major UI state.
- CI (GitHub Actions) runs lint, typecheck, coverage and build on every push.

### ♿ Accessibility (WCAG 2.2 AA-minded)

- Semantic landmarks, a skip link, and a logical heading order. Focus moves to the plan heading after submit.
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

Optionally set `GEMINI_MODEL` to use a different Gemini model. The default is `gemini-3.1-flash-lite`, the fastest stable model in testing (about 3–5 s per request).

## Assumptions

- Users plan in **INR**. Budget templates reflect typical Indian mid-range splits and are meant as a starting point, not financial advice.
- Plans are saved **only in the user's browser** (no accounts, no personal data stored on servers).
- Rate limiting is per serverless instance. That is enough for a demo; production would use a shared store such as Redis or Upstash.
- Vendor discovery uses Google Maps search links rather than scraped vendor data, so the app never invents vendor names or prices.

## Tech stack

React 19 · TypeScript · Vite · Vitest · Testing Library · axe-core · Google Gemini API · Vercel Functions · Google Maps & Google Calendar links

---

Built for **PromptWars Virtual** by Google for Developers × Hack2skill. #BuildwithAI #PromptWarsVirtual
