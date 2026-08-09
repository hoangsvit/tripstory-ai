import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

const PORT = Number(process.env.PORT || 8080);
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
const API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

const itinerarySchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    destination: { type: 'string' },
    tagline: { type: 'string' },
    overview: { type: 'string' },
    estimated_total_vnd: { type: 'integer', minimum: 0 },
    budget_note: { type: 'string' },
    travel_tips: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 6 },
    days: {
      type: 'array', minItems: 1, maxItems: 7,
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          day: { type: 'integer', minimum: 1 },
          theme: { type: 'string' },
          story_intro: { type: 'string' },
          estimated_day_cost_vnd: { type: 'integer', minimum: 0 },
          stops: {
            type: 'array', minItems: 2, maxItems: 6,
            items: {
              type: 'object', additionalProperties: false,
              properties: {
                time: { type: 'string' }, place: { type: 'string' }, area: { type: 'string' },
                activity: { type: 'string' }, story: { type: 'string' }, local_tip: { type: 'string' },
                food: { type: 'string' }, mini_challenge: { type: 'string' },
                estimated_cost_vnd: { type: 'integer', minimum: 0 }, verify_before_go: { type: 'string' }
              },
              required: ['time','place','area','activity','story','local_tip','food','mini_challenge','estimated_cost_vnd','verify_before_go']
            }
          }
        },
        required: ['day','theme','story_intro','estimated_day_cost_vnd','stops']
      }
    }
  },
  required: ['title','destination','tagline','overview','estimated_total_vnd','budget_note','travel_tips','days']
};

const SYSTEM_RULES = `
You are TripStory AI, a Vietnam-focused cultural travel planner.
Your job is to create small, practical itineraries that help travelers understand the story behind each stop, not merely list attractions.

Rules:
- Write in Vietnamese unless the user explicitly asks for another language.
- Prioritize realistic, geographically sensible clusters. Do not claim exact travel times unless highly confident.
- Respect the requested total budget. Estimate costs conservatively in VND and label them as estimates.
- Do NOT invent exact opening hours, ticket prices, temporary closures, phone numbers, or addresses. Put anything that should be checked in verify_before_go.
- Cultural/historical notes must be concise and conservative. If a detail is uncertain, avoid stating it as a hard fact.
- Include local food where relevant but do not force food into every stop.
- Avoid unsafe, illegal, exploitative, or environmentally harmful activities.
- Each day should have a coherent theme and normally 3-5 stops, fewer for slower travel styles.
- Do not include Markdown in JSON fields.
- Return only valid JSON matching the provided schema.
`;

function cleanPreferences(input = {}) {
  const destination = String(input.destination || '').trim().slice(0, 120);
  const days = Math.min(7, Math.max(1, Number(input.days) || 1));
  const budget = Math.min(100_000_000, Math.max(100_000, Number(input.budget) || 1_000_000));
  const pace = ['slow', 'balanced', 'packed'].includes(input.pace) ? input.pace : 'balanced';
  const interests = Array.isArray(input.interests) ? input.interests.map(v => String(v).trim()).filter(Boolean).slice(0, 8) : [];
  const companions = String(input.companions || 'solo').slice(0, 40);
  const notes = String(input.notes || '').trim().slice(0, 500);
  const language = input.language === 'en' ? 'English' : 'Vietnamese';
  if (!destination) throw new Error('Vui lòng nhập điểm đến.');
  return { destination, days, budget, pace, interests, companions, notes, language };
}

function buildGeneratePrompt(prefs) {
  return `${SYSTEM_RULES}\n\nCreate a ${prefs.days}-day itinerary with these preferences:\nDestination: ${prefs.destination}\nTotal budget: ${prefs.budget} VND\nPace: ${prefs.pace}\nInterests: ${prefs.interests.join(', ') || 'local culture, food, relaxed exploration'}\nTravel party: ${prefs.companions}\nExtra notes: ${prefs.notes || 'none'}\nOutput language: ${prefs.language}\n\nThe itinerary must feel like a story-driven local journey. Keep the estimated total within the stated budget whenever feasible.`;
}

