const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const SAVED_KEY = 'tripstory:saved:v2';
const LEGACY_KEY = 'tripstory:saved';

function readSaved() {
  try {
    const items = JSON.parse(localStorage.getItem(SAVED_KEY) || '[]');
    if (Array.isArray(items)) return items.filter(x => x?.itinerary && x?.prefs).slice(0, 20);
  } catch {}
  return [];
}

function migrateLegacy(items) {
  if (items.length) return items;
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || 'null');
    if (!legacy?.itinerary || !legacy?.prefs) return items;
    const migrated = [{
      id: `legacy-${legacy.savedAt || Date.now()}`,
      itinerary: legacy.itinerary,
      prefs: legacy.prefs,
      interactionId: null,
      savedAt: legacy.savedAt || Date.now()
    }];
    localStorage.setItem(SAVED_KEY, JSON.stringify(migrated));
    localStorage.removeItem(LEGACY_KEY);
    return migrated;
  } catch { return items; }
}

const state = {
  prefs: null,
  itinerary: null,
  interactionId: null,
  savedId: null,
  apiReady: false,
  saved: migrateLegacy(readSaved())
};

const money = n => new Intl.NumberFormat('vi-VN').format(Number(n || 0)) + 'đ';
const esc = v => String(v ?? '').replace(/[&<>'"]/g, c => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;'
}[c]));

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}

function loading(on, title = 'Đang viết câu chuyện chuyến đi…', text = 'Gemini đang cân bằng trải nghiệm, ngân sách và nhịp đi.') {
  $('#loadingTitle').textContent = title;
  $('#loadingText').textContent = text;
  $('#loading').classList.toggle('hidden', !on);
  $('#loading').setAttribute('aria-hidden', on ? 'false' : 'true');
}

async function api(path, payload) {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type':'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Không thể xử lý yêu cầu lúc này.');
  return data;
}

async function health() {
  try {
    const r = await fetch('/api/health');
    const data = await r.json();
    state.apiReady = Boolean(data.geminiConfigured);
    $('#apiStatus').textContent = state.apiReady ? `Gemini sẵn sàng · ${data.model}` : 'Demo mode · chưa có API key';
    $('#apiStatus').classList.toggle('off', !state.apiReady);
  } catch {
    $('#apiStatus').textContent = 'Offline demo';
    $('#apiStatus').classList.add('off');
  }
}

function initControls() {
  $$('.segmented').forEach(group => group.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (!btn) return;
    group.querySelectorAll('button').forEach(x => x.classList.remove('active'));
    btn.classList.add('active');
  }));
  $('#interestChips').addEventListener('click', e => e.target.closest('button')?.classList.toggle('selected'));
}

function prefs() {
  return {
    destination: $('#destination').value.trim(),
    days: Number($('#days').value),
    budget: Number($('#budget').value),
    companions: $('.segmented[data-name="companions"] .active')?.dataset.value || 'solo',
    pace: $('.segmented[data-name="pace"] .active')?.dataset.value || 'balanced',
    interests: $$('#interestChips .selected').map(x => x.dataset.value),
    notes: $('#notes').value.trim(),
    language: 'vi'
  };
}

function showTrip(itinerary, tripPrefs, { interactionId = null, savedId = null } = {}) {
  state.itinerary = itinerary;
  state.prefs = tripPrefs;
  state.interactionId = interactionId;
  state.savedId = savedId;
  $('#builderView').classList.add('hidden');
  $('#resultView').classList.remove('hidden');
  render();
  window.scrollTo({ top:0, behavior:'smooth' });
}

async function generate(e) {
  e.preventDefault();
  const p = prefs();
  if (!p.destination) return toast('Nhập điểm đến trước nhé.');
  if (!state.apiReady) return openDemo();

  loading(true);
  try {
    const data = await api('/api/generate', p);
    showTrip(data.itinerary, data.prefs, { interactionId:data.interactionId });
  } catch (e) { toast(e.message); }
  finally { loading(false); }
}

