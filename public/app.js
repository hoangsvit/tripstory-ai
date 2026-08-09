const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const state = {
  prefs: null,
  itinerary: null,
  apiReady: false,
  saved: JSON.parse(localStorage.getItem('tripstory:saved') || 'null')
};

const interestLabels = {
  culture: 'Văn hoá', food: 'Ẩm thực', history: 'Lịch sử', nature: 'Thiên nhiên',
  coffee: 'Cà phê', 'local-life': 'Đời sống địa phương', architecture: 'Kiến trúc'
};

const demoPrefs = {
  destination: 'Huế', days: 2, budget: 1500000, pace: 'balanced',
  interests: ['culture', 'food', 'history'], companions: 'solo', notes: '', language: 'vi'
};

const demoItinerary = {
  title: 'Huế chậm rãi, sâu hơn một chút',
  destination: 'Huế',
  tagline: 'Hai ngày đi giữa ký ức cố đô, nhịp sống bên sông và những món ăn nhỏ mà đậm chất Huế.',
  overview: 'Hành trình ưu tiên cụm điểm gần nhau, dành đủ thời gian để nghe câu chuyện của từng nơi thay vì chạy theo checklist.',
  estimated_total_vnd: 1180000,
  budget_note: 'Ước tính cho một người, chưa gồm lưu trú và chi phí di chuyển đến Huế. Giá thực tế có thể thay đổi.',
  travel_tips: [
    'Bắt đầu sớm để tránh nắng và có nhiều khoảng nghỉ giữa ngày.',
    'Mang nước, nón và trang phục lịch sự khi ghé không gian tôn giáo hoặc di tích.',
    'Giờ mở cửa và giá vé có thể thay đổi; nên kiểm tra nguồn chính thức trước khi đi.'
  ],
  days: [
    {
      day: 1,
      theme: 'Dấu vết kinh thành & nhịp sống bên sông',
      story_intro: 'Ngày đầu đi từ không gian cung đình ra đời sống thường nhật — hai lớp tính cách tạo nên Huế.',
      estimated_day_cost_vnd: 580000,
      stops: [
        {
          time: '08:00', place: 'Kinh thành Huế', area: 'Thuận Thành',
          activity: 'Đi chậm qua các trục chính, chọn vài công trình để đọc kỹ thay vì cố xem hết.',
          story: 'Kinh thành là điểm mở đầu tốt để hiểu cấu trúc quyền lực, nghi lễ và thẩm mỹ của cố đô. Hãy chú ý cách không gian được tổ chức theo lớp và trục.',
          local_tip: 'Ưu tiên giày dễ đi và dành ít nhất một khoảng nghỉ trong khuôn viên.',
          food: 'Sau chuyến tham quan có thể tìm bún bò Huế ở khu vực trung tâm.',
          mini_challenge: 'Tìm một chi tiết kiến trúc lặp lại nhiều lần và đoán ý nghĩa của nó trước khi tra cứu.',
          estimated_cost_vnd: 250000,
          verify_before_go: 'Kiểm tra giờ mở cửa và giá vé hiện tại từ nguồn chính thức.'
        },
        {
          time: '12:00', place: 'Bữa trưa món Huế', area: 'Trung tâm',
          activity: 'Chọn một quán địa phương, gọi phần vừa phải và thử thêm một món nhỏ chưa từng ăn.',
          story: 'Ẩm thực Huế thường gây ấn tượng bởi khẩu phần vừa, cách nêm đậm và sự đa dạng của các món nhỏ.',
          local_tip: 'Nếu không ăn cay, nói trước với quán khi gọi món.',
          food: 'Bún bò, bánh bèo, bánh nậm hoặc bánh lọc.',
          mini_challenge: 'Chọn một món có tên bạn chưa biết và hỏi người bán cách người Huế thường ăn món đó.',
          estimated_cost_vnd: 120000,
          verify_before_go: 'Giá thay đổi theo quán; xem menu trước khi gọi.'
        },
        {
          time: '16:00', place: 'Đi bộ ven sông Hương', area: 'Bờ Nam',
          activity: 'Đi bộ nhẹ, ngồi nghỉ và quan sát nhịp thành phố lúc chiều xuống.',
          story: 'Sông Hương không chỉ là cảnh quan; nó là một phần mạnh trong hình dung về nhịp sống và bản sắc Huế.',
          local_tip: 'Khoảng cuối chiều thường dễ chịu hơn giữa trưa.',
          food: 'Có thể dừng cà phê hoặc chè Huế nếu còn ngân sách.',
          mini_challenge: 'Ghi lại ba âm thanh bạn nghe thấy quanh sông và dùng chúng làm “soundtrack” cho ngày đầu.',
          estimated_cost_vnd: 80000,
          verify_before_go: 'Theo dõi thời tiết trong ngày.'
        }
      ]
    },
    {
      day: 2,
      theme: 'Tĩnh hơn, gần đời sống địa phương hơn',
      story_intro: 'Ngày thứ hai giảm nhịp: một không gian tâm linh, một khu phố và một bữa ăn để nhìn Huế ngoài lớp di sản lớn.',
      estimated_day_cost_vnd: 600000,
      stops: [
        {
          time: '08:30', place: 'Chùa Thiên Mụ', area: 'Kim Long',
          activity: 'Tham quan trong im lặng vừa đủ, chú ý cảnh quan nhìn ra sông và cách không gian tạo cảm giác tĩnh.',
          story: 'Thiên Mụ là một biểu tượng quen thuộc của Huế và gắn chặt với cảnh quan sông Hương.',
          local_tip: 'Ăn mặc lịch sự, nói nhỏ và tôn trọng không gian sinh hoạt tôn giáo.',
          food: 'Có thể tìm món chay cho bữa trưa nếu muốn nối tiếp không khí buổi sáng.',
          mini_challenge: 'Chọn một góc không chụp ảnh ngay; đứng yên một phút rồi viết một câu mô tả cảm giác.',
          estimated_cost_vnd: 120000,
          verify_before_go: 'Kiểm tra quy định tham quan tại thời điểm đi.'
        },
        {
          time: '11:30', place: 'Khu Kim Long', area: 'Kim Long',
          activity: 'Dành thời gian cho một bữa trưa và đi qua vài con đường nhỏ thay vì di chuyển ngay sang điểm nổi tiếng khác.',
          story: 'Những khu dân cư cũ giúp chuyến đi có thêm lớp đời sống thường nhật, cân bằng với các điểm di sản lớn.',
          local_tip: 'Giữ sự riêng tư của người dân; tránh chụp người hoặc nhà ở cự ly gần khi chưa xin phép.',
          food: 'Cơm Huế hoặc món chay địa phương.',
          mini_challenge: 'Tìm một biển hiệu hoặc cách đặt tên cửa hàng khiến bạn thấy “rất Huế”.',
          estimated_cost_vnd: 180000,
          verify_before_go: 'Chọn quán có thông tin và đánh giá cập nhật.'
        },
        {
          time: '15:30', place: 'Một quán cà phê yên tĩnh', area: 'Trung tâm Huế',
          activity: 'Kết thúc bằng một giờ nghỉ, tổng kết ảnh/ghi chú và viết “3 điều mình hiểu hơn về Huế”.',
          story: 'Một chuyến đi có câu chuyện cần cả khoảng trống để người đi tự nối các trải nghiệm lại với nhau.',
          local_tip: 'Chọn quán gần điểm rời thành phố để tránh di chuyển vòng lại.',
          food: 'Cà phê hoặc đồ uống địa phương.',
          mini_challenge: 'Viết một postcard 50 từ cho chính bạn của một tháng sau.',
          estimated_cost_vnd: 90000,
          verify_before_go: 'Kiểm tra địa điểm phù hợp với lịch rời Huế của bạn.'
        }
      ]
    }
  ]
};

