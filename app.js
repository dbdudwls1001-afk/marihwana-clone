// ===== CONFIG =====
const YT_CATEGORIES = [
  '영화/애니','자동차','음악','반려동물','여행/이벤트','게임',
  '일상/브이로그','코미디','엔터테인먼트','뉴스/정치','노하우/스타일',
  '교육','과학/기술','비영리/사회','먹방/요리','ASMR','재테크/경제'
];
const USAGE_LIMIT = 10000;
const USAGE_RESET_HOUR = 8; // UTC 8 = 태평양시(PST) 자정, 유튜브 API 할당량 리셋 기준

// ===== STATE =====
let channels = JSON.parse(localStorage.getItem('dontong_channels') || '[]');
let sources = JSON.parse(localStorage.getItem('dontong_sources') || '[]');
let customTypes = JSON.parse(localStorage.getItem('dontong_ctypes') || '[]');
let favTypes = JSON.parse(localStorage.getItem('dontong_favtypes') || '[]');
let bgms = JSON.parse(localStorage.getItem('dontong_bgms') || '[]');
let tchannels = JSON.parse(localStorage.getItem('dontong_tchannels') || '[]');
let tsources = JSON.parse(localStorage.getItem('dontong_tsources') || '[]');
// ===== 선택 내보내기 상태 (저장 안 함, 새로고침 시 초기화) =====
const selectMode = { channel:false, source:false, bgm:false, tchannel:false, tsource:false };
const selectedIds = { channel:new Set(), source:new Set(), bgm:new Set(), tchannel:new Set(), tsource:new Set() };
let customMoods = JSON.parse(localStorage.getItem('dontong_bgm_moods') || '[]');
let favMoods = JSON.parse(localStorage.getItem('dontong_bgm_favmoods') || '[]');
let bgmSelectedMood = '';
let bgmSort = { key: null, asc: true };
const DEFAULT_MOODS = ['긴장감','슬픔','잔잔','신남','감동','긴박','몽환','유머','공포','웅장'];
let chSort = { key: null, asc: true };
let srcSort = { key: null, asc: true };
let chSelectedType = '';
let srcSelectedType = '';
let tchSort = { key: null, asc: true };
let tsrSort = { key: null, asc: true };
let tchSelectedPlatform = '';
let tsrSelectedPlatform = '';
const PLATFORMS = ['틱톡','인스타'];

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  updateApiDot();
  checkUsageReset();
  updateUsageUI();
  renderChannelTable();
  renderSourceTable();
  renderBgmTable();
  updateFilterOptions();
  updateBgmFilterOptions();
  renderTChannelTable();
  renderTSourceTable();
  buildPlatformDropdown('tch');
  buildPlatformDropdown('tsr');
});


// ===== EASTER EGG =====
function openEasterEgg() { document.getElementById('easterModal').classList.add('open'); }
function closeEasterEgg() { document.getElementById('easterModal').classList.remove('open'); }

// ===== TOAST =====
function toast(msg, type='') {
  const c = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ===== TABS =====
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  document.getElementById('tab-channel').style.display = tab === 'channel' ? '' : 'none';
  document.getElementById('tab-source').style.display = tab === 'source' ? '' : 'none';
  document.getElementById('tab-bgm').style.display = tab === 'bgm' ? '' : 'none';
  document.getElementById('tab-tchannel').style.display = tab === 'tchannel' ? '' : 'none';
  document.getElementById('tab-tsource').style.display = tab === 'tsource' ? '' : 'none';
}

// ===== BGM =====
async function fetchBgm() {
  const key = getApiKey();
  if (!key) {
    toast('API 키를 먼저 설정해주세요', 'error');
    openApiModal();
    return;
  }
  const raw = document.getElementById('bgm-url').value.trim();
  if (!raw) { toast('링크를 입력해주세요', 'error'); return; }

  const videoId = extractYouTubeId(raw);
  if (!videoId) { toast('올바른 유튜브 링크를 입력해주세요', 'error'); return; }

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(await apiErrorMessage(res));
    const data = await res.json();
    addUsage(1);

    if (!data.items || !data.items.length) { toast('영상을 찾을 수 없습니다', 'error'); return; }

    const v = data.items[0];
    document.getElementById('bgm-title').value = v.snippet.title;
    toast(`✅ "${v.snippet.title}" 불러옴`, 'success');
  } catch(e) {
    toast('오류: ' + e.message, 'error');
  }
}

function saveBgm() {
  const title = document.getElementById('bgm-title').value.trim();
  const url = document.getElementById('bgm-url').value.trim();
  const memo = document.getElementById('bgm-memo').value.trim();
  if (!title) { toast('곡명을 입력하세요', 'error'); return; }

  const item = {
    id: genId(),
    title, url, memo,
    mood: bgmSelectedMood || '',
    fav: false,
    date: new Date().toISOString()
  };
  bgms.unshift(item);
  localStorage.setItem('dontong_bgms', JSON.stringify(bgms));

  // 입력 초기화
  document.getElementById('bgm-title').value = '';
  document.getElementById('bgm-url').value = '';
  document.getElementById('bgm-memo').value = '';
  bgmSelectedMood = '';
  document.getElementById('bgm-mood-label').textContent = '분위기 선택';

  renderBgmTable();
  updateBgmFilterOptions();
  toast('BGM 저장 완료', 'success');
}

