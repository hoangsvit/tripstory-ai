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
const GEMINI_URL = process.env.GEMINI_URL || 'https://generativelanguage.googleapis.com/v1beta/interactions';

const GEMINI_TIMEOUT_MS = Math.max(5_000, Number(process.env.GEMINI_TIMEOUT_MS || 30_000));
const GEMINI_MAX_ATTEMPTS = Math.min(4, Math.max(1, Number(process.env.GEMINI_MAX_ATTEMPTS || 3)));
const RATE_LIMIT_WINDOW_MS = Math.max(10_000, Number(process.env.RATE_LIMIT_WINDOW_MS || 5 * 60_000));
const RATE_LIMIT_MAX = Math.max(1, Number(process.env.RATE_LIMIT_MAX || 10));

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
`.trim();

function cleanPreferences(input = {}) {
  const destination = String(input.destination || '').trim().slice(0, 120);
  const days = Math.min(7, Math.max(1, Number(input.days) || 1));
  const budget = Math.min(100_000_000, Math.max(100_000, Number(input.budget) || 1_000_000));
  const pace = ['slow', 'balanced', 'packed'].includes(input.pace) ? input.pace : 'balanced';
  const interests = Array.isArray(input.interests)
    ? input.interests.map(v => String(v).trim()).filter(Boolean).slice(0, 8)
    : [];
  const companions = String(input.companions || 'solo').slice(0, 40);
  const notes = String(input.notes || '').trim().slice(0, 500);
  const language = input.language === 'en' ? 'English' : 'Vietnamese';
  if (!destination) throw httpError(400, 'Vui lòng nhập điểm đến.');
  return { destination, days, budget, pace, interests, companions, notes, language };
}

function buildGeneratePrompt(prefs) {
  return `Create a ${prefs.days}-day itinerary with these preferences:
Destination: ${prefs.destination}
Total budget: ${prefs.budget} VND
Pace: ${prefs.pace}
Interests: ${prefs.interests.join(', ') || 'local culture, food, relaxed exploration'}
Travel party: ${prefs.companions}
Extra notes: ${prefs.notes || 'none'}
Output language: ${prefs.language}

The itinerary must feel like a story-driven local journey. Keep the estimated total within the stated budget whenever feasible.`;
}

function refineInstruction(action) {
  const actionMap = {
    cheaper: 'Reduce the estimated total cost while preserving the best cultural value. Prefer low-cost or free experiences.',
    local: 'Make the itinerary feel more local and less generic. Prefer markets, neighborhoods, local food, crafts, community spaces, and cultural context while remaining visitor-friendly.',
    walking: 'Reduce unnecessary walking and geographic backtracking. Group stops more tightly and keep the pace comfortable.',
    culture: 'Increase cultural and historical storytelling. Keep facts conservative and concise.',
    relaxed: 'Make the trip more relaxed with fewer stops, more buffer time, and calmer experiences.'
  };
  return actionMap[action] || String(action || 'Improve the itinerary while keeping the same preferences.').slice(0, 300);
}

function buildContinuationPrompt(action) {
  return `Refine the itinerary from the previous interaction.
Refinement instruction: ${refineInstruction(action)}
Keep the original destination, trip length, traveler preferences, and requested budget unless the instruction explicitly requires a change.
Return the full revised itinerary, not a patch.`;
}

function buildStatelessRefinePrompt(prefs, itinerary, action) {
  return `Refine this existing itinerary.