function money(n) {
  return new Intl.NumberFormat('vi-VN').format(Number(n || 0)) + 'đ';
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[c]));
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2200);
}

function setLoading(on, title = 'Đang viết câu chuyện chuyến đi…', text = 'Gemini đang cân bằng trải nghiệm, ngân sách và nhịp đi.') {
  $('#loadingTitle').textContent = title;
  $('#loadingText').textContent = text;
  $('#loading').classList.toggle('hidden', !on);
  $('#loading').setAttribute('aria-hidden', on ? 'false' : 'true');
}

async function checkHealth() {
  try {
    const r = await fetch('/api/health');
    const data = await r.json();
    state.apiReady = Boolean(data.geminiConfigured);
    const pill = $('#apiStatus');
    if (state.apiReady) {
      pill.textContent = `Gemini sẵn sàng · ${data.model}`;
      pill.classList.remove('off');
    } else {
      pill.textContent = 'Demo mode · chưa có API key';
      pill.classList.add('off');
    }
  } catch {
    $('#apiStatus').textContent = 'Offline demo';
    $('#apiStatus').classList.add('off');
  }
}

function initControls() {
  $$('.segmented').forEach(group => {
    group.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  $('#interestChips').addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (btn) btn.classList.toggle('selected');
  });
}

function collectPrefs() {
  return {
    destination: $('#destination').value.trim(),
    days: Number($('#days').value),
    budget: Number($('#budget').value),
    companions: $('.segmented[data-name="companions"] .active')?.dataset.value || 'solo',
    pace: $('.segmented[data-name="pace"] .active')?.dataset.value || 'balanced',
    interests: $$('#interestChips .selected').map(b => b.dataset.value),
    notes: $('#notes').value.trim(),
    language: 'vi'
  };
}