function renderBgmTable() {
  if (selectMode.bgm) updateSelectBar('bgm');
  const search = document.getElementById('bgm-search').value.toLowerCase();
  const filter = document.getElementById('bgm-filter').value;
  let data = bgms.filter(b => {
    if (filter && b.mood !== filter) return false;
    if (search) {
      return (b.title||'').toLowerCase().includes(search) ||
             (b.mood||'').toLowerCase().includes(search) ||
             (b.memo||'').toLowerCase().includes(search);
    }
    return true;
  });

  if (bgmSort.key) {
    data.sort((a,b) => {
      let va = a[bgmSort.key], vb = b[bgmSort.key];
      va = (va||'').toString().toLowerCase();
      vb = (vb||'').toString().toLowerCase();
      return bgmSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }
  // 즐겨찾기는 정렬과 무관하게 항상 맨 위로 고정
  data.sort((a,b) => (b.fav?1:0) - (a.fav?1:0));

  const tbody = document.getElementById('bgm-tbody');
  const nodata = document.getElementById('bgm-nodata');
  document.getElementById('bgm-count').textContent = `${data.length}개`;

  if (!data.length) {
    tbody.innerHTML = '';
    nodata.style.display = '';
    return;
  }
  nodata.style.display = 'none';

  tbody.innerHTML = data.map(b => {
    const ytId = extractYouTubeId(b.url);
    const thumbImg = ytId
      ? `<img class="bgm-thumb" src="https://img.youtube.com/vi/${ytId}/mqdefault.jpg" 
          onerror="this.style.display='none'" alt="">`
      : '';
    const thumbHtml = (thumbImg && b.url)
      ? `<a href="${esc(safeUrl(b.url))}" target="_blank" rel="noopener noreferrer" title="유튜브에서 열기" style="display:block;flex-shrink:0;">${thumbImg}</a>`
      : thumbImg;
    const linkBtn = b.url
      ? `<a href="${esc(safeUrl(b.url))}" target="_blank" rel="noopener noreferrer" title="유튜브에서 열기" style="text-decoration:none;font-size:18px;">▶️</a>`
      : '';
    const favIcon = b.fav ? '⭐' : '☆';
    return `
    <tr>
      ${selCell('bgm',b.id)}
      <td>
        <div class="bgm-title-cell">
          ${thumbHtml}
          <div class="bgm-title-text">${esc(b.title)}</div>
        </div>
      </td>
      <td>${esc(b.mood||'-')}</td>
      <td>${esc(b.memo||'-')}</td>
      <td>${linkBtn}</td>
      <td class="cell-actions">
        <button class="fav-btn${b.fav?' fav-on':''}" onclick="toggleFavItem('bgm',${b.id})" title="즐겨찾기">${favIcon}</button>
        <button onclick="editItem('bgm',${b.id})" title="수정">✏️</button>
        <button onclick="deleteItem('bgm',${b.id})" title="삭제">🗑️</button>
      </td>
    </tr>
  `;
  }).join('');
}

// 유튜브 ID 추출 (다양한 URL 형식 지원)
function extractYouTubeId(url) {
  if (!url) return '';
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return '';
}

// BGM 분위기 드롭다운
function toggleMoodDropdown() {
  const panel = document.getElementById('bgm-mood-panel');
  const wasOpen = panel.classList.contains('open');
  document.querySelectorAll('.ct-dropdown-panel').forEach(p => p.classList.remove('open'));
  if (!wasOpen) {
    buildMoodDropdown();
    panel.classList.add('open');
  }
}

function buildMoodDropdown() {
  const panel = document.getElementById('bgm-mood-panel');
  let html = '';

  // Custom input
  html += `<div class="ct-custom-input">
    <input id="bgm-mood-custom-input" placeholder="직접 입력">
    <button onclick="addCustomMood()">추가</button>
  </div>`;

  // Favorites
  if (favMoods.length) {
    html += `<div class="ct-section-label">⭐ 즐겨찾기</div>`;
    favMoods.forEach(t => {
      html += moodOptionHTML(t, true, customMoods.includes(t));
    });
  }

  // Custom moods
  const nonFavCustom = customMoods.filter(t => !favMoods.includes(t));
  if (nonFavCustom.length) {
    html += `<div class="ct-section-label">📝 직접 입력</div>`;
    nonFavCustom.forEach(t => {
      html += moodOptionHTML(t, false, true);
    });
  }

  // Default moods
  html += `<div class="ct-section-label">🎵 기본 분위기</div>`;
  DEFAULT_MOODS.forEach(t => {
    if (!favMoods.includes(t)) {
      html += moodOptionHTML(t, false, false);
    }
  });

  panel.innerHTML = html;
}

function moodOptionHTML(text, isFav, isCustom) {
  const sel = text === bgmSelectedMood ? ' selected' : '';
  const favIcon = favMoods.includes(text) ? '★' : '☆';
  let actions = `<span class="ct-option-actions">
    <button onclick="event.stopPropagation();toggleFavMood('${esc(text)}')" title="즐겨찾기">${favIcon}</button>`;
  if (isCustom) {
    actions += `<button onclick="event.stopPropagation();editCustomMood('${esc(text)}')" title="수정">✏️</button>`;
    actions += `<button onclick="event.stopPropagation();deleteCustomMood('${esc(text)}')" title="삭제">🗑</button>`;
  }
  actions += `</span>`;
  return `<div class="ct-option${sel}" onclick="selectMood('${esc(text)}')">
    <span>${esc(text)}</span>${actions}</div>`;
}

function selectMood(mood) {
  bgmSelectedMood = mood;
  document.getElementById('bgm-mood-label').textContent = mood;
  document.querySelectorAll('.ct-dropdown-panel').forEach(p => p.classList.remove('open'));
}

function addCustomMood() {
  const input = document.getElementById('bgm-mood-custom-input');
  const val = cleanLabel(input.value);
  if (!val) return;
  if (!customMoods.includes(val) && !DEFAULT_MOODS.includes(val)) {
    customMoods.push(val);
    localStorage.setItem('dontong_bgm_moods', JSON.stringify(customMoods));
  }
  selectMood(val);
  updateBgmFilterOptions();
}

function toggleFavMood(mood) {
  if (favMoods.includes(mood)) favMoods = favMoods.filter(t => t !== mood);
  else favMoods.push(mood);
  localStorage.setItem('dontong_bgm_favmoods', JSON.stringify(favMoods));
  buildMoodDropdown();
}

function deleteCustomMood(mood) {
  customMoods = customMoods.filter(t => t !== mood);
  favMoods = favMoods.filter(t => t !== mood);
  localStorage.setItem('dontong_bgm_moods', JSON.stringify(customMoods));
  localStorage.setItem('dontong_bgm_favmoods', JSON.stringify(favMoods));
  buildMoodDropdown();
  updateBgmFilterOptions();
}

function editCustomMood(oldMood) {
  const newMood = cleanLabel(prompt('새 이름 입력:', oldMood) || '');
  if (!newMood || newMood === oldMood) return;
  customMoods = customMoods.map(t => t === oldMood ? newMood : t);
  favMoods = favMoods.map(t => t === oldMood ? newMood : t);
  bgms.forEach(b => { if (b.mood === oldMood) b.mood = newMood; });
  localStorage.setItem('dontong_bgm_moods', JSON.stringify(customMoods));
  localStorage.setItem('dontong_bgm_favmoods', JSON.stringify(favMoods));
  localStorage.setItem('dontong_bgms', JSON.stringify(bgms));
  buildMoodDropdown();
  renderBgmTable(); updateBgmFilterOptions();
}

function updateBgmFilterOptions() {
  const allMoods = new Set();
  bgms.forEach(b => b.mood && allMoods.add(b.mood));
  customMoods.forEach(t => allMoods.add(t));
  DEFAULT_MOODS.forEach(t => allMoods.add(t));
  const sel = document.getElementById('bgm-filter');
  const cur = sel.value;
  sel.innerHTML = '<option value="">전체 분위기</option>' +
    [...allMoods].sort().map(t => `<option value="${esc(t)}"${t===cur?' selected':''}>${esc(t)}</option>`).join('');
}

// ===== API KEY =====
function getApiKey() { return localStorage.getItem('dontong_apikey') || ''; }
// API 응답이 실패일 때 사용자가 이해할 메시지로 변환
async function apiErrorMessage(res) {
  let reason = '';
  try {
    const j = await res.json();
    reason = (j.error && j.error.errors && j.error.errors[0] && j.error.errors[0].reason) || '';
  } catch(e) {}
  if (res.status === 403) {
    if (reason === 'quotaExceeded' || reason === 'dailyLimitExceeded') {
      return '오늘 API 할당량(하루 1만)을 모두 사용했어요. 내일 자정(태평양시)에 초기화돼요. 채널은 /channel/UC... 형식 주소로 넣으면 적게 소모됩니다.';
    }
    if (reason === 'keyInvalid' || reason === 'badRequest') {
      return 'API 키가 올바르지 않아요. 설정에서 키를 다시 확인해주세요.';
    }
    return 'API 접근이 거부됐어요(403). 키 설정 또는 할당량을 확인해주세요.';
  }
  if (res.status === 400) return 'API 키 형식이 잘못된 것 같아요. 설정에서 다시 확인해주세요.';
  return 'API 오류: ' + res.status;
}
function updateApiDot() {
  const hasKey = !!getApiKey();
  document.getElementById('apiDot').classList.toggle('active', hasKey);
  // 키 미등록일 때만 버튼 펄스 + 안내 배지 표시 (저장되면 자동으로 사라짐)
  const btn = document.querySelector('.btn-api-key');
  if (btn) btn.classList.toggle('needs-key', !hasKey);
  const badge = document.getElementById('apiKeyBadge');
  if (badge) badge.classList.toggle('show', !hasKey);
}
function openApiModal() {
  document.getElementById('apiModal').classList.add('open');
  document.getElementById('apiKeyInput').value = getApiKey();
  updateUsageUI();
}
function closeApiModal() { document.getElementById('apiModal').classList.remove('open'); }
function toggleApiKeyVisibility() {
  const inp = document.getElementById('apiKeyInput');
  inp.type = inp.type === 'password' ? 'text' : 'password';
}
function saveApiKey() {
  const key = document.getElementById('apiKeyInput').value.trim();
  if (!key) { toast('API 키를 입력해주세요', 'error'); return; }
  localStorage.setItem('dontong_apikey', key);
  updateApiDot();
  toast('API 키가 저장되었습니다', 'success');
  closeApiModal();
}
function deleteApiKey() {
  if (!confirm('API 키를 삭제하시겠습니까?')) return;
  localStorage.removeItem('dontong_apikey');
  document.getElementById('apiKeyInput').value = '';
  localStorage.setItem('dontong_usage', '0');
  updateApiDot();
  updateUsageUI();
  toast('API 키가 삭제되었습니다');
}
function toggleGuide() {
  const c = document.getElementById('guideContent');
  const a = document.getElementById('guideArrow');
  c.classList.toggle('open');
  a.classList.toggle('open');
}

// ===== USAGE TRACKING =====
function getUsage() { return parseInt(localStorage.getItem('dontong_usage') || '0'); }
function addUsage(units) {
  checkUsageReset();
  const cur = getUsage() + units;
  localStorage.setItem('dontong_usage', cur.toString());
  updateUsageUI();
}
function checkUsageReset() {
  const lastReset = localStorage.getItem('dontong_usage_reset');
  const now = new Date();
  // 가장 최근에 지나간 리셋 시각을 구함 (오늘 리셋시각 전이면 어제 것)
  let boundary = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), USAGE_RESET_HOUR));
  if (now < boundary) boundary = new Date(boundary.getTime() - 24*60*60*1000);
  const resetKey = boundary.toISOString().slice(0,13); // 날짜+시(UTC)까지 구분
  if (lastReset !== resetKey) {
    localStorage.setItem('dontong_usage', '0');
    localStorage.setItem('dontong_usage_reset', resetKey);
  }
}
function updateUsageUI() {
  const usage = getUsage();
  const pct = Math.min(usage / USAGE_LIMIT * 100, 100);
  const bar = document.getElementById('usageBarFill');
  bar.style.width = pct + '%';
  bar.classList.toggle('warn', pct > 80);
  document.getElementById('usageCurrent').textContent = usage.toLocaleString();
}

// ===== URL PARSING =====
function extractChannelIdentifier(rawUrl) {
  let url = rawUrl.trim();
  try { url = decodeURIComponent(url); } catch(e) {}
  // @handle
  let m = url.match(/@([\w가-힣.-]+)/);
  if (m) return { type: 'handle', value: '@' + m[1] };
  // /channel/UCxxxx
  m = url.match(/\/channel\/(UC[\w-]+)/);
  if (m) return { type: 'id', value: m[1] };
  // /c/name or /user/name
  m = url.match(/\/(c|user)\/([\w가-힣.-]+)/);
  if (m) return { type: 'custom', value: m[2] };
  // plain handle
  if (url.startsWith('@')) return { type: 'handle', value: url.split(/[\s\/]/)[0] };
  return null;
}

