/**
 * app.js 의 순수함수들을 Node.js 환경에서 재현한 헬퍼
 * DOM/localStorage 가 없어도 단위 테스트 가능하도록 추출.
 */

// ===== localStorage mock =====
class LocalStorageMock {
  constructor() { this._store = {}; }
  getItem(k) { return Object.prototype.hasOwnProperty.call(this._store, k) ? this._store[k] : null; }
  setItem(k, v) { this._store[k] = String(v); }
  removeItem(k) { delete this._store[k]; }
  clear() { this._store = {}; }
  keys() { return Object.keys(this._store); }
}

// ===== 앱 순수함수 사본 =====

function esc(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanLabel(s) {
  return (s || '').toString().replace(/['"<>]/g, '').trim();
}

function safeUrl(url) {
  url = (url || '').trim();
  if (!url) return '#';
  try {
    const u = new URL(url);
    if (u.protocol === 'http:' || u.protocol === 'https:') return url;
    return '#';
  } catch(e) {}
  try {
    const u2 = new URL('https://' + url);
    if (u2.hostname.includes('.')) return 'https://' + url;
  } catch(e) {}
  return '#';
}

function extLink(rawUrl, innerHtml, attrs) {
  const u = safeUrl(rawUrl);
  const extra = attrs ? ' ' + attrs : '';
  if (u === '#') return `<span${extra}>${innerHtml}</span>`;
  return `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer"${extra}>${innerHtml}</a>`;
}

function csvCell(v) {
  v = (v || '').toString();
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  return `"${v.replace(/"/g, '""')}"`;
}

function safeFileName(s) {
  return (s || '').replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
}

function channelDedupKey(url, name) {
  const u = (url || '').trim().toLowerCase();
  if (u) {
    const idMatch = u.match(/\/channel\/(uc[0-9a-z_-]+)/i);
    if (idMatch) return 'id:' + idMatch[1];
    const handleMatch = u.match(/@([^/?#\s]+)/);
    if (handleMatch) return 'handle:' + handleMatch[1];
    let cleaned = u.split('?')[0].split('#')[0]
      .replace(/\/(shorts|videos|featured|about|streams|playlists)\/?$/, '')
      .replace(/\/+$/, '');
    if (cleaned) return 'url:' + cleaned;
  }
  return 'name:' + (name || '').trim().toLowerCase();
}

function extractYouTubeId(url) {
  if (!url) return '';
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return '';
}

function bgmDedupMatch(a, b) {
  const aUrl = (a.url || '').trim();
  const bUrl = (b.url || '').trim();
  if (!aUrl || !bUrl) return false;
  const aId = extractYouTubeId(aUrl);
  const bId = extractYouTubeId(bUrl);
  if (aId && bId) return aId === bId;
  return aUrl.toLowerCase() === bUrl.toLowerCase();
}

function toIntCSV(v) { return parseInt(String(v == null ? '' : v).replace(/[^\d]/g, ''), 10) || 0; }

function parseCSVRows(text) {
  const rows = [];
  let row = []; let cell = ''; let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuote) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { inQuote = false; }
      else { cell += c; }
    } else {
      if (c === '"') { inQuote = true; }
      else if (c === ',') { row.push(cell.trim()); cell = ''; }
      else if (c === '\n' || (c === '\r' && text[i + 1] === '\n')) {
        row.push(cell.trim()); rows.push(row); row = []; cell = '';
        if (c === '\r') i++;
      } else { cell += c; }
    }
  }
  if (cell || row.length) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

function fmtNum(n) {
  if (n >= 1e8) return (n / 1e8).toFixed(1) + '억';
  if (n >= 1e4) return (n / 1e4).toFixed(1) + '만';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + '천';
  return n.toLocaleString();
}

function fmtDate(iso) {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

// ===== 백업/복원 로직 (순수함수 추출) =====
const BACKUP_APP_ID = 'marihwana-clone';
const BACKUP_SCHEMA_VERSION = 1;
const BACKUP_KEYS = [
  'dontong_channels', 'dontong_sources', 'dontong_bgms',
  'dontong_tchannels', 'dontong_tsources',
  'dontong_ctypes', 'dontong_favtypes',
  'dontong_bgm_moods', 'dontong_bgm_favmoods',
  'dontong_apikey', 'dontong_usage', 'dontong_usage_reset', 'dontong_exporter',
];

function collectBackup(ls) {
  const data = {};
  BACKUP_KEYS.forEach(k => {
    const v = ls.getItem(k);
    if (v !== null) data[k] = v;
  });
  return {
    app: BACKUP_APP_ID,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data,
  };
}

function validateBackup(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return 'not_object';
  if (parsed.app !== BACKUP_APP_ID) return 'wrong_app';
  if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion > BACKUP_SCHEMA_VERSION) return 'bad_version';
  if (!parsed.data || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) return 'no_data';
  const known = Object.keys(parsed.data).filter(k => BACKUP_KEYS.includes(k));
  if (known.length === 0) return 'unknown_keys';
  return 'ok';
}

function applyBackup(parsed, ls) {
  BACKUP_KEYS.forEach(k => ls.removeItem(k));
  const known = Object.keys(parsed.data).filter(k => BACKUP_KEYS.includes(k));
  known.forEach(k => ls.setItem(k, parsed.data[k]));
}

function backupStamp(d) {
  d = d || new Date();
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

function checkUsageReset(ls) {
  const USAGE_RESET_HOUR = 8;
  const lastReset = ls.getItem('dontong_usage_reset');
  const now = new Date();
  let boundary = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), USAGE_RESET_HOUR));
  if (now < boundary) boundary = new Date(boundary.getTime() - 24 * 60 * 60 * 1000);
  const resetKey = boundary.toISOString().slice(0, 13);
  if (lastReset !== resetKey) {
    ls.setItem('dontong_usage', '0');
    ls.setItem('dontong_usage_reset', resetKey);
  }
}

module.exports = {
  LocalStorageMock,
  esc, cleanLabel, safeUrl, extLink, csvCell, safeFileName,
  channelDedupKey, extractYouTubeId, bgmDedupMatch,
  toIntCSV, parseCSVRows, fmtNum, fmtDate,
  BACKUP_APP_ID, BACKUP_SCHEMA_VERSION, BACKUP_KEYS,
  collectBackup, validateBackup, applyBackup, backupStamp,
  checkUsageReset,
};