Original preferences: ${JSON.stringify(prefs)}
Refinement instruction: ${refineInstruction(action)}
Existing itinerary: ${JSON.stringify(itinerary)}
Return the full revised itinerary, not a patch.`;
}

function httpError(status, message, code = 'REQUEST_ERROR') {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extractOutputText(payload) {
  if (typeof payload?.output_text === 'string' && payload.output_text) return payload.output_text;
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  const modelSteps = steps.filter(step => step?.type === 'model_output');
  const textParts = modelSteps.flatMap(step =>
    Array.isArray(step.content)
      ? step.content.filter(part => part?.type === 'text' && typeof part.text === 'string').map(part => part.text)
      : []
  );
  return textParts.join('');
}

function retryDelayMs(attempt, retryAfter) {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 5_000);
  return Math.min(500 * (2 ** attempt), 4_000) + Math.floor(Math.random() * 200);
}

async function callGemini(prompt, { previousInteractionId = null } = {}) {
  if (!API_KEY) throw httpError(503, 'Gemini API key chưa được cấu hình.', 'NO_API_KEY');

  const requestBody = {
    model: MODEL,
    input: prompt,
    system_instruction: SYSTEM_RULES,
    response_format: { type: 'text', mime_type: 'application/json', schema: itinerarySchema }
  };
  if (previousInteractionId) requestBody.previous_interaction_id = previousInteractionId;

  let lastError;
  for (let attempt = 0; attempt < GEMINI_MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

    try {
      const response = await fetch(GEMINI_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': API_KEY
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      const text = await response.text();
      if (!response.ok) {
        const retryable = response.status === 429 || response.status >= 500;
        console.error('Gemini API error:', response.status, text.slice(0, 1000));
        if (retryable && attempt + 1 < GEMINI_MAX_ATTEMPTS) {
          await sleep(retryDelayMs(attempt, response.headers.get('retry-after')));
          continue;
        }
        const err = httpError(
          response.status === 429 ? 429 : 502,
          response.status === 429 ? 'Gemini đang giới hạn lượt gọi. Vui lòng thử lại sau.' : 'Gemini API đang bận hoặc cấu hình chưa đúng.',
          'GEMINI_ERROR'
        );
        err.upstreamStatus = response.status;
        throw err;
      }

      let payload;
      try {
        payload = JSON.parse(text);
      } catch {
        throw httpError(502, 'Không đọc được phản hồi từ Gemini API.', 'GEMINI_BAD_RESPONSE');
      }

      const outputText = extractOutputText(payload);
      if (!outputText) throw httpError(502, 'Gemini không trả về hành trình hợp lệ.', 'GEMINI_EMPTY_RESPONSE');

      let itinerary;
      try {
        itinerary = JSON.parse(outputText);
      } catch {
        throw httpError(502, 'Gemini trả về dữ liệu không đúng định dạng.', 'GEMINI_BAD_JSON');
      }

      return {
        itinerary,
        interactionId: typeof payload.id === 'string' ? payload.id : null,
        usage: payload.usage || null
      };
    } catch (error) {
      if (error?.name === 'AbortError') {
        lastError = httpError(504, 'Gemini phản hồi quá lâu. Vui lòng thử lại.', 'GEMINI_TIMEOUT');
        if (attempt + 1 < GEMINI_MAX_ATTEMPTS) {
          await sleep(retryDelayMs(attempt));
          continue;
        }
        throw lastError;
      }
      lastError = error;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError || httpError(502, 'Không thể gọi Gemini API.', 'GEMINI_ERROR');
}

const rateBuckets = new Map();

function clientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwarded || req.socket.remoteAddress || 'unknown';
}

function checkRateLimit(req) {
  const now = Date.now();
  const key = clientIp(req);
  const current = rateBuckets.get(key);

  if (!current || now >= current.resetAt) {
    const bucket = { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
    rateBuckets.set(key, bucket);
    return { remaining: Math.max(0, RATE_LIMIT_MAX - 1), resetAt: bucket.resetAt };
  }

  current.count += 1;
  if (current.count > RATE_LIMIT_MAX) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    const err = httpError(429, `Bạn đã dùng quá nhiều lượt AI. Thử lại sau khoảng ${retryAfterSeconds} giây.`, 'RATE_LIMITED');
    err.retryAfter = retryAfterSeconds;
    throw err;
  }

  return { remaining: Math.max(0, RATE_LIMIT_MAX - current.count), resetAt: current.resetAt };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets.entries()) {
    if (now >= bucket.resetAt) rateBuckets.delete(key);
  }
}, Math.min(RATE_LIMIT_WINDOW_MS, 60_000)).unref();

const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

function writeHead(res, status, headers = {}) {
  res.writeHead(status, { ...securityHeaders, ...headers });
}

function sendJson(res, status, body, extraHeaders = {}) {
  const data = JSON.stringify(body);
  writeHead(res, status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(data);
}

async function readJson(req) {
  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  if (!contentType.includes('application/json')) throw httpError(415, 'Content-Type phải là application/json.');

  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > 100_000) throw httpError(413, 'Request quá lớn.');
  }

  try {
    return body ? JSON.parse(body) : {};
  } catch {
    throw httpError(400, 'JSON không hợp lệ.');
  }
}

const mime = {
  '.html':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.svg':'image/svg+xml'
};

async function serveStatic(req, res, pathname) {
  const requested = pathname === '/' ? '/index.html' : pathname;
  const safePath = path.normalize(requested).replace(/^([.][.][/\\])+/, '');
  const filePath = path.join(publicDir, safePath);
  if (!filePath.startsWith(publicDir)) return false;

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile()) return false;
    const data = await fs.readFile(filePath);
    writeHead(res, 200, {
      'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream',
      'Content-Length': data.byteLength,
      'Cache-Control': process.env.NODE_ENV === 'production' ? 'public, max-age=3600' : 'no-cache'
    });
    if (req.method === 'HEAD') return res.end();
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return sendJson(res, 400, { error: 'URL không hợp lệ.' });
  }

  try {
    if (req.method === 'GET' && pathname === '/api/health') {
      return sendJson(res, 200, {
        ok: true,
        model: MODEL,
        geminiConfigured: Boolean(API_KEY),
        rateLimit: { max: RATE_LIMIT_MAX, windowMs: RATE_LIMIT_WINDOW_MS }
      });
    }

    if (req.method === 'POST' && pathname === '/api/generate') {
      const rate = checkRateLimit(req);
      const prefs = cleanPreferences(await readJson(req));
      const result = await callGemini(buildGeneratePrompt(prefs));
      return sendJson(res, 200, {
        itinerary: result.itinerary,
        prefs,
        interactionId: result.interactionId,
        model: MODEL
      }, {
        'X-RateLimit-Remaining': String(rate.remaining)
      });
    }

    if (req.method === 'POST' && pathname === '/api/refine') {
      const rate = checkRateLimit(req);
      const body = await readJson(req);
      const prefs = cleanPreferences(body?.prefs || {});
      if (!body?.itinerary || typeof body.itinerary !== 'object') {
        return sendJson(res, 400, { error: 'Thiếu hành trình để tinh chỉnh.' });
      }

      const interactionId = typeof body.interactionId === 'string' ? body.interactionId.slice(0, 300) : null;
      let result;

      if (interactionId) {
        try {
          result = await callGemini(buildContinuationPrompt(String(body.action || '')), {
            previousInteractionId: interactionId
          });
        } catch (error) {
          // Stored interactions can expire (especially on Free Tier). Fall back to a stateless refine.
          if (error.code !== 'GEMINI_ERROR' || error.upstreamStatus !== 400) throw error;
          result = await callGemini(buildStatelessRefinePrompt(
            prefs,
            body.itinerary,
            String(body.action || '')
          ));
        }
      } else {
        result = await callGemini(buildStatelessRefinePrompt(
          prefs,
          body.itinerary,
          String(body.action || '')
        ));
      }

      return sendJson(res, 200, {
        itinerary: result.itinerary,
        prefs,
        interactionId: result.interactionId,
        model: MODEL
      }, {
        'X-RateLimit-Remaining': String(rate.remaining)
      });
    }

    if (req.method === 'GET' || req.method === 'HEAD') {
      if (await serveStatic(req, res, pathname)) return;
      const index = await fs.readFile(path.join(publicDir, 'index.html'));
      writeHead(res, 200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Length': index.byteLength,
        'Cache-Control': 'no-cache'
      });
      if (req.method === 'HEAD') return res.end();
      return res.end(index);
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (error) {
    const status = Number(error.status) || 500;
    const headers = error.retryAfter ? { 'Retry-After': String(error.retryAfter) } : {};
    if (status >= 500) console.error(error);
    sendJson(res, status, { error: error.message || 'Đã xảy ra lỗi.', code: error.code || 'INTERNAL_ERROR' }, headers);
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`TripStory AI running on http://0.0.0.0:${PORT}`);
  console.log(`Gemini model: ${MODEL}`);
  console.log(`Gemini configured: ${Boolean(API_KEY)}`);
  console.log(`Rate limit: ${RATE_LIMIT_MAX} AI requests / ${RATE_LIMIT_WINDOW_MS}ms per IP`);
});