function extractVideoId(rawUrl) {
  let url = rawUrl.trim();
  try { url = decodeURIComponent(url); } catch(e) {}
  let m = url.match(/(?:v=|\/shorts\/|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}

// ===== FETCH CHANNEL =====
async function fetchChannel() {
  const key = getApiKey();
  if (!key) {
    toast('API 키를 먼저 설정해주세요', 'error');
    openApiModal();
    return;
  }
  const raw = document.getElementById('ch-url').value.trim();
  if (!raw) { toast('링크를 입력해주세요', 'error'); return; }

  const ident = extractChannelIdentifier(raw);
  if (!ident) { toast('올바른 채널 링크를 입력해주세요', 'error'); return; }

  try {
    let channelId = '';
    if (ident.type === 'id') {
      channelId = ident.value;
    } else if (ident.type === 'handle') {
      // @핸들이면 forHandle 정확조회 먼저 (1 unit, 정확함)
      const handle = ident.value.replace('@','');
      const handleUrl = `https://www.googleapis.com/youtube/v3/channels?part=id&forHandle=${encodeURIComponent(handle)}&key=${key}`;
      const resH = await fetch(handleUrl);
      if (!resH.ok) throw new Error(await apiErrorMessage(resH));
      const dataH = await resH.json();
      addUsage(1); // channels.list (forHandle) ≈ 1 unit
      if (dataH.items && dataH.items.length) {
        channelId = dataH.items[0].id;
      } else {
        // 정확조회 실패 시 검색으로 폴백 (search ≈ 100 unit)
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(handle)}&type=channel&maxResults=1&key=${key}`;
        const res = await fetch(searchUrl);
        if (!res.ok) throw new Error(await apiErrorMessage(res));
        const data = await res.json();
        addUsage(100); // search costs ~100 units
        if (!data.items || !data.items.length) { toast('채널을 찾을 수 없습니다', 'error'); return; }
        channelId = data.items[0].snippet.channelId;
      }
    } else {
      // /c/이름, /user/이름 등은 검색으로 (search ≈ 100 unit)
      const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(ident.value)}&type=channel&maxResults=1&key=${key}`;
      const res = await fetch(searchUrl);
      if (!res.ok) throw new Error(await apiErrorMessage(res));
      const data = await res.json();
      addUsage(100); // search costs ~100 units
      if (!data.items || !data.items.length) { toast('채널을 찾을 수 없습니다', 'error'); return; }
      channelId = data.items[0].snippet.channelId;
    }

    // Get channel details
    const detailUrl = `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${channelId}&key=${key}`;
    const res2 = await fetch(detailUrl);
    if (!res2.ok) throw new Error(await apiErrorMessage(res2));
    const data2 = await res2.json();
    addUsage(3); // channels.list ≈ 3 units

    if (!data2.items || !data2.items.length) { toast('채널 정보를 가져올 수 없습니다', 'error'); return; }

    const ch = data2.items[0];
    const s = ch.statistics;
    document.getElementById('ch-url').dataset.channelId = ch.id;
    document.getElementById('ch-url').dataset.name = ch.snippet.title;
    document.getElementById('ch-url').dataset.subs = s.subscriberCount || '0';
    document.getElementById('ch-url').dataset.videos = s.videoCount || '0';
    document.getElementById('ch-url').dataset.views = s.viewCount || '0';

    toast(`✅ ${ch.snippet.title} 채널 정보 불러옴`, 'success');
  } catch(e) {
    toast('오류: ' + e.message, 'error');
  }
}

// ===== SAVE CHANNEL =====
function saveChannel() {
  const urlEl = document.getElementById('ch-url');
  const name = urlEl.dataset.name;
  if (!name) { toast('먼저 채널을 불러와주세요', 'error'); return; }

  // 이미 담긴 채널이면 중복 저장 방지
  const newKey = channelDedupKey(urlEl.value.trim(), name);
  const newCid = urlEl.dataset.channelId || '';
  if ((newCid && channels.some(c => c.channelId === newCid)) ||
      channels.some(c => channelDedupKey(c.url, c.name) === newKey)) {
    toast('이미 저장된 채널입니다', 'error');
    return;
  }

  const item = {
    id: genId(),
    channelId: urlEl.dataset.channelId,
    name: name,
    url: urlEl.value.trim(),
    subs: parseInt(urlEl.dataset.subs) || 0,
    videos: parseInt(urlEl.dataset.videos) || 0,
    views: parseInt(urlEl.dataset.views) || 0,
    type: chSelectedType,
    reason: document.getElementById('ch-reason').value.trim(),
    ref: document.getElementById('ch-ref').value.trim(),
    style: document.getElementById('ch-style').value.trim(),
    date: new Date().toISOString()
  };

  channels.unshift(item);
  localStorage.setItem('dontong_channels', JSON.stringify(channels));
  clearChannelInputs();
  renderChannelTable();
  updateFilterOptions();
  toast('채널 저장 완료', 'success');
}

function clearChannelInputs() {
  const el = document.getElementById('ch-url');
  el.value = ''; delete el.dataset.channelId; delete el.dataset.name;
  delete el.dataset.subs; delete el.dataset.videos; delete el.dataset.views;
  document.getElementById('ch-reason').value = '';
  document.getElementById('ch-ref').value = '';
  document.getElementById('ch-style').value = '';
  chSelectedType = '';
  document.getElementById('ch-ct-label').textContent = '콘텐츠 유형 선택';
}

// ===== FETCH SOURCE =====
async function fetchSource() {
  const key = getApiKey();
  if (!key) {
    toast('API 키를 먼저 설정해주세요', 'error');
    openApiModal();
    return;
  }
  const raw = document.getElementById('src-url').value.trim();
  if (!raw) { toast('링크를 입력해주세요', 'error'); return; }

  const videoId = extractVideoId(raw);
  if (!videoId) { toast('올바른 영상 링크를 입력해주세요', 'error'); return; }

  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${key}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(await apiErrorMessage(res));
    const data = await res.json();
    addUsage(2);

    if (!data.items || !data.items.length) { toast('영상을 찾을 수 없습니다', 'error'); return; }

    const v = data.items[0];
    const el = document.getElementById('src-url');
    el.dataset.videoId = videoId;
    el.dataset.title = v.snippet.title;
    el.dataset.channel = v.snippet.channelTitle;
    el.dataset.date = v.snippet.publishedAt;
    el.dataset.views = v.statistics.viewCount || '0';

    toast(`✅ "${v.snippet.title}" 정보 불러옴`, 'success');
  } catch(e) {
    toast('오류: ' + e.message, 'error');
  }
}

// ===== SAVE SOURCE =====
function saveSource() {
  const urlEl = document.getElementById('src-url');
  const title = urlEl.dataset.title;
  if (!title) { toast('먼저 영상을 불러와주세요', 'error'); return; }

  const item = {
    id: genId(),
    videoId: urlEl.dataset.videoId,
    title: title,
    url: urlEl.value.trim(),
    channel: urlEl.dataset.channel,
    uploadDate: urlEl.dataset.date,
    views: parseInt(urlEl.dataset.views) || 0,
    type: srcSelectedType,
    reason: document.getElementById('src-reason').value.trim(),
    content: document.getElementById('src-content').value.trim(),
    style: document.getElementById('src-style').value.trim(),
    date: new Date().toISOString()
  };

  sources.unshift(item);
  localStorage.setItem('dontong_sources', JSON.stringify(sources));
  clearSourceInputs();
  renderSourceTable();
  updateFilterOptions();
  toast('소재 저장 완료', 'success');
}

function clearSourceInputs() {
  const el = document.getElementById('src-url');
  el.value = ''; delete el.dataset.videoId; delete el.dataset.title;
  delete el.dataset.channel; delete el.dataset.date; delete el.dataset.views;
  document.getElementById('src-reason').value = '';
  document.getElementById('src-content').value = '';
  document.getElementById('src-style').value = '';
  srcSelectedType = '';
  document.getElementById('src-ct-label').textContent = '콘텐츠 유형 선택';
}

// ===== NUMBER FORMAT =====
function fmtNum(n) {
  if (n >= 1e8) return (n/1e8).toFixed(1) + '억';
  if (n >= 1e4) return (n/1e4).toFixed(1) + '만';
  if (n >= 1e3) return (n/1e3).toFixed(1) + '천';
  return n.toLocaleString();
}
function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
}

// ===== 틱톡/인스타: 플랫폼 드롭다운 =====
// prefix: 'tch' (채널) | 'tsr' (소재)
function togglePlatformDropdown(prefix) {
  const panel = document.getElementById(prefix + '-pf-panel');
  const wasOpen = panel.classList.contains('open');
  document.querySelectorAll('.ct-dropdown-panel').forEach(p => p.classList.remove('open'));
  if (!wasOpen) { buildPlatformDropdown(prefix); panel.classList.add('open'); }
}
function buildPlatformDropdown(prefix) {
  const panel = document.getElementById(prefix + '-pf-panel');
  const cur = prefix === 'tch' ? tchSelectedPlatform : tsrSelectedPlatform;
  panel.innerHTML = PLATFORMS.map(p => {
    const sel = p === cur ? ' selected' : '';
    return `<div class="ct-option${sel}" onclick="selectPlatform('${prefix}','${p}')"><span>${p}</span></div>`;
  }).join('');
}
function selectPlatform(prefix, platform) {
  if (prefix === 'tch') tchSelectedPlatform = platform;
  else tsrSelectedPlatform = platform;
  document.getElementById(prefix + '-pf-label').textContent = platform;
  document.querySelectorAll('.ct-dropdown-panel').forEach(p => p.classList.remove('open'));
}

// ===== 틱톡/인스타 채널: 저장 =====
function saveTChannel() {
  const name = document.getElementById('tch-name').value.trim();
  const url = document.getElementById('tch-url').value.trim();
  if (!tchSelectedPlatform) { toast('플랫폼을 선택해주세요', 'error'); return; }
  if (!name) { toast('채널명을 입력해주세요', 'error'); return; }
  tchannels.push({
    id: genId(),
    platform: tchSelectedPlatform,
    name, url,
    reason: document.getElementById('tch-reason').value.trim(),
    style: document.getElementById('tch-style').value.trim(),
    fav: false,
    date: new Date().toISOString()
  });
  localStorage.setItem('dontong_tchannels', JSON.stringify(tchannels));
  renderTChannelTable();
  // 입력 초기화
  document.getElementById('tch-name').value = '';
  document.getElementById('tch-url').value = '';
  document.getElementById('tch-reason').value = '';
  document.getElementById('tch-style').value = '';
  tchSelectedPlatform = '';
  document.getElementById('tch-pf-label').textContent = '플랫폼 선택';
  toast('✅ 채널 저장됨', 'success');
}

// ===== 틱톡/인스타 소재: 저장 =====
function saveTSource() {
  const title = document.getElementById('tsr-title').value.trim();
  const url = document.getElementById('tsr-url').value.trim();
  if (!tsrSelectedPlatform) { toast('플랫폼을 선택해주세요', 'error'); return; }
  if (!title) { toast('제목/내용을 입력해주세요', 'error'); return; }
  tsources.push({
    id: genId(),
    platform: tsrSelectedPlatform,
    title, url,
    reason: document.getElementById('tsr-reason').value.trim(),
    style: document.getElementById('tsr-style').value.trim(),
    fav: false,
    date: new Date().toISOString()
  });
  localStorage.setItem('dontong_tsources', JSON.stringify(tsources));
  renderTSourceTable();
  document.getElementById('tsr-title').value = '';
  document.getElementById('tsr-url').value = '';
  document.getElementById('tsr-reason').value = '';
  document.getElementById('tsr-style').value = '';
  tsrSelectedPlatform = '';
  document.getElementById('tsr-pf-label').textContent = '플랫폼 선택';
  toast('✅ 소재 저장됨', 'success');
}