async function generateTrip(e) {
  e.preventDefault();
  const prefs = collectPrefs();
  if (!prefs.destination) return toast('Nhập điểm đến trước nhé.');
  if (!state.apiReady) {
    toast('Chưa có GEMINI_API_KEY — đang mở demo.');
    showTrip(demoItinerary, demoPrefs);
    return;
  }

  setLoading(true);
  try {
    const r = await fetch('/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Không thể tạo hành trình.');
    showTrip(data.itinerary, data.prefs);
  } catch (err) {
    toast(err.message);
  } finally {
    setLoading(false);
  }
}

function showTrip(itinerary, prefs) {
  state.itinerary = itinerary;
  state.prefs = prefs;
  $('#builderView').classList.add('hidden');
  $('#resultView').classList.remove('hidden');
  renderTrip();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderTrip() {
  const t = state.itinerary;
  if (!t) return;
  $('#tripHero').innerHTML = `
    <div class="trip-kicker">${escapeHtml(String(t.days?.length || 0))} NGÀY · ${escapeHtml(t.destination)}</div>
    <h2>${escapeHtml(t.title)}</h2>
    <div class="tagline">${escapeHtml(t.tagline)}</div>
    <div class="trip-meta">
      <span>💰 ~${money(t.estimated_total_vnd)}</span>
      <span>🧭 ${escapeHtml(t.days?.length || 0)} ngày</span>
      <span>✨ Story-first itinerary</span>
    </div>`;

  $('#daysContainer').innerHTML = (t.days || []).map(day => `
    <section class="day-card">
      <div class="day-head">
        <div>
          <div class="day-label">NGÀY ${escapeHtml(day.day)}</div>
          <h3>${escapeHtml(day.theme)}</h3>
          <p>${escapeHtml(day.story_intro)}</p>
        </div>
        <div class="day-cost">~ ${money(day.estimated_day_cost_vnd)}</div>
      </div>
      <div class="timeline">
        ${(day.stops || []).map(stop => `
          <article class="stop">
            <div class="stop-time">${escapeHtml(stop.time)}</div>
            <div class="stop-line"><span class="stop-dot"></span></div>
            <div class="stop-content">
              <h4>${escapeHtml(stop.place)}</h4>
              <div class="stop-area">${escapeHtml(stop.area)}</div>
              <p class="stop-activity">${escapeHtml(stop.activity)}</p>
              <div class="story-box">
                <strong>📖 Câu chuyện</strong>
                <p>${escapeHtml(stop.story)}</p>
              </div>
              <div class="stop-notes">
                ${stop.local_tip ? `<span class="note-chip">💡 ${escapeHtml(stop.local_tip)}</span>` : ''}
                ${stop.food ? `<span class="note-chip">🍜 ${escapeHtml(stop.food)}</span>` : ''}
                ${stop.mini_challenge ? `<span class="note-chip">🎯 ${escapeHtml(stop.mini_challenge)}</span>` : ''}
                <span class="note-chip">💰 ~${money(stop.estimated_cost_vnd)}</span>
                ${stop.verify_before_go ? `<span class="note-chip verify">✓ Kiểm tra: ${escapeHtml(stop.verify_before_go)}</span>` : ''}
              </div>
            </div>
          </article>`).join('')}
      </div>
    </section>`).join('');

  $('#tipsCard').innerHTML = `
    <h3>Trước khi lên đường</h3>
    <p>${escapeHtml(t.overview)}</p>
    <ul>${(t.travel_tips || []).map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ul>
    <p><strong>Ngân sách:</strong> ${escapeHtml(t.budget_note)}</p>`;

  const isSaved = state.saved && state.saved.itinerary?.title === t.title;
  $('#saveBtn').textContent = isSaved ? '♥ Đã lưu' : '♡ Lưu';
}

async function refine(action) {
  if (!state.itinerary || !state.prefs) return;
  if (!state.apiReady) return toast('Tinh chỉnh AI cần GEMINI_API_KEY. Bản demo hiện chỉ để xem UI.');
  setLoading(true, 'Đang tinh chỉnh hành trình…', 'Giữ lại phần hay và điều chỉnh theo yêu cầu của bạn.');
  try {
    const r = await fetch('/api/refine', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefs: state.prefs, itinerary: state.itinerary, action })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Không thể tinh chỉnh.');
    state.itinerary = data.itinerary;
    renderTrip();
    toast('Đã cập nhật hành trình.');
  } catch (err) {
    toast(err.message);
  } finally {
    setLoading(false);
  }
}

