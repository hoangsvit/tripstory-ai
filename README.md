# TripStory AI

**TripStory AI** is a mobile-first Vietnam cultural trip planner for the AI Riser Vietnam 2026 track **Culture, Tourism & Sports**.

> Don't just visit Vietnam. Understand the story behind every stop.

## MVP features

- Destination, number of days, budget, pace, travel party, and interests.
- Gemini-generated **structured itinerary JSON**.
- Story layer for each stop: cultural context, local tip, food idea, and mini challenge.
- One-click refinements: cheaper, more local, less walking, more culture, more relaxed.
- Local device saving with `localStorage` — no database required.
- Share/copy/download JSON.
- Demo Mode works even when no Gemini API key is configured.
- Gemini API key stays server-side.
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

Open `http://localhost:8080`.

If `GEMINI_API_KEY` is not set, use **Xem bản demo không cần API key**.

## Deploy to Cloud Run from source

```bash
gcloud run deploy tripstory-ai \
  --source . \
  --region asia-southeast1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY="YOUR_KEY",GEMINI_MODEL="gemini-3.5-flash-lite"
```

For a real public app, prefer Secret Manager instead of putting a production API key directly in command history.

## AI Studio submission workflow

AI Riser requires an AI Studio share/deployed link, so use `AI_STUDIO_PROMPT.md` in Google AI Studio **Build mode** to recreate/import this MVP concept, then keep the AI Studio project link for submission. The same app can be deployed from AI Studio to Cloud Run.

## Accuracy note

The Free Tier version intentionally does **not** enable Google Search or Maps grounding. The system prompt therefore tells Gemini not to invent exact operating hours, ticket prices, closures, addresses, or temporary information. Every itinerary includes fields describing what the traveler should verify before going.

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