// ===== 틱톡/인스타 채널: 렌더 =====
function renderTChannelTable() {
  if (selectMode.tchannel) updateSelectBar('tchannel');
  const tbody = document.getElementById('tch-tbody');
  const nodata = document.getElementById('tch-nodata');
  const q = document.getElementById('tch-search').value.trim().toLowerCase();
  const pf = document.getElementById('tch-filter').value;
  let data = tchannels.slice();
  if (pf) data = data.filter(c => c.platform === pf);
  if (q) data = data.filter(c =>
    (c.name||'').toLowerCase().includes(q) ||
    (c.reason||'').toLowerCase().includes(q) ||
    (c.style||'').toLowerCase().includes(q));
  if (tchSort.key) {
    data.sort((a,b) => {
      let va = (a[tchSort.key]||'').toString().toLowerCase();
      let vb = (b[tchSort.key]||'').toString().toLowerCase();
      return tchSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }
  data.sort((a,b) => (b.fav?1:0) - (a.fav?1:0));
  document.getElementById('tch-count').textContent = `${data.length}개`;
  if (!data.length) { tbody.innerHTML = ''; nodata.style.display = 'block'; return; }
  nodata.style.display = 'none';
  tbody.innerHTML = data.map(c => `
    <tr>
      ${selCell('tchannel',c.id)}
      <td>${esc(c.platform)}</td>
      <td>${c.url ? `<a href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer">${esc(c.name)}</a>` : esc(c.name)}</td>
      <td>${c.url ? `<a href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer">🔗</a>` : '-'}</td>
      <td>${esc(c.reason||'-')}</td>
      <td>${esc(c.style||'-')}</td>
      <td class="cell-actions">
        <button class="fav-btn${c.fav?' fav-on':''}" onclick="toggleFavItem('tchannel',${c.id})" title="즐겨찾기">${c.fav?'⭐':'☆'}</button>
        <button onclick="editTItem('tchannel',${c.id})" title="수정">✏️</button>
        <button onclick="deleteItem('tchannel',${c.id})" title="삭제">🗑</button>
      </td>
    </tr>`).join('');
}

// ===== 틱톡/인스타 소재: 렌더 =====
function renderTSourceTable() {
  if (selectMode.tsource) updateSelectBar('tsource');
  const tbody = document.getElementById('tsr-tbody');
  const nodata = document.getElementById('tsr-nodata');
  const q = document.getElementById('tsr-search').value.trim().toLowerCase();
  const pf = document.getElementById('tsr-filter').value;
  let data = tsources.slice();
  if (pf) data = data.filter(s => s.platform === pf);
  if (q) data = data.filter(s =>
    (s.title||'').toLowerCase().includes(q) ||
    (s.reason||'').toLowerCase().includes(q) ||
    (s.style||'').toLowerCase().includes(q));
  if (tsrSort.key) {
    data.sort((a,b) => {
      let va = (a[tsrSort.key]||'').toString().toLowerCase();
      let vb = (b[tsrSort.key]||'').toString().toLowerCase();
      return tsrSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }
  data.sort((a,b) => (b.fav?1:0) - (a.fav?1:0));
  document.getElementById('tsr-count').textContent = `${data.length}개`;
  if (!data.length) { tbody.innerHTML = ''; nodata.style.display = 'block'; return; }
  nodata.style.display = 'none';
  tbody.innerHTML = data.map(s => `
    <tr>
      ${selCell('tsource',s.id)}
      <td>${esc(s.platform)}</td>
      <td>${s.url ? `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>` : esc(s.title)}</td>
      <td>${s.url ? `<a href="${esc(safeUrl(s.url))}" target="_blank" rel="noopener noreferrer">🔗</a>` : '-'}</td>
      <td>${esc(s.reason||'-')}</td>
      <td>${esc(s.style||'-')}</td>
      <td class="cell-actions">
        <button class="fav-btn${s.fav?' fav-on':''}" onclick="toggleFavItem('tsource',${s.id})" title="즐겨찾기">${s.fav?'⭐':'☆'}</button>
        <button onclick="editTItem('tsource',${s.id})" title="수정">✏️</button>
        <button onclick="deleteItem('tsource',${s.id})" title="삭제">🗑</button>
      </td>
    </tr>`).join('');
}

// ===== 틱톡/인스타: 정렬 =====
function sortTChannel(key) {
  if (tchSort.key === key) tchSort.asc = !tchSort.asc;
  else { tchSort.key = key; tchSort.asc = true; }
  document.querySelectorAll('#tch-table .sort-arrow').forEach(s => s.textContent = '');
  document.getElementById('tch-sort-' + key).textContent = tchSort.asc ? '▲' : '▼';
  renderTChannelTable();
}
function sortTSource(key) {
  if (tsrSort.key === key) tsrSort.asc = !tsrSort.asc;
  else { tsrSort.key = key; tsrSort.asc = true; }
  document.querySelectorAll('#tsr-table .sort-arrow').forEach(s => s.textContent = '');
  document.getElementById('tsr-sort-' + key).textContent = tsrSort.asc ? '▲' : '▼';
  renderTSourceTable();
}

// ===== 틱톡/인스타: 수정 (모달) =====
function editTItem(tab, id) {
  const list = tab === 'tchannel' ? tchannels : tsources;
  const item = list.find(x => x.id === id);
  if (!item) return;

  const pfOptions = PLATFORMS.map(p =>
    `<option value="${p}"${item.platform===p?' selected':''}>${p}</option>`).join('');

  document.getElementById('editModalTitle').textContent =
    tab === 'tchannel' ? '틱톡/인스타 채널 수정' : '틱톡/인스타 소재 수정';
  const body = document.getElementById('editModalBody');

  if (tab === 'tchannel') {
    body.innerHTML = `
      <select class="input-field" id="edit-tpf">${pfOptions}</select>
      <input class="input-field" id="edit-tname" value="${esc(item.name||'')}" placeholder="채널명">
      <input class="input-field" id="edit-turl" value="${esc(item.url||'')}" placeholder="링크">
      <input class="input-field" id="edit-treason" value="${esc(item.reason||'')}" placeholder="벤치마킹 이유">
      <input class="input-field" id="edit-tstyle" value="${esc(item.style||'')}" placeholder="스타일/특징">
    `;
    document.getElementById('editModalSave').onclick = () => {
      const name = document.getElementById('edit-tname').value.trim();
      if (!name) { toast('채널명을 입력해주세요', 'error'); return; }
      item.platform = document.getElementById('edit-tpf').value;
      item.name = name;
      item.url = document.getElementById('edit-turl').value.trim();
      item.reason = document.getElementById('edit-treason').value.trim();
      item.style = document.getElementById('edit-tstyle').value.trim();
      localStorage.setItem('dontong_tchannels', JSON.stringify(tchannels));
      renderTChannelTable(); closeEditModal();
      toast('수정 완료', 'success');
    };
  } else {
    body.innerHTML = `
      <select class="input-field" id="edit-tpf">${pfOptions}</select>
      <input class="input-field" id="edit-ttitle" value="${esc(item.title||'')}" placeholder="제목/내용 요약">
      <input class="input-field" id="edit-turl" value="${esc(item.url||'')}" placeholder="링크">
      <input class="input-field" id="edit-treason" value="${esc(item.reason||'')}" placeholder="스크랩 이유">
      <input class="input-field" id="edit-tstyle" value="${esc(item.style||'')}" placeholder="스타일/유형">
    `;
    document.getElementById('editModalSave').onclick = () => {
      const title = document.getElementById('edit-ttitle').value.trim();
      if (!title) { toast('제목/내용을 입력해주세요', 'error'); return; }
      item.platform = document.getElementById('edit-tpf').value;
      item.title = title;
      item.url = document.getElementById('edit-turl').value.trim();
      item.reason = document.getElementById('edit-treason').value.trim();
      item.style = document.getElementById('edit-tstyle').value.trim();
      localStorage.setItem('dontong_tsources', JSON.stringify(tsources));
      renderTSourceTable(); closeEditModal();
      toast('수정 완료', 'success');
    };
  }

  document.getElementById('editModal').classList.add('open');
}


// ===== RENDER CHANNEL TABLE =====
function renderChannelTable() {
  if (selectMode.channel) updateSelectBar('channel');
  const search = document.getElementById('ch-search').value.toLowerCase();
  const filter = document.getElementById('ch-filter').value;
  let data = channels.filter(c => {
    if (filter && c.type !== filter) return false;
    if (search) {
      return (c.name||'').toLowerCase().includes(search) ||
             (c.reason||'').toLowerCase().includes(search) ||
             (c.ref||'').toLowerCase().includes(search) ||
             (c.style||'').toLowerCase().includes(search) ||
             (c.type||'').toLowerCase().includes(search);
    }
    return true;
  });

  if (chSort.key) {
    data.sort((a,b) => {
      let va = a[chSort.key], vb = b[chSort.key];
      if (chSort.key === 'avgViews') {
        va = a.videos > 0 ? a.views / a.videos : 0;
        vb = b.videos > 0 ? b.views / b.videos : 0;
      }
      if (typeof va === 'number') return chSort.asc ? va-vb : vb-va;
      va = (va||'').toString().toLowerCase();
      vb = (vb||'').toString().toLowerCase();
      return chSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }
  // 즐겨찾기는 정렬과 무관하게 항상 맨 위로 고정
  data.sort((a,b) => (b.fav?1:0) - (a.fav?1:0));

  const tbody = document.getElementById('ch-tbody');
  const nodata = document.getElementById('ch-nodata');
  document.getElementById('ch-count').textContent = `${data.length}개`;

  if (!data.length) {
    tbody.innerHTML = '';
    nodata.style.display = '';
    return;
  }
  nodata.style.display = 'none';

  tbody.innerHTML = data.map(c => {
    const avgViews = c.videos > 0 ? Math.round(c.views / c.videos) : 0;
    return `
    <tr>
      ${selCell('channel',c.id)}
      <td>${c.url
        ? `<a href="${esc(safeUrl(c.url))}" target="_blank" rel="noopener noreferrer">${esc(c.name)}</a>`
        : (c.channelId
            ? `<a href="https://www.youtube.com/channel/${encodeURIComponent(c.channelId)}" target="_blank" rel="noopener noreferrer">${esc(c.name)}</a>`
            : esc(c.name))}</td>
      <td>${fmtNum(c.subs)}</td>
      <td>${fmtNum(c.videos)}</td>
      <td>${fmtNum(c.views)}</td>
      <td>${fmtNum(avgViews)}</td>
      <td>${esc(c.type||'-')}</td>
      <td>${esc(c.reason||'-')}</td>
      <td>${esc(c.ref||'-')}</td>
      <td>${esc(c.style||'-')}</td>
      <td class="cell-actions">
        <button class="fav-btn${c.fav?' fav-on':''}" onclick="toggleFavItem('channel',${c.id})" title="즐겨찾기">${c.fav?'⭐':'☆'}</button>
        <button onclick="editItem('channel',${c.id})" title="수정">✏️</button>
        <button onclick="deleteItem('channel',${c.id})" title="삭제">🗑️</button>
      </td>
    </tr>
  `}).join('');
}

// ===== RENDER SOURCE TABLE =====
function renderSourceTable() {
  if (selectMode.source) updateSelectBar('source');
  const search = document.getElementById('src-search').value.toLowerCase();
  const filter = document.getElementById('src-filter').value;
  let data = sources.filter(s => {
    if (filter && s.type !== filter) return false;
    if (search) {
      return (s.title||'').toLowerCase().includes(search) ||
             (s.channel||'').toLowerCase().includes(search) ||
             (s.reason||'').toLowerCase().includes(search) ||
             (s.content||'').toLowerCase().includes(search) ||
             (s.style||'').toLowerCase().includes(search) ||
             (s.type||'').toLowerCase().includes(search);
    }
    return true;
  });

  if (srcSort.key) {
    data.sort((a,b) => {
      let va = a[srcSort.key], vb = b[srcSort.key];
      if (srcSort.key === 'date') { va = a.uploadDate; vb = b.uploadDate; }
      if (typeof va === 'number') return srcSort.asc ? va-vb : vb-va;
      va = (va||'').toString().toLowerCase();
      vb = (vb||'').toString().toLowerCase();
      return srcSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
  }
  // 즐겨찾기는 정렬과 무관하게 항상 맨 위로 고정
  data.sort((a,b) => (b.fav?1:0) - (a.fav?1:0));

  const tbody = document.getElementById('src-tbody');
  const nodata = document.getElementById('src-nodata');
  document.getElementById('src-count').textContent = `${data.length}개`;

  if (!data.length) {
    tbody.innerHTML = '';
    nodata.style.display = '';
    return;
  }
  nodata.style.display = 'none';

  tbody.innerHTML = data.map(s => {
    const vid = s.videoId || extractYouTubeId(s.url);
    const thumbHtml = vid
      ? `<div class="src-thumb-wrap"
          onmouseenter="showSrcThumb(event, '${vid}')"
          onmousemove="moveSrcThumb(event)"
          onmouseleave="hideSrcThumb()">
          <img class="src-thumb" src="https://img.youtube.com/vi/${vid}/mqdefault.jpg" 
            onerror="this.style.display='none'" alt="">
        </div>`
      : '';
    const linkUrl = vid ? `https://www.youtube.com/shorts/${vid}` : safeUrl(s.url);
    return `
    <tr>
      ${selCell('source',s.id)}
      <td>
        <div class="src-title-cell">
          ${thumbHtml}
          <div class="src-title-text">
            <a href="${esc(linkUrl)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a>
          </div>
        </div>
      </td>
      <td>${esc(s.channel||'-')}</td>
      <td>${fmtDate(s.uploadDate)}</td>
      <td>${fmtNum(s.views)}</td>
      <td>${esc(s.type||'-')}</td>
      <td>${esc(s.reason||'-')}</td>
      <td>${esc(s.content||'-')}</td>
      <td>${esc(s.style||'-')}</td>
      <td class="cell-actions">
        <button class="fav-btn${s.fav?' fav-on':''}" onclick="toggleFavItem('source',${s.id})" title="즐겨찾기">${s.fav?'⭐':'☆'}</button>
        <button onclick="editItem('source',${s.id})" title="수정">✏️</button>
        <button onclick="deleteItem('source',${s.id})" title="삭제">🗑️</button>
      </td>
    </tr>
  `;
  }).join('');
}

// ===== 소재 썸네일 호버 팝업 =====
function showSrcThumb(e, vid) {
  const popup = document.getElementById('srcThumbPopup');
  popup.src = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
  popup.classList.add('open');
  moveSrcThumb(e);
}
function moveSrcThumb(e) {
  const popup = document.getElementById('srcThumbPopup');
  if (!popup.classList.contains('open')) return;
  const w = popup.offsetWidth || 320;
  const h = popup.offsetHeight || 240;
  let x = e.clientX + 20;
  let y = e.clientY + 20;
  // 화면 밖으로 안 나가게
  if (x + w > window.innerWidth) x = e.clientX - w - 20;
  if (y + h > window.innerHeight) y = window.innerHeight - h - 10;
  if (y < 10) y = 10;
  popup.style.left = x + 'px';
  popup.style.top = y + 'px';
}
function hideSrcThumb() {
  document.getElementById('srcThumbPopup').classList.remove('open');
}

// ===== SORTING =====
function sortChannel(key) {
  if (chSort.key === key) chSort.asc = !chSort.asc;
  else { chSort.key = key; chSort.asc = true; }
  updateSortArrows('ch', chSort);
  renderChannelTable();
}
function sortSource(key) {
  if (srcSort.key === key) srcSort.asc = !srcSort.asc;
  else { srcSort.key = key; srcSort.asc = true; }
  updateSortArrows('src', srcSort);
  renderSourceTable();
}
function sortBgm(key) {
  if (bgmSort.key === key) bgmSort.asc = !bgmSort.asc;
  else { bgmSort.key = key; bgmSort.asc = true; }
  updateSortArrows('bgm', bgmSort);
  renderBgmTable();
}
function updateSortArrows(prefix, sortState) {
  document.querySelectorAll(`[id^="${prefix}-sort-"]`).forEach(el => el.textContent = '');
  if (sortState.key) {
    const el = document.getElementById(`${prefix}-sort-${sortState.key}`);
    if (el) el.textContent = sortState.asc ? '▲' : '▼';
  }
}

// ===== DELETE / FAV =====
function deleteItem(tab, id) {
  if (!confirm('삭제하시겠습니까?')) return;
  if (tab === 'channel') {
    channels = channels.filter(c => c.id !== id);
    localStorage.setItem('dontong_channels', JSON.stringify(channels));
    renderChannelTable();
  } else if (tab === 'bgm') {
    bgms = bgms.filter(b => b.id !== id);
    localStorage.setItem('dontong_bgms', JSON.stringify(bgms));
    renderBgmTable();
    updateBgmFilterOptions();
  } else if (tab === 'tchannel') {
    tchannels = tchannels.filter(c => c.id !== id);
    localStorage.setItem('dontong_tchannels', JSON.stringify(tchannels));
    renderTChannelTable();
    toast('삭제 완료');
    return;
  } else if (tab === 'tsource') {
    tsources = tsources.filter(s => s.id !== id);
    localStorage.setItem('dontong_tsources', JSON.stringify(tsources));
    renderTSourceTable();
    toast('삭제 완료');
    return;
  } else {
    sources = sources.filter(s => s.id !== id);
    localStorage.setItem('dontong_sources', JSON.stringify(sources));
    renderSourceTable();
  }
  if (tab !== 'bgm') updateFilterOptions();
  toast('삭제 완료');
}

function deleteSelected(tab) {
  const sel = selectedIds[tab];
  const arr = selTabArray(tab);
  const n = arr.filter(x => sel.has(x.id)).length; // 실제 존재하는 선택분만
  if (n === 0) return;
  if (!confirm(`선택한 ${n}개를 삭제할까요?`)) return;

  let key, render;
  if (tab === 'channel') { channels = channels.filter(c => !sel.has(c.id)); key = 'dontong_channels'; render = renderChannelTable; }
  else if (tab === 'bgm') { bgms = bgms.filter(b => !sel.has(b.id)); key = 'dontong_bgms'; render = renderBgmTable; }
  else if (tab === 'tchannel') { tchannels = tchannels.filter(c => !sel.has(c.id)); key = 'dontong_tchannels'; render = renderTChannelTable; }
  else if (tab === 'tsource') { tsources = tsources.filter(s => !sel.has(s.id)); key = 'dontong_tsources'; render = renderTSourceTable; }
  else { sources = sources.filter(s => !sel.has(s.id)); key = 'dontong_sources'; render = renderSourceTable; }

  // 새 배열로 교체됐으므로 selTabArray(tab)가 가리키는 참조도 갱신 위해 localStorage 저장 후 렌더
  localStorage.setItem(key, JSON.stringify(
    { channel:channels, bgm:bgms, tchannel:tchannels, tsource:tsources, source:sources }[tab]
  ));
  sel.clear();
  render();
  if (tab === 'bgm') updateBgmFilterOptions();
  else updateFilterOptions();
  updateSelectBar(tab);
  toast(`🗑 ${n}개 삭제 완료`);
}

function toggleFavItem(tab, id) {
  let list, key;
  if (tab === 'channel') { list = channels; key = 'dontong_channels'; }
  else if (tab === 'bgm') { list = bgms; key = 'dontong_bgms'; }
  else if (tab === 'tchannel') { list = tchannels; key = 'dontong_tchannels'; }
  else if (tab === 'tsource') { list = tsources; key = 'dontong_tsources'; }
  else { list = sources; key = 'dontong_sources'; }
  const item = list.find(x => x.id === id);
  if (item) {
    item.fav = !item.fav;
    localStorage.setItem(key, JSON.stringify(list));
    if (tab === 'channel') renderChannelTable();
    else if (tab === 'bgm') renderBgmTable();
    else if (tab === 'tchannel') renderTChannelTable();
    else if (tab === 'tsource') renderTSourceTable();
    else renderSourceTable();
    toast(item.fav ? '⭐ 즐겨찾기 추가' : '즐겨찾기 해제');
  }
}

// ===== EDIT =====
function editItem(tab, id) {
  let list;
  if (tab === 'channel') list = channels;
  else if (tab === 'bgm') list = bgms;
  else list = sources;
  const item = list.find(x => x.id === id);
  if (!item) return;

  let titleText = '소재 수정';
  if (tab === 'channel') titleText = '채널 수정';
  else if (tab === 'bgm') titleText = 'BGM 수정';
  document.getElementById('editModalTitle').textContent = titleText;
  const body = document.getElementById('editModalBody');

  if (tab === 'channel') {
    body.innerHTML = `
      <input class="input-field" id="edit-type" value="${esc(item.type||'')}" placeholder="콘텐츠 유형">
      <input class="input-field" id="edit-reason" value="${esc(item.reason||'')}" placeholder="스크랩 이유">
      <input class="input-field" id="edit-ref" value="${esc(item.ref||'')}" placeholder="레퍼런스">
      <input class="input-field" id="edit-style" value="${esc(item.style||'')}" placeholder="결">
    `;
    document.getElementById('editModalSave').onclick = () => {
      item.type = cleanLabel(document.getElementById('edit-type').value);
      item.reason = document.getElementById('edit-reason').value.trim();
      item.ref = document.getElementById('edit-ref').value.trim();
      item.style = document.getElementById('edit-style').value.trim();
      localStorage.setItem('dontong_channels', JSON.stringify(channels));
      renderChannelTable(); updateFilterOptions(); closeEditModal();
      toast('수정 완료', 'success');
    };
  } else if (tab === 'bgm') {
    body.innerHTML = `
      <input class="input-field" id="edit-title" value="${esc(item.title||'')}" placeholder="곡명">
      <input class="input-field" id="edit-url" value="${esc(item.url||'')}" placeholder="링크">
      <input class="input-field" id="edit-mood" value="${esc(item.mood||'')}" placeholder="분위기">
      <textarea class="input-field" id="edit-memo" placeholder="메모">${esc(item.memo||'')}</textarea>
    `;
    document.getElementById('editModalSave').onclick = () => {
      item.title = document.getElementById('edit-title').value.trim();
      item.url = document.getElementById('edit-url').value.trim();
      const newMood = cleanLabel(document.getElementById('edit-mood').value);
      // 새 분위기면 customMoods에 추가
      if (newMood && !DEFAULT_MOODS.includes(newMood) && !customMoods.includes(newMood)) {
        customMoods.push(newMood);
        localStorage.setItem('dontong_bgm_moods', JSON.stringify(customMoods));
      }
      item.mood = newMood;
      item.memo = document.getElementById('edit-memo').value.trim();
      localStorage.setItem('dontong_bgms', JSON.stringify(bgms));
      renderBgmTable(); updateBgmFilterOptions(); closeEditModal();
      toast('수정 완료', 'success');
    };
  } else {
    body.innerHTML = `
      <input class="input-field" id="edit-type" value="${esc(item.type||'')}" placeholder="콘텐츠 유형">
      <input class="input-field" id="edit-reason" value="${esc(item.reason||'')}" placeholder="스크랩 이유">
      <textarea class="input-field" id="edit-content" placeholder="내용">${esc(item.content||'')}</textarea>
      <input class="input-field" id="edit-style" value="${esc(item.style||'')}" placeholder="결">
    `;
    document.getElementById('editModalSave').onclick = () => {
      item.type = cleanLabel(document.getElementById('edit-type').value);
      item.reason = document.getElementById('edit-reason').value.trim();
      item.content = document.getElementById('edit-content').value.trim();
      item.style = document.getElementById('edit-style').value.trim();
      localStorage.setItem('dontong_sources', JSON.stringify(sources));
      renderSourceTable(); updateFilterOptions(); closeEditModal();
      toast('수정 완료', 'success');
    };
  }

  document.getElementById('editModal').classList.add('open');
}
function closeEditModal() { document.getElementById('editModal').classList.remove('open'); }

// ===== CONTENT TYPE DROPDOWN =====
function toggleCtDropdown(prefix) {
  const panel = document.getElementById(prefix + '-ct-panel');
  const wasOpen = panel.classList.contains('open');
  document.querySelectorAll('.ct-dropdown-panel').forEach(p => p.classList.remove('open'));
  if (!wasOpen) {
    buildCtDropdown(prefix);
    panel.classList.add('open');
  }
}

function buildCtDropdown(prefix) {
  const panel = document.getElementById(prefix + '-ct-panel');
  const selected = prefix === 'ch' ? chSelectedType : srcSelectedType;

  let html = '';

  // Custom input
  html += `<div class="ct-custom-input">
    <input id="${prefix}-ct-custom-input" placeholder="직접 입력">
    <button onclick="addCustomType('${prefix}')">추가</button>
  </div>`;

  // Favorites
  if (favTypes.length) {
    html += `<div class="ct-section-label">⭐ 즐겨찾기</div>`;
    favTypes.forEach(t => {
      html += ctOptionHTML(prefix, t, selected, true);
    });
  }

  // Custom types
  const nonFavCustom = customTypes.filter(t => !favTypes.includes(t));
  if (nonFavCustom.length) {
    html += `<div class="ct-section-label">📝 직접 입력</div>`;
    nonFavCustom.forEach(t => {
      html += ctOptionHTML(prefix, t, selected, false, true);
    });
  }

  // YT categories
  html += `<div class="ct-section-label">📁 YouTube 카테고리</div>`;
  YT_CATEGORIES.forEach(t => {
    html += ctOptionHTML(prefix, t, selected, false, false);
  });

  panel.innerHTML = html;
}

function ctOptionHTML(prefix, text, selected, isFav, isCustom) {
  const sel = text === selected ? ' selected' : '';
  let actions = '';
  if (isCustom || isFav) {
    const favIcon = favTypes.includes(text) ? '★' : '☆';
    actions = `<span class="ct-option-actions">
      <button onclick="event.stopPropagation();toggleFavType('${prefix}','${esc(text)}')" title="즐겨찾기">${favIcon}</button>
      ${isCustom ? `<button onclick="event.stopPropagation();editCustomType('${prefix}','${esc(text)}')" title="수정">✏️</button>` : ''}
      ${isCustom || isFav ? `<button onclick="event.stopPropagation();deleteCustomType('${prefix}','${esc(text)}')" title="삭제">🗑</button>` : ''}
    </span>`;
  } else {
    const favIcon = favTypes.includes(text) ? '★' : '☆';
    actions = `<span class="ct-option-actions">
      <button onclick="event.stopPropagation();toggleFavType('${prefix}','${esc(text)}')" title="즐겨찾기">${favIcon}</button>
    </span>`;
  }
  return `<div class="ct-option${sel}" onclick="selectCtType('${prefix}','${esc(text)}')">
    <span>${esc(text)}</span>${actions}</div>`;
}

function selectCtType(prefix, type) {
  if (prefix === 'ch') { chSelectedType = type; document.getElementById('ch-ct-label').textContent = type; }
  else { srcSelectedType = type; document.getElementById('src-ct-label').textContent = type; }
  document.querySelectorAll('.ct-dropdown-panel').forEach(p => p.classList.remove('open'));
}

function addCustomType(prefix) {
  const input = document.getElementById(prefix + '-ct-custom-input');
  const val = cleanLabel(input.value);
  if (!val) return;
  if (!customTypes.includes(val) && !YT_CATEGORIES.includes(val)) {
    customTypes.push(val);
    localStorage.setItem('dontong_ctypes', JSON.stringify(customTypes));
  }
  selectCtType(prefix, val);
  updateFilterOptions();
}

function toggleFavType(prefix, type) {
  if (favTypes.includes(type)) favTypes = favTypes.filter(t => t !== type);
  else favTypes.push(type);
  localStorage.setItem('dontong_favtypes', JSON.stringify(favTypes));
  buildCtDropdown(prefix);
}

function deleteCustomType(prefix, type) {
  customTypes = customTypes.filter(t => t !== type);
  favTypes = favTypes.filter(t => t !== type);
  localStorage.setItem('dontong_ctypes', JSON.stringify(customTypes));
  localStorage.setItem('dontong_favtypes', JSON.stringify(favTypes));
  buildCtDropdown(prefix);
  updateFilterOptions();
}

function editCustomType(prefix, oldType) {
  const newType = cleanLabel(prompt('새 이름 입력:', oldType) || '');
  if (!newType || newType === oldType) return;
  customTypes = customTypes.map(t => t === oldType ? newType : t);
  favTypes = favTypes.map(t => t === oldType ? newType : t);
  // Update existing items
  channels.forEach(c => { if (c.type === oldType) c.type = newType; });
  sources.forEach(s => { if (s.type === oldType) s.type = newType; });
  localStorage.setItem('dontong_ctypes', JSON.stringify(customTypes));
  localStorage.setItem('dontong_favtypes', JSON.stringify(favTypes));
  localStorage.setItem('dontong_channels', JSON.stringify(channels));
  localStorage.setItem('dontong_sources', JSON.stringify(sources));
  buildCtDropdown(prefix);
  renderChannelTable(); renderSourceTable(); updateFilterOptions();
}

// Close dropdown on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.ct-dropdown-wrap')) {
    document.querySelectorAll('.ct-dropdown-panel').forEach(p => p.classList.remove('open'));
  }
});