function render() {
  const t = state.itinerary;
  if (!t) return;

  $('#tripHero').innerHTML = `
    <div class="trip-kicker">${esc(t.days?.length || 0)} NGÀY · ${esc(t.destination)}</div>
    <h2>${esc(t.title)}</h2>
    <div class="tagline">${esc(t.tagline)}</div>
    <div class="trip-meta">
      <span>💰 ~${money(t.estimated_total_vnd)}</span>
      <span>🧭 ${esc(t.days?.length || 0)} ngày</span>
      <span>✨ Story-first itinerary</span>
    </div>`;

  $('#daysContainer').innerHTML = (t.days || []).map(day => `
    <section class="day-card">
      <div class="day-head">
        <div>
          <div class="day-label">NGÀY ${esc(day.day)}</div>
          <h3>${esc(day.theme)}</h3>
          <p>${esc(day.story_intro)}</p>
        </div>
        <div class="day-cost">~ ${money(day.estimated_day_cost_vnd)}</div>
      </div>
      <div class="timeline">${(day.stops || []).map(stop => `
        <article class="stop">
          <div class="stop-time">${esc(stop.time)}</div>
          <div class="stop-line"><span class="stop-dot"></span></div>
          <div class="stop-content">
            <h4>${esc(stop.place)}</h4>
            <div class="stop-area">${esc(stop.area)}</div>
            <p class="stop-activity">${esc(stop.activity)}</p>
            <div class="story-box"><strong>📖 Câu chuyện</strong><p>${esc(stop.story)}</p></div>
            <div class="stop-notes">
              ${stop.local_tip ? `<span class="note-chip">💡 ${esc(stop.local_tip)}</span>` : ''}
              ${stop.food ? `<span class="note-chip">🍜 ${esc(stop.food)}</span>` : ''}
              ${stop.mini_challenge ? `<span class="note-chip">🎯 ${esc(stop.mini_challenge)}</span>` : ''}
              <span class="note-chip">💰 ~${money(stop.estimated_cost_vnd)}</span>
              ${stop.verify_before_go ? `<span class="note-chip verify">✓ Kiểm tra: ${esc(stop.verify_before_go)}</span>` : ''}
            </div>
          </div>
        </article>`).join('')}</div>
    </section>`).join('');

  $('#tipsCard').innerHTML = `
    <h3>Trước khi lên đường</h3>
    <p>${esc(t.overview)}</p>
    <ul>${(t.travel_tips || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    <p><strong>Ngân sách:</strong> ${esc(t.budget_note)}</p>`;
  $('#saveBtn').textContent = state.savedId ? '♥ Đã lưu' : '♡ Lưu';
}

async function refine(action) {
  if (!state.itinerary || !state.prefs) return;
  if (!state.apiReady) return toast('Tinh chỉnh AI cần GEMINI_API_KEY.');

  loading(true, 'Đang tinh chỉnh hành trình…', 'TripStory giữ lại phần hay và chỉ thay đổi điều bạn yêu cầu.');
  try {
    const data = await api('/api/refine', {
      prefs:state.prefs,
      itinerary:state.itinerary,
      interactionId:state.interactionId,
      action
    });
    state.itinerary = data.itinerary;
    state.interactionId = data.interactionId || null;
    if (state.savedId) updateSaved(state.savedId);
    render();
    toast('Đã cập nhật hành trình.');
  } catch (e) { toast(e.message); }
  finally { loading(false); }
}

function textTrip() {
  const t = state.itinerary;
  if (!t) return '';
  let out = `${t.title}\n${t.tagline}\nƯớc tính: ${money(t.estimated_total_vnd)}\n\n`;
  for (const day of t.days || []) {
    out += `NGÀY ${day.day} — ${day.theme}\n${day.story_intro}\n`;
    for (const stop of day.stops || []) out += `• ${stop.time} — ${stop.place}: ${stop.activity}\n`;
    out += '\n';
  }
  return out + 'Tạo bởi TripStory AI — Hãy kiểm tra thông tin vận hành trước khi đi.';
}

async function share() {
  const text = textTrip();
  try {
    if (navigator.share) await navigator.share({ title:state.itinerary?.title || 'TripStory AI', text });
    else {
      await navigator.clipboard.writeText(text);
      toast('Đã sao chép để chia sẻ.');
    }
  } catch (e) { if (e.name !== 'AbortError') toast('Không thể chia sẻ lúc này.'); }
}

function persist() {
  state.saved = state.saved.slice(0, 20);
  localStorage.setItem(SAVED_KEY, JSON.stringify(state.saved));
  savedCount();
}

function savedCount() {
  const n = state.saved.length;
  $('#savedBtn').textContent = n ? `♡ ${n}` : '♡';
  $('#savedBtn').setAttribute('aria-label', n ? `${n} chuyến đi đã lưu` : 'Chưa có chuyến đi đã lưu');
}

