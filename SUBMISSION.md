# AI Riser Vietnam 2026 — Submission Notes

## Product
**TripStory AI — Vietnam Cultural Trip Planner**

## Track
**Culture, Tourism & Sports**

## One-liner
TripStory AI turns a normal itinerary into a story-driven journey through Vietnam, combining personal constraints with local cultural context, food ideas, and small experiential challenges.

## Problem
Travel planning tools are good at listing places but often leave travelers with a checklist rather than an understanding of the destination.

## Solution
The traveler enters destination, days, budget, pace, party type, and interests. Gemini returns a structured day-by-day itinerary where every stop includes a practical activity and a short cultural story layer.

## Google technology
- Google AI Studio
- Gemini API
- Structured Outputs / JSON Schema
- Cloud Run deployment

## MVP scope
No Maps API, no database, no paid third-party API. Saved trips use localStorage.

## Demo story
Input: Huế, 2 days, 1.5M VND, culture + food + history.
Generate → inspect the cultural story layer → click “Local hơn” → show revised route → save/share.

## Important disclaimer
AI-generated travel suggestions may be wrong or outdated. Users are prompted to verify opening hours, ticket prices, weather, closures, and other operational details before visiting.