// ===== FILTER OPTIONS =====
function updateFilterOptions() {
  const allTypes = new Set();
  channels.forEach(c => c.type && allTypes.add(c.type));
  sources.forEach(s => s.type && allTypes.add(s.type));
  customTypes.forEach(t => allTypes.add(t));
  YT_CATEGORIES.forEach(t => allTypes.add(t));

  ['ch-filter','src-filter'].forEach(id => {
    const sel = document.getElementById(id);
    const cur = sel.value;
    sel.innerHTML = '<option value="">전체 유형</option>' +
      [...allTypes].sort().map(t => `<option value="${esc(t)}"${t===cur?' selected':''}>${esc(t)}</option>`).join('');
  });
}

// ===== 탭별 초기화 (비상용) =====
function resetTab(tab) {
  let list, key, label, doClear;
  if (tab === 'channel') {
    list = channels; key = 'dontong_channels'; label = '채널';
    doClear = () => { channels = []; renderChannelTable(); updateFilterOptions(); };
  } else if (tab === 'bgm') {
    list = bgms; key = 'dontong_bgms'; label = 'BGM';
    doClear = () => { bgms = []; renderBgmTable(); updateBgmFilterOptions(); };
  } else if (tab === 'tchannel') {
    list = tchannels; key = 'dontong_tchannels'; label = '틱톡/인스타 채널';
    doClear = () => { tchannels = []; renderTChannelTable(); };
  } else if (tab === 'tsource') {
    list = tsources; key = 'dontong_tsources'; label = '틱톡/인스타 소재';
    doClear = () => { tsources = []; renderTSourceTable(); };
  } else {
    list = sources; key = 'dontong_sources'; label = '소재';
    doClear = () => { sources = []; renderSourceTable(); updateFilterOptions(); };
  }

  const cnt = list.length;
  if (cnt === 0) { toast(`${label} 데이터가 이미 비어있습니다`); return; }

  // 1차 확인 (백업 환기)
  if (!confirm(`⚠️ ${label} 데이터 ${cnt}개가 영구 삭제됩니다.\n\n먼저 [📥 전체 내보내기]로 백업하셨나요?\n삭제 후에는 되돌릴 수 없습니다.`)) return;

  // 2차 확인
  if (!confirm(`정말 ${label} ${cnt}개를 모두 삭제할까요?\n이번에 [확인]을 누르면 즉시 삭제됩니다.`)) return;

  doClear();
  localStorage.setItem(key, JSON.stringify([]));
  toast(`🧹 ${label} ${cnt}개 초기화 완료`, 'success');
}