function buildRefinePrompt(prefs, itinerary, action) {
  const actionMap = {
    cheaper: 'Reduce the estimated total cost while preserving the best cultural value. Prefer low-cost or free experiences.',
    local: 'Make the itinerary feel more local and less generic. Prefer markets, neighborhoods, local food, crafts, community spaces, and cultural context while remaining visitor-friendly.',
    walking: 'Reduce unnecessary walking and geographic backtracking. Group stops more tightly and keep the pace comfortable.',
    culture: 'Increase cultural and historical storytelling. Keep facts conservative and concise.',
    relaxed: 'Make the trip more relaxed with fewer stops, more buffer time, and calmer experiences.'
  };
  const instruction = actionMap[action] || String(action || 'Improve the itinerary while keeping the same preferences.').slice(0, 300);
  return `${SYSTEM_RULES}\n\nRefine the existing itinerary.\nOriginal preferences: ${JSON.stringify(prefs)}\nRefinement instruction: ${instruction}\nExisting itinerary: ${JSON.stringify(itinerary)}\n\nReturn the full revised itinerary, not a patch.`;
}

async function callGemini(prompt) {
  if (!API_KEY) {
    const err = new Error('Gemini API key chưa được cấu hình.');
    err.code = 'NO_API_KEY';
    throw err;
  }
  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': API_KEY },
    body: JSON.stringify({
      model: MODEL,
      input: prompt,
      response_format: { type: 'text', mime_type: 'application/json', schema: itinerarySchema }
    })
  });
  const text = await response.text();
  if (!response.ok) {
    console.error('Gemini API error:', response.status, text.slice(0, 1000));
    const err = new Error('Gemini API đang bận hoặc cấu hình chưa đúng.');
    err.code = 'GEMINI_ERROR';
    throw err;
  }
  let payload;
  try { payload = JSON.parse(text); } catch { throw new Error('Không đọc được phản hồi từ Gemini API.'); }
  if (!payload.output_text) throw new Error('Gemini không trả về hành trình hợp lệ.');
  try { return JSON.parse(payload.output_text); } catch { throw new Error('Gemini trả về dữ liệu không đúng định dạng.'); }
}

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-store' });
  res.end(data);
}

async function readJson(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1_000_000) throw new Error('Request quá lớn.');
  }
  try { return body ? JSON.parse(body) : {}; } catch { throw new Error('JSON không hợp lệ.'); }
}

const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml' };

async function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(requested).replace(/^([.][.][/\\])+/, '');
  let filePath = path.join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) return false;
  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return false;
    const data = await fs.readFile(filePath);
    res.writeHead(200, { 'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': process.env.NODE_ENV === 'production' ? 'public, max-age=3600' : 'no-cache' });
    res.end(data);
    return true;
  } catch { return false; }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, { ok: true, model: MODEL, geminiConfigured: Boolean(API_KEY) });
    }

    if (req.method === 'POST' && pathname === '/api/generate') {
      const prefs = cleanPreferences(await readJson(req));
      const itinerary = await callGemini(buildGeneratePrompt(prefs));
      return sendJson(res, 200, { itinerary, prefs, model: MODEL });
    }

    if (req.method === 'POST' && pathname === '/api/refine') {
      const body = await readJson(req);
      const prefs = cleanPreferences(body?.prefs || {});
      if (!body?.itinerary || typeof body.itinerary !== 'object') return sendJson(res, 400, { error: 'Thiếu hành trình để tinh chỉnh.' });
      const itinerary = await callGemini(buildRefinePrompt(prefs, body.itinerary, String(body.action || '').slice(0, 300)));
      return sendJson(res, 200, { itinerary, prefs, model: MODEL });
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (await serveStatic(req, res, pathname)) return;
      const index = await fs.readFile(path.join(publicDir, 'index.html'));
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(index);
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    const status = error.code === 'NO_API_KEY' ? 503 : 400;
    sendJson(res, status, { error: error.message || 'Đã xảy ra lỗi.' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`TripStory AI running on http://0.0.0.0:${PORT}`);
  console.log(`Gemini model: ${MODEL}`);
  console.log(`Gemini configured: ${Boolean(API_KEY)}`);
});