function tripToText() {
  const t = state.itinerary;
  if (!t) return '';
  let out = `${t.title}\n${t.tagline}\nƯớc tính: ${money(t.estimated_total_vnd)}\n\n`;
  for (const day of t.days || []) {
    out += `NGÀY ${day.day} — ${day.theme}\n${day.story_intro}\n`;
    for (const s of day.stops || []) {
      out += `• ${s.time} — ${s.place}: ${s.activity}\n`;
    }
    out += '\n';
  }
  out += 'Tạo bởi TripStory AI — Hãy kiểm tra thông tin vận hành trước khi đi.';
  return out;
}

async function shareTrip() {
  const text = tripToText();
  try {
    if (navigator.share) await navigator.share({ title: state.itinerary?.title || 'TripStory AI', text });
    else { await navigator.clipboard.writeText(text); toast('Đã sao chép để chia sẻ.'); }
  } catch (err) {
    if (err.name !== 'AbortError') toast('Không thể chia sẻ lúc này.');
  }
}

function saveTrip() {
  if (!state.itinerary) return;
  state.saved = { itinerary: state.itinerary, prefs: state.prefs, savedAt: Date.now() };
  localStorage.setItem('tripstory:saved', JSON.stringify(state.saved));
  renderTrip();
  toast('Đã lưu trên thiết bị này.');
}

function downloadJson() {
  if (!state.itinerary) return;
  const blob = new Blob([JSON.stringify({ prefs: state.prefs, itinerary: state.itinerary }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `tripstory-${(state.itinerary.destination || 'trip').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

$('#tripForm').addEventListener('submit', generateTrip);
$('#demoBtn').addEventListener('click', () => showTrip(demoItinerary, demoPrefs));
$('#backBtn').addEventListener('click', () => {
  $('#resultView').classList.add('hidden');
  $('#builderView').classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
$$('[data-refine]').forEach(btn => btn.addEventListener('click', () => refine(btn.dataset.refine)));
$('#saveBtn').addEventListener('click', saveTrip);
$('#shareBtn').addEventListener('click', shareTrip);
$('#copyBtn').addEventListener('click', async () => {
  await navigator.clipboard.writeText(tripToText());
  toast('Đã sao chép hành trình.');
});
$('#downloadBtn').addEventListener('click', downloadJson);
$('#savedBtn').addEventListener('click', () => {
  if (!state.saved) return toast('Chưa có chuyến đi nào được lưu.');
  showTrip(state.saved.itinerary, state.saved.prefs);
});

initControls();
checkHealth();