// ===== 선택 내보내기 모드 =====
function selCell(tab, id) {
  const checked = selectedIds[tab].has(id) ? ' checked' : '';
  return `<td class="sel-col"><input type="checkbox"${checked} onclick="event.stopPropagation()" onchange="toggleSelect('${tab}',${id},this.checked)"></td>`;
}
function selTabArray(tab) {
  return { channel:channels, source:sources, bgm:bgms, tchannel:tchannels, tsource:tsources }[tab];
}
function selTableId(tab) {
  return { channel:'ch-table', source:'src-table', bgm:'bgm-table', tchannel:'tch-table', tsource:'tsr-table' }[tab];
}
function selBarId(tab) {
  return { channel:'ch-selbar', source:'src-selbar', bgm:'bgm-selbar', tchannel:'tch-selbar', tsource:'tsr-selbar' }[tab];
}
function selRender(tab) {
  ({ channel:renderChannelTable, source:renderSourceTable, bgm:renderBgmTable,
     tchannel:renderTChannelTable, tsource:renderTSourceTable })[tab]();
}
function toggleSelectMode(tab) {
  selectMode[tab] = !selectMode[tab];
  const table = document.getElementById(selTableId(tab));
  const bar = document.getElementById(selBarId(tab));
  if (selectMode[tab]) {
    table.classList.add('selmode');
    bar.classList.add('open');
  } else {
    table.classList.remove('selmode');
    bar.classList.remove('open');
    selectedIds[tab].clear(); // 모드 종료 시 선택 초기화
  }
  selRender(tab);
  updateSelectBar(tab);
}
function toggleSelect(tab, id, checked) {
  if (checked) selectedIds[tab].add(id);
  else selectedIds[tab].delete(id);
  updateSelectBar(tab);
}
function selectAllInTab(tab) {
  selTabArray(tab).forEach(x => selectedIds[tab].add(x.id));
  selRender(tab);
  updateSelectBar(tab);
}
function clearAllInTab(tab) {
  selectedIds[tab].clear();
  selRender(tab);
  updateSelectBar(tab);
}
function updateSelectBar(tab) {
  const bar = document.getElementById(selBarId(tab));
  if (!bar) return;
  const arr = selTabArray(tab);
  const sel = selectedIds[tab];
  const n = arr.filter(x => sel.has(x.id)).length; // 실제 존재하는 선택 항목만
  const countEl = bar.querySelector('.sel-count');
  const btn = bar.querySelector('.sel-export-btn');
  if (countEl) countEl.textContent = `선택 ${n} / 전체 ${arr.length}개`;
  if (btn) {
    btn.textContent = `📥 선택 ${n}개 내보내기`;
    btn.disabled = (n === 0);
  }
  const delBtn = bar.querySelector('.sel-delete-btn');
  if (delBtn) {
    delBtn.textContent = `🗑 선택 ${n}개 삭제`;
    delBtn.disabled = (n === 0);
  }
}