function updateSaved(id) {
  const i = state.saved.findIndex(x => x.id === id);
  if (i < 0) return;
  state.saved[i] = {
    ...state.saved[i],
    itinerary:state.itinerary,
    prefs:state.prefs,
    interactionId:state.interactionId,
    savedAt:Date.now()
  };
  persist();
}

function save() {
  if (!state.itinerary) return;
  if (state.savedId) {
    updateSaved(state.savedId);
    render();
    return toast('Đã cập nhật chuyến đi đã lưu.');
  }
  const item = {
    id:`${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
    itinerary:state.itinerary,
    prefs:state.prefs,
    interactionId:state.interactionId,
    savedAt:Date.now()
  };
  state.saved.unshift(item);
  state.savedId = item.id;
  persist();
  render();
  toast('Đã lưu chuyến đi trên thiết bị này.');
}

const savedDate = ts => new Intl.DateTimeFormat('vi-VN', {
  day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'
}).format(new Date(ts));

function renderSaved() {
  $('#savedTripsList').innerHTML = [...state.saved].sort((a,b) => b.savedAt - a.savedAt).map(item => `
    <article class="saved-trip-item">
      <button class="saved-trip-open" type="button" data-open="${esc(item.id)}">
        <strong>${esc(item.itinerary?.title || item.itinerary?.destination || 'Chuyến đi')}</strong>
        <span>${esc(item.itinerary?.destination || '')} · ${esc(item.itinerary?.days?.length || item.prefs?.days || 0)} ngày</span>
        <small>${esc(savedDate(item.savedAt))}</small>
      </button>
      <button class="saved-trip-delete" type="button" data-delete="${esc(item.id)}" aria-label="Xoá chuyến đi">×</button>
    </article>`).join('');
}

function openSaved() {
  if (!state.saved.length) return toast('Chưa có chuyến đi nào được lưu.');
  renderSaved();
  $('#savedDialog').showModal();
}

function download() {
  if (!state.itinerary) return;
  const blob = new Blob([JSON.stringify({ prefs:state.prefs, itinerary:state.itinerary }, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const slug = (state.itinerary.destination || 'trip').normalize('NFD')
    .replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/đ/g,'d')
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'trip';
  const a = document.createElement('a');
  a.href = url;
  a.download = `tripstory-${slug}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function openDemo() {
  try {
    const r = await fetch('/demo.json');
    const data = await r.json();
    toast('Đang mở bản demo — chưa dùng Gemini API.');
    showTrip(data.itinerary, data.prefs);
  } catch { toast('Không tải được bản demo.'); }
}

$('#tripForm').addEventListener('submit', generate);
$('#demoBtn').addEventListener('click', openDemo);
$('#backBtn').addEventListener('click', () => {
  $('#resultView').classList.add('hidden');
  $('#builderView').classList.remove('hidden');
  state.savedId = null;
  state.interactionId = null;
  window.scrollTo({ top:0, behavior:'smooth' });
});
$$('[data-refine]').forEach(btn => btn.addEventListener('click', () => refine(btn.dataset.refine)));
$('#saveBtn').addEventListener('click', save);
$('#shareBtn').addEventListener('click', share);
$('#copyBtn').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(textTrip()); toast('Đã sao chép hành trình.'); }
  catch { toast('Trình duyệt không cho phép sao chép tự động.'); }
});
$('#downloadBtn').addEventListener('click', download);
$('#savedBtn').addEventListener('click', openSaved);
$('#savedDialogClose').addEventListener('click', () => $('#savedDialog').close());
$('#savedTripsList').addEventListener('click', e => {
  const del = e.target.closest('[data-delete]');
  if (del) {
    state.saved = state.saved.filter(x => x.id !== del.dataset.delete);
    if (state.savedId === del.dataset.delete) state.savedId = null;
    persist();
    renderSaved();
    render();
    if (!state.saved.length) $('#savedDialog').close();
    return toast('Đã xoá chuyến đi.');
  }
  const open = e.target.closest('[data-open]');
  if (!open) return;
  const item = state.saved.find(x => x.id === open.dataset.open);
  if (!item) return;
  $('#savedDialog').close();
  showTrip(item.itinerary, item.prefs, {
    interactionId:item.interactionId || null,
    savedId:item.id
  });
});

initControls();
savedCount();
health();
