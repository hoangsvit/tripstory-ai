# Prompt for Google AI Studio Build Mode

Build a production-quality mobile-first full-stack web app called **TripStory AI** for the AI Riser Vietnam 2026 track **Culture, Tourism & Sports**.

Tagline: **Don't just visit Vietnam. Understand the story behind every stop.**

## Product concept

TripStory AI is NOT a generic travel chatbot. It creates a story-driven Vietnam itinerary based on destination, number of days, budget, travel pace, travel party, and interests. Every stop includes:

- time
- place
- area
- practical activity
- short conservative cultural/historical story
- local tip
- optional local food idea
- mini challenge
- estimated cost in VND
- a `verify before go` note for changing information

## MVP UX

Home screen:
- Destination text field
- Days: 1-5
- Budget in VND
- Travel party: solo / couple / friends / family
- Pace: slow / balanced / packed
- Interests: culture / food / history / nature / coffee / local life / architecture
- Optional notes
- Primary button: “Tạo hành trình của tôi”

Results screen:
- Beautiful editorial hero with itinerary title and tagline
- Total estimated cost
- Day cards with vertical timeline
- Each stop has a highlighted “Câu chuyện” block
- Show local tip, food, mini challenge, estimated cost, and verify-before-go
- Refinement chips:
  - Rẻ hơn
  - Local hơn
  - Ít đi bộ
  - Nhiều văn hoá
  - Thư thả hơn
- Save locally using localStorage
- Share/copy itinerary
- Download itinerary JSON

## AI requirements

Use Gemini server-side. Never expose the Gemini API key to client JavaScript.
Use a free-tier friendly Gemini model such as `gemini-3.5-flash-lite` by default.
Use Structured Outputs / JSON Schema so the UI receives predictable itinerary JSON.

System behavior:
- Default output language is Vietnamese.
- Prioritize geographically sensible clusters and avoid backtracking, but do not invent exact travel times.
- Respect budget and provide conservative cost estimates.
- Do NOT invent exact opening hours, ticket prices, temporary closures, phone numbers, or precise addresses.
- Add uncertain/temporary details only to `verify_before_go`.
- Keep cultural/historical notes concise and conservative.
- Avoid unsafe or exploitative activities.
- Do not output Markdown inside JSON fields.

## Important MVP constraint

Do NOT use Google Maps API, paid APIs, Firebase, or a database. Keep the MVP deployable at near-zero cost. Save trips in localStorage.

## Visual direction

Modern editorial travel design inspired by a premium travel journal, not a dashboard and not a chat interface.
Use warm ivory/sand background, deep forest green, restrained terracotta accents, large serif display headings, clean sans-serif body text, rounded cards, strong mobile UX.
Do not use stock photos in the MVP.

## Safety/accuracy banner

Always display a small note: “AI có thể sai. Hãy kiểm tra giờ mở cửa, giá vé và thông tin vận hành trước khi đi.”

## Deployment

Make the app full-stack and ready to deploy from Google AI Studio to Cloud Run, with the Gemini key configured server-side.