// ===== CSV DOWNLOAD =====
// 내보내기 누르면 먼저 '파일 열지 마세요' 경고 팝업을 띄우고,
// 확인을 눌러야 실제 다운로드(runDownloadCSV)가 진행된다.
let _pendingExport = null;
function downloadCSV(tab, selectedOnly) {
  // 선택 내보내기인데 아무것도 선택 안 했으면 경고 띄우기 전에 먼저 차단
  if (selectedOnly) {
    const sel = selectedIds[tab];
    const picked = selTabArray(tab).filter(x => sel.has(x.id));
    if (!picked.length) { alert('선택된 항목이 없습니다.\n내보낼 항목을 체크해 주세요.'); return; }
  }
  _pendingExport = { tab, selectedOnly };
  document.getElementById('exportWarnModal').classList.add('open');
}
function closeExportWarning() {
  document.getElementById('exportWarnModal').classList.remove('open');
  _pendingExport = null;
}
function proceedExport() {
  document.getElementById('exportWarnModal').classList.remove('open');
  if (!_pendingExport) return;
  const { tab, selectedOnly } = _pendingExport;
  _pendingExport = null;
  runDownloadCSV(tab, selectedOnly);
}

function runDownloadCSV(tab, selectedOnly) {
  const exporter = askExporterName();
  if (exporter === null) return; // 사용자가 취소하면 내보내기 중단

  // 내보낼 대상 추리기 (선택 내보내기면 체크된 것만)
  let chList = channels, srcList = sources, bgmList = bgms, tchList = tchannels, tsrList = tsources;
  if (selectedOnly) {
    const sel = selectedIds[tab];
    const base = selTabArray(tab);
    const picked = base.filter(x => sel.has(x.id));
    if (!picked.length) {
      alert('선택된 항목이 없습니다.\n내보낼 항목을 체크해 주세요.');
      return;
    }
    chList = (tab === 'channel') ? picked : [];
    srcList = (tab === 'source') ? picked : [];
    bgmList = (tab === 'bgm') ? picked : [];
    tchList = (tab === 'tchannel') ? picked : [];
    tsrList = (tab === 'tsource') ? picked : [];
  }

  let csv = '';
  if (tab === 'channel') {
    csv = '채널명,구독자,영상수,조회수,평균조회수,유형,스크랩이유,레퍼런스,결,링크\n';
    chList.forEach(c => {
      const avg = c.videos > 0 ? Math.round(c.views / c.videos) : 0;
      // 링크는 채널ID 표준형(/channel/UC...)으로 내보낸다.
      // 핸들·인코딩·시점이 달라도 같은 채널이면 staff 취합 시 자동 병합됨.
      // (채널ID가 없는 옛 데이터만 원본 링크로 폴백)
      const linkOut = c.channelId ? ('https://www.youtube.com/channel/' + c.channelId) : c.url;
      csv += [c.name,c.subs,c.videos,c.views,avg,c.type,c.reason,c.ref,c.style,linkOut]
        .map(csvCell).join(',') + '\n';
    });
  } else if (tab === 'bgm') {
    csv = '곡명,분위기,메모,링크\n';
    bgmList.forEach(b => {
      csv += [b.title,b.mood,b.memo,b.url]
        .map(csvCell).join(',') + '\n';
    });
  } else if (tab === 'source') {
    csv = '제목,채널,업로드일,조회수,유형,스크랩이유,내용,결,링크\n';
    srcList.forEach(s => {
      csv += [s.title,s.channel,fmtDate(s.uploadDate),s.views,s.type,s.reason,s.content,s.style,s.url]
        .map(csvCell).join(',') + '\n';
    });
  } else if (tab === 'tchannel') {
    csv = '플랫폼,채널명,링크,벤치마킹이유,스타일특징\n';
    tchList.forEach(c => {
      csv += [c.platform,c.name,c.url,c.reason,c.style]
        .map(csvCell).join(',') + '\n';
    });
  } else if (tab === 'tsource') {
    csv = '플랫폼,제목내용,링크,스크랩이유,스타일유형\n';
    tsrList.forEach(s => {
      csv += [s.platform,s.title,s.url,s.reason,s.style]
        .map(csvCell).join(',') + '\n';
    });
  }
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  let label = '소재';
  if (tab === 'channel') label = '채널';
  else if (tab === 'bgm') label = 'BGM';
  else if (tab === 'tchannel') label = '틱톡인스타채널';
  else if (tab === 'tsource') label = '틱톡인스타소재';
  const today = new Date().toISOString().slice(0,10);
  const cleanName = safeFileName(exporter);
  a.download = cleanName
    ? `에셋_${label}_${cleanName}_${today}.csv`
    : `에셋_${label}_${today}.csv`;
  a.click();
}

// ===== CSV IMPORT =====
function importCSV(tab, inputEl) {
  const file = inputEl.files[0];
  if (!file) return;
  inputEl.value = ''; // reset for re-upload

  const reader = new FileReader();
  reader.onload = function(e) {
    const text = decodeCsvBuffer(e.target.result).replace(/^\uFEFF/, ''); // 인코딩 자동감지 + BOM 제거
    const rows = parseCSVRows(text);
    if (rows.length < 2) { toast('CSV에 데이터가 없습니다', 'error'); return; }

    const header = rows[0];
    let added = 0, skipped = 0;

    // === CSV 형식이 현재 탭과 맞는지 검사 (탭 잘못 선택 방지) ===
    const headerStr = header.join(',');
    const REQUIRED = {
      channel:  ['채널명','구독자','영상수','조회수'],
      source:   ['제목','채널','업로드일','조회수'],
      bgm:      ['곡명','분위기','메모','링크'],
      tchannel: ['플랫폼','채널명','링크'],
      tsource:  ['플랫폼','제목내용','링크']
    };
    const need = REQUIRED[tab] || [];
    const ok = need.every(k => headerStr.includes(k));
    if (!ok) {
      toast('현재 탭과 CSV 형식이 맞지 않습니다. 올바른 탭에서 가져와주세요.', 'error');
      return;
    }

    if (tab === 'channel') {
      // 신버전 헤더(10칸, 평균조회수 포함) / 구버전(9칸) 모두 호환
      const hasAvg = header.length >= 10;
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length < (hasAvg ? 10 : 9)) continue;
        let name,subs,videos,views,type,reason,ref,style,url;
        if (hasAvg) {
          // 평균조회수 칸은 영상수/조회수로 재계산하므로 받아서 버림
          [name,subs,videos,views,,type,reason,ref,style,url] = r;
        } else {
          [name,subs,videos,views,type,reason,ref,style,url] = r;
        }
        // 중복 체크: 링크(정규화) 우선, 링크 없으면 채널명으로 판정
        const key = channelDedupKey(url, name);
        if (channels.some(c => channelDedupKey(c.url, c.name) === key)) { skipped++; continue; }
        channels.push({
          id: genId(),
          channelId: (String(url).match(/\/channel\/(UC[0-9A-Za-z_-]+)/) || [])[1] || '', name, url,
          subs: toIntCSV(subs), videos: toIntCSV(videos), views: toIntCSV(views),
          type, reason, ref, style,
          fav: false,
          date: new Date().toISOString()
        });
        added++;
      }
      localStorage.setItem('dontong_channels', JSON.stringify(channels));
      renderChannelTable();
    } else if (tab === 'bgm') {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length < 4) continue;
        let [title,mood,memo,url] = r;
        mood = cleanLabel(mood);
        url = (url || '').trim();
        if (!url) { skipped++; continue; }   // 링크 없으면 건너뜀
        // 중복 체크: 링크(유튜브 ID) 기준
        const isDup = bgms.some(b => bgmDedupMatch(b, {title, mood, url}));
        if (isDup) { skipped++; continue; }
        // 새 분위기면 customMoods에 추가
        if (mood && !DEFAULT_MOODS.includes(mood) && !customMoods.includes(mood)) {
          customMoods.push(mood);
        }
        bgms.push({
          id: genId(),
          title, mood, memo, url,
          fav: false,
          date: new Date().toISOString()
        });
        added++;
      }
      localStorage.setItem('dontong_bgms', JSON.stringify(bgms));
      localStorage.setItem('dontong_bgm_moods', JSON.stringify(customMoods));
      renderBgmTable();
      updateBgmFilterOptions();
    } else if (tab === 'source') {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length < 9) continue;
        const [title,channel,uploadDate,views,type,reason,content,style,url] = r;
        // 중복 체크: 같은 제목+채널이면 건너뛰기
        if (sources.some(s => s.title === title && s.channel === channel)) { skipped++; continue; }
        sources.push({
          id: genId(),
          videoId: '', title, url, channel,
          uploadDate: uploadDate || '',
          views: toIntCSV(views),
          type, reason, content, style,
          fav: false,
          date: new Date().toISOString()
        });
        added++;
      }
      localStorage.setItem('dontong_sources', JSON.stringify(sources));
      renderSourceTable();
      updateFilterOptions();
    } else if (tab === 'tchannel') {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length < 5) continue;
        const [platform,name,url,reason,style] = r;
        if (tchannels.some(c => c.name === name && c.platform === platform)) { skipped++; continue; }
        tchannels.push({
          id: genId(),
          platform: platform || '틱톡',
          name, url, reason, style,
          fav: false,
          date: new Date().toISOString()
        });
        added++;
      }
      localStorage.setItem('dontong_tchannels', JSON.stringify(tchannels));
      renderTChannelTable();
    } else if (tab === 'tsource') {
      for (let i = 1; i < rows.length; i++) {
        const r = rows[i];
        if (r.length < 5) continue;
        const [platform,title,url,reason,style] = r;
        if (tsources.some(s => s.title === title && s.platform === platform)) { skipped++; continue; }
        tsources.push({
          id: genId(),
          platform: platform || '틱톡',
          title, url, reason, style,
          fav: false,
          date: new Date().toISOString()
        });
        added++;
      }
      localStorage.setItem('dontong_tsources', JSON.stringify(tsources));
      renderTSourceTable();
    }
    if (tab === 'channel' || tab === 'source') updateFilterOptions();
    toast(`✅ ${added}개 추가, ${skipped}개 중복 건너뜀`, 'success');
  };
  reader.readAsArrayBuffer(file);
}

