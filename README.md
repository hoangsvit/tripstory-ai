# TripStory AI

**TripStory AI** is a mobile-first Vietnam cultural trip planner for the AI Riser Vietnam 2026 track **Culture, Tourism & Sports**.

> Don't just visit Vietnam. Understand the story behind every stop.

## MVP features

- Destination, number of days, budget, pace, travel party, and interests.
- Gemini-generated **structured itinerary JSON**.
- Story layer for each stop: cultural context, local tip, food idea, and mini challenge.
- One-click refinements: cheaper, more local, less walking, more culture, more relaxed.
- Save up to **20 trips** in `localStorage` — no database required.
- Share/copy/download JSON.
- Demo Mode works even when no Gemini API key is configured.
- Gemini API key stays server-side.
- Per-IP AI rate limiting, security headers, request-size limits, timeout and retry/backoff.
- Refine actions use Gemini `previous_interaction_id` when available to avoid resending the full itinerary.
- No Google Maps API in the MVP.

## Stack

- Node.js 20+
- Node.js native HTTP server (zero runtime dependencies)
- Vanilla HTML/CSS/JavaScript
- Gemini Interactions API with Structured Outputs
- Default model: `gemini-3.5-flash-lite`
- Cloud Run-ready

## Run locally

```bash
cp .env.example .env
```

Set your Gemini API key in your shell or load `.env` with your preferred method:

```bash
export GEMINI_API_KEY="YOUR_KEY"
export GEMINI_MODEL="gemini-3.5-flash-lite"
npm start
```

Optional runtime tuning:

```bash
export RATE_LIMIT_MAX=10
export RATE_LIMIT_WINDOW_MS=300000
export GEMINI_TIMEOUT_MS=30000
export GEMINI_MAX_ATTEMPTS=3
```

Open `http://localhost:8080`.

If `GEMINI_API_KEY` is not set, use **Xem bản demo không cần API key**.

## Deploy to Cloud Run from source

```bash
gcloud run deploy tripstory-ai \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY="YOUR_KEY",GEMINI_MODEL="gemini-3.5-flash-lite",RATE_LIMIT_MAX="10"
```

For a real public app, prefer Secret Manager instead of putting a production API key directly in command history.

## AI Studio submission workflow

AI Riser requires an AI Studio share/deployed link, so use `AI_STUDIO_PROMPT.md` in Google AI Studio **Build mode** to recreate/import this MVP concept, then keep the AI Studio project link for submission. The same app can be deployed from AI Studio to Cloud Run.

## Accuracy note

The MVP intentionally does **not** enable Google Search or Maps grounding by default. The system prompt therefore tells Gemini not to invent exact operating hours, ticket prices, closures, addresses, or temporary information. Every itinerary includes fields describing what the traveler should verify before going.

## Suggested 60-second demo

1. Enter `Huế`, `2 ngày`, `1.500.000 VND`.
2. Select `Văn hoá`, `Ẩm thực`, `Lịch sử`.
3. Generate the trip.
4. Open Day 1 and show the **Story** + **Mini challenge** layers.
5. Tap `🧺 Local hơn`.
6. Show the revised itinerary.
7. Tap `Chia sẻ` or `Lưu`.

## Competition positioning

Problem: Travel planners often optimize places and schedules but do not help travelers understand local culture.

Solution: TripStory AI combines personal constraints with a story-first itinerary that makes every stop meaningful.

Track: **Culture, Tourism & Sports**.

## Production-minded safeguards

The MVP stays dependency-free, but the server includes lightweight safeguards suitable for a public competition demo:

- AI endpoints are rate-limited per client IP.
- Gemini calls time out and retry transient `429`/`5xx` failures with backoff.
- Requests are capped at 100 KB and JSON content type is required.
- CSP, referrer, frame, content-type and permissions headers are sent on app responses.
- Gemini Interactions REST responses are parsed from `steps[].content[]`.
- Refinements chain from the previous Gemini interaction when possible; if a stored interaction has expired, the server falls back to a stateless refine.

For high-traffic production use, replace the in-memory rate limiter with a shared store such as Redis/Memorystore because Cloud Run can run multiple instances.