// CSV 인코딩 자동 감지: UTF-8로 먼저 읽고, 한글이 깨지면(치환문자  ) 한국 윈도우
// 기본 인코딩(CP949/EUC-KR)으로 재디코딩. 탭 종류에 무관하게 동작.
function decodeCsvBuffer(buf) {
  const bytes = new Uint8Array(buf);
  let utf8 = '';
  try { utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes); } catch (e) {}
  // UTF-8로 읽어 깨진 문자(U+FFFD)가 없으면 정상 UTF-8
  if (utf8 && utf8.indexOf('\uFFFD') === -1) return utf8;
  // 깨졌으면 CP949/EUC-KR로 재시도해서 깨짐이 더 적은 쪽 채택
  try {
    const euc = new TextDecoder('euc-kr', { fatal: false }).decode(bytes);
    const uBad = (utf8.match(/\uFFFD/g) || []).length;
    const eBad = (euc.match(/\uFFFD/g) || []).length;
    if (eBad <= uBad) return euc;
  } catch (e) {}
  return utf8;
}

// CSV 파싱 (따옴표 안의 쉼표 처리)
function parseCSVRows(text) {
  const rows = [];
  let row = []; let cell = ''; let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i+1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuote = false; }
      else { cell += c; }
    } else {
      if (c === '"') { inQuote = true; }
      else if (c === ',') { row.push(cell.trim()); cell = ''; }
      else if (c === '\n' || (c === '\r' && text[i+1] === '\n')) {
        row.push(cell.trim()); rows.push(row); row = []; cell = '';
        if (c === '\r') i++;
      }
      else { cell += c; }
    }
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

// ===== 고유 ID 생성 (밀리초 충돌 방지) =====
let _idCounter = 0;
function genId() {
  _idCounter = (_idCounter + 1) % 1000;
  return Date.now() * 1000 + _idCounter;
}

// ===== CSV 내보내기용 제출자 이름 =====
// 한 번 입력하면 저장해두고, 다음부터는 기본값으로 제시(수정 가능)
function askExporterName() {
  const saved = localStorage.getItem('dontong_exporter') || '';
  const input = prompt('내보내기 파일에 넣을 이름을 입력하세요.\n예) 윤@웅(마라하기)', saved);
  if (input === null) return null; // 취소
  const name = input.trim();
  localStorage.setItem('dontong_exporter', name);
  return name;
}
// 파일명에 못 쓰는 문자 제거(윈도우/맥 공통 금지문자)
function safeFileName(s) {
  return (s || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
}

// ===== 채널 중복 판정용 정규화 키 =====
// 링크에서 채널을 가리키는 고유 조각을 뽑아 통일한다.
// 우선순위: 채널ID(UC...) > 핸들(@name) > (링크 없으면) 채널명
/* CSV 숫자 파싱: 쉼표·공백 등 숫자 아닌 문자 제거 후 정수화.
   돈통 자체 내보내기는 쉼표 없지만, 구글시트·엑셀로 만든 파일은 "7,800" 형식이라 그대로 두면 7로 깨짐 */
function toIntCSV(v){ return parseInt(String(v==null?'':v).replace(/[^\d]/g,''),10)||0; }

function channelDedupKey(url, name) {
  const u = (url || '').trim().toLowerCase();
  if (u) {
    // 1) /channel/UCxxxx 형식 → 채널 ID 추출
    const idMatch = u.match(/\/channel\/(uc[0-9a-z_-]+)/i);
    if (idMatch) return 'id:' + idMatch[1];
    // 2) @핸들 형식 → 핸들 추출 (뒤의 /shorts, /videos 등 꼬리 자동 제거)
    const handleMatch = u.match(/@([^/?#\s]+)/);
    if (handleMatch) return 'handle:' + handleMatch[1];
    // 3) 그 외 링크는 쿼리스트링/끝슬래시만 정리해서 통째로 비교
    let cleaned = u.split('?')[0].split('#')[0].replace(/\/(shorts|videos|featured|about|streams|playlists)\/?$/,'').replace(/\/+$/,'');
    if (cleaned) return 'url:' + cleaned;
  }
  // 4) 링크가 없으면 채널명으로 (옛날·수동 입력 대비)
  return 'name:' + (name || '').trim().toLowerCase();
}

// ===== ESCAPE HTML =====
function esc(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ===== 라벨 안전화 (XSS 방지) =====
// 콘텐츠 유형·BGM 분위기처럼 사용자가 만든 "이름"은 드롭다운 onclick 속성에
// 그대로 들어가므로 ' " < > 가 있으면 코드가 깨지거나 실행될 수 있다.
// 이 4개 문자만 제거하고, 이모지·한글·다른 기호(· ~ ! ? # 등)는 그대로 통과.
function cleanLabel(s) {
  return (s || '').toString().replace(/['"<>]/g, '').trim();
}

// ===== URL 안전화 (위험 스킴 차단) =====
// http/https 절대주소만 통과, javascript: 등은 '#' 으로 막음
function safeUrl(url) {
  url = (url || '').trim();
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return url;
  } catch(e) {}
  return '#';
}

// ===== CSV 셀 안전 처리 =====
// 따옴표 이스케이프 + 엑셀 수식 인젝션 방지(=,+,-,@로 시작하면 앞에 ' 붙임)
function csvCell(v) {
  v = (v || '').toString();
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  return `"${v.replace(/"/g, '""')}"`;
}

// ===== BGM 중복 판정 =====
// 링크가 양쪽 다 있으면 링크(유튜브 ID 우선) 기준, 아니면 곡명+분위기(공백/대소문자 무시)
function bgmDedupMatch(a, b) {
  const aUrl = (a.url || '').trim();
  const bUrl = (b.url || '').trim();
  if (!aUrl || !bUrl) return false;                // 링크 없으면 중복 판정 안 함
  const aId = extractYouTubeId(aUrl);
  const bId = extractYouTubeId(bUrl);
  if (aId && bId) return aId === bId;              // 같은 유튜브 영상이면 중복
  return aUrl.toLowerCase() === bUrl.toLowerCase(); // 유튜브 아니면 링크 문자열 비교
}

// ===== 전체 데이터 백업 / 복원 =====
// 모든 dontong_* localStorage 를 하나의 JSON 파일로 내보내고, 검증 후 통째로 교체 복원한다.
const BACKUP_APP_ID = 'marihwana-clone';
const BACKUP_SCHEMA_VERSION = 1;
const BACKUP_KEYS = [
  'dontong_channels', 'dontong_sources', 'dontong_bgms',
  'dontong_tchannels', 'dontong_tsources',
  'dontong_ctypes', 'dontong_favtypes',
  'dontong_bgm_moods', 'dontong_bgm_favmoods',
  'dontong_apikey', 'dontong_usage', 'dontong_usage_reset', 'dontong_exporter'
];

function openBackupModal() { document.getElementById('backupModal').classList.add('open'); }
function closeBackupModal() { document.getElementById('backupModal').classList.remove('open'); }

// 백업 파일 이름용 타임스탬프: YYYYMMDD-HHmm
function backupStamp(d) {
  d = d || new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

// 현재 localStorage 스냅샷을 백업 래퍼 객체로 수집 (없는 키는 생략)
function collectBackup() {
  const data = {};
  BACKUP_KEYS.forEach(k => {
    const v = localStorage.getItem(k);
    if (v !== null) data[k] = v;   // 원본 문자열 그대로 보존 (JSON 배열/숫자/문자 모두)
  });
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data
  };
}

// Blob 다운로드
function downloadBlob(text, filename, mime) {
  const blob = new Blob([text], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// 전체 백업 파일 다운로드
function exportAllData() {
  try {
    const wrapper = collectBackup();
    const json = JSON.stringify(wrapper, null, 2);
    downloadBlob(json, `marihwana-backup-${backupStamp()}.json`, 'application/json');
    const n = Object.keys(wrapper.data).length;
    toast(`전체 백업 완료 (${n}개 항목)`, 'success');
  } catch (e) {
    toast('백업 실패: ' + (e && e.message ? e.message : e), 'error');
  }
}

// 백업 파일 복원: 검증 → 현재 상태 자동 백업 → 통째로 교체 → 재적용
function importAllData(inputEl) {
  const file = inputEl.files && inputEl.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    let parsed;
    try {
      parsed = JSON.parse(e.target.result);
    } catch (err) {
      toast('복원 실패: JSON 형식이 아닙니다', 'error');
      inputEl.value = '';
      return;
    }
    // 구조 검증 — 다른 앱/손상 파일 거부
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      toast('복원 실패: 올바른 백업 파일이 아닙니다', 'error');
      inputEl.value = '';
      return;
    }
    if (parsed.app !== BACKUP_APP_ID) {
      toast('복원 실패: 이 앱의 백업 파일이 아닙니다', 'error');
      inputEl.value = '';
      return;
    }
    if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion > BACKUP_SCHEMA_VERSION) {
      toast('복원 실패: 지원하지 않는 백업 버전입니다', 'error');
      inputEl.value = '';
      return;
    }
    if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
      toast('복원 실패: 데이터가 비어 있거나 손상되었습니다', 'error');
      inputEl.value = '';
      return;
    }
    // 백업 파일에 포함된 키가 우리가 아는 키들 안에 있는지(하나라도) 확인
    const incoming = Object.keys(parsed.data);
    const known = incoming.filter(k => BACKUP_KEYS.includes(k));
    if (known.length === 0) {
      toast('복원 실패: 인식할 수 있는 데이터가 없습니다', 'error');
      inputEl.value = '';
      return;
    }
    const cnt = BACKUP_KEYS.reduce((acc, k) => acc + (k in parsed.data ? 1 : 0), 0);
    if (!confirm(`백업 파일의 데이터 ${cnt}개 항목으로 현재 데이터를 완전히 교체합니다.\n현재 데이터는 복원 직전 자동으로 파일로 내려받습니다.\n계속하시겠습니까?`)) {
      inputEl.value = '';
      return;
    }
    // 1) 현재 상태 자동 백업 (롤백 안전장치)
    try {
      const safety = collectBackup();
      downloadBlob(JSON.stringify(safety, null, 2), `marihwana-autobackup-${backupStamp()}.json`, 'application/json');
    } catch (err) { /* 자동 백업 실패해도 복원은 진행 */ }
    // 2) 교체: 기존 dontong_* 키 제거 후 백업 값 기록
    try {
      BACKUP_KEYS.forEach(k => localStorage.removeItem(k));
      known.forEach(k => localStorage.setItem(k, parsed.data[k]));
    } catch (err) {
      toast('복원 실패: 저장 용량 초과 또는 쓰기 오류', 'error');
      inputEl.value = '';
      return;
    }
    // 3) 재적용 — 전체 리로드가 모든 상태 변수를 재초기화하는 가장 안전한 방법
    toast('복원 완료. 페이지를 새로 고칩니다…', 'success');
    inputEl.value = '';
    setTimeout(() => location.reload(), 800);
  };
  reader.onerror = () => {
    toast('복원 실패: 파일을 읽을 수 없습니다', 'error');
    inputEl.value = '';
  };
  reader.readAsText(file);
}

// ===== Close modals on overlay click =====
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});
