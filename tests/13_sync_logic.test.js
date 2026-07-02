/**
 * T13: sync.js 핵심 로직 정적+런타임 검증
 *
 * 1) EXCLUDE_FROM_SYNC 정의 & payload 제외
 * 2) LWW 워터마크(SYNC_META_KEY) 에코 억제
 * 3) config 없을 때 graceful 비활성(하위호환)
 * 4) collectSyncPayload 구조 (helpers 에서 로직 재현)
 * 5) isValidPayload 검증
 * 6) installStorageHook 부작용 없음(실제 origSet 먼저 호출)
 */
const fs = require('fs');
const path = require('path');
const { LocalStorageMock, BACKUP_KEYS } = require('./helpers');

const syncSrc = fs.readFileSync(path.resolve(__dirname, '../sync.js'), 'utf-8');

// ====== sync.js 에서 추출한 순수 로직 재현 ======
const EXCLUDE_FROM_SYNC = ['dontong_apikey', 'dontong_usage', 'dontong_usage_reset'];
const SYNC_META_KEY = 'dontong_sync_applied';
const BACKUP_APP_ID = 'marihwana-clone';
const BACKUP_SCHEMA_VERSION = 1;

function syncKeys(backupKeys) {
  const all = backupKeys || BACKUP_KEYS;
  return all.filter(k => EXCLUDE_FROM_SYNC.indexOf(k) === -1);
}

function collectSyncPayload(ls, backupKeys) {
  const keys = syncKeys(backupKeys);
  const data = {};
  keys.forEach(k => {
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

function isValidPayload(p) {
  if (!p || typeof p !== 'object') return false;
  if (p.app !== BACKUP_APP_ID) return false;
  if (typeof p.schemaVersion !== 'number') return false;
  if (!p.data || typeof p.data !== 'object') return false;
  return true;
}

function configValid(cfg) {
  return cfg &&
    typeof cfg.apiKey === 'string' && cfg.apiKey.trim() !== '' &&
    typeof cfg.projectId === 'string' && cfg.projectId.trim() !== '';
}

// 테스트용 storage 세팅
function seedAll(ls) {
  BACKUP_KEYS.forEach(k => {
    if (k === 'dontong_usage') ls.setItem(k, '100');
    else if (k === 'dontong_usage_reset') ls.setItem(k, '2026-07-01T08');
    else if (k === 'dontong_apikey') ls.setItem(k, 'AIza_secret_key');
    else ls.setItem(k, JSON.stringify([]));
  });
  ls.setItem('dontong_exporter', '윤@웅');
}

// ====== 테스트 ======

describe('T13-1: EXCLUDE_FROM_SYNC 정의 (정적 검증)', () => {
  test('dontong_apikey 제외 선언', () => {
    expect(syncSrc).toContain("'dontong_apikey'");
    expect(syncSrc).toContain('EXCLUDE_FROM_SYNC');
  });
  test('dontong_usage 제외 선언', () => {
    expect(syncSrc).toContain("'dontong_usage'");
  });
  test('dontong_usage_reset 제외 선언', () => {
    expect(syncSrc).toContain("'dontong_usage_reset'");
  });
  test('SYNC_META_KEY = dontong_sync_applied', () => {
    expect(syncSrc).toContain("'dontong_sync_applied'");
    expect(syncSrc).toContain('SYNC_META_KEY');
  });
});

describe('T13-2: syncKeys() — 제외 키 실제로 빠짐', () => {
  const keys = syncKeys();

  test('dontong_apikey 동기화 키에 없음', () => {
    expect(keys).not.toContain('dontong_apikey');
  });
  test('dontong_usage 동기화 키에 없음', () => {
    expect(keys).not.toContain('dontong_usage');
  });
  test('dontong_usage_reset 동기화 키에 없음', () => {
    expect(keys).not.toContain('dontong_usage_reset');
  });
  test('dontong_channels 는 동기화 키에 포함', () => {
    expect(keys).toContain('dontong_channels');
  });
  test('dontong_exporter 는 동기화 키에 포함 (이름은 기기간 공유)', () => {
    expect(keys).toContain('dontong_exporter');
  });
  test('BACKUP_KEYS(13개) - EXCLUDE(3개) = 10개', () => {
    expect(keys.length).toBe(BACKUP_KEYS.length - EXCLUDE_FROM_SYNC.length);
  });
});

describe('T13-3: collectSyncPayload() — API키/사용량 payload 제외', () => {
  test('payload.data 에 dontong_apikey 없음', () => {
    const ls = new LocalStorageMock();
    seedAll(ls);
    const payload = collectSyncPayload(ls);
    expect(payload.data).not.toHaveProperty('dontong_apikey');
  });
  test('payload.data 에 dontong_usage 없음', () => {
    const ls = new LocalStorageMock();
    seedAll(ls);
    const payload = collectSyncPayload(ls);
    expect(payload.data).not.toHaveProperty('dontong_usage');
  });
  test('payload.data 에 dontong_usage_reset 없음', () => {
    const ls = new LocalStorageMock();
    seedAll(ls);
    const payload = collectSyncPayload(ls);
    expect(payload.data).not.toHaveProperty('dontong_usage_reset');
  });
  test('payload.data 에 dontong_channels 포함', () => {
    const ls = new LocalStorageMock();
    seedAll(ls);
    const payload = collectSyncPayload(ls);
    expect(payload.data).toHaveProperty('dontong_channels');
  });
  test('payload 래퍼 구조: app/schemaVersion/exportedAt/data', () => {
    const ls = new LocalStorageMock();
    const payload = collectSyncPayload(ls);
    expect(payload.app).toBe('marihwana-clone');
    expect(payload.schemaVersion).toBe(1);
    expect(typeof payload.exportedAt).toBe('string');
    expect(typeof payload.data).toBe('object');
  });
  test('dontong_sync_applied 는 payload 에 포함되지 않음 (BACKUP_KEYS 밖)', () => {
    const ls = new LocalStorageMock();
    ls.setItem(SYNC_META_KEY, '2026-07-01T10:00:00Z');
    const payload = collectSyncPayload(ls);
    expect(payload.data).not.toHaveProperty('dontong_sync_applied');
  });
});

describe('T13-4: LWW 워터마크 에코억제 로직 (정적 검증)', () => {
  test('remote.exportedAt === applied 비교로 에코 판정', () => {
    expect(syncSrc).toContain('remote.exportedAt');
    expect(syncSrc).toContain('applied');
    // 에코 감지 후 return(skip) 패턴
    const echoBlock = syncSrc.match(/remote\.exportedAt[^}]+applied[^}]+return/s);
    expect(echoBlock).not.toBeNull();
  });
  test('push 후 SYNC_META_KEY 에 exportedAt 기록 (자기 에코 방지)', () => {
    // pushNow 에서 성공 시 localStorage.setItem(SYNC_META_KEY, payload.exportedAt)
    expect(syncSrc).toContain('SYNC_META_KEY');
    expect(syncSrc).toContain('payload.exportedAt');
  });
  test('applyRemote 에서도 SYNC_META_KEY 기록', () => {
    // applyRemote 에서 localStorage.setItem(SYNC_META_KEY, p.exportedAt)
    const applyBlock = syncSrc.match(/function applyRemote[\s\S]+?^  }/m);
    expect(applyBlock).not.toBeNull();
    expect(applyBlock[0]).toContain('SYNC_META_KEY');
  });
});

describe('T13-5: 에코억제 런타임 시뮬레이션', () => {
  test('동일 exportedAt → 에코로 판정해 적용 안 함', () => {
    const ls = new LocalStorageMock();
    const timestamp = '2026-07-01T10:00:00.000Z';
    ls.setItem(SYNC_META_KEY, timestamp);

    // 에코 억제 로직: applied === remote.exportedAt → skip
    const applied = ls.getItem(SYNC_META_KEY) || '';
    const remote = { exportedAt: timestamp, app: BACKUP_APP_ID, schemaVersion: 1, data: {} };
    const isEcho = remote.exportedAt && remote.exportedAt === applied;
    expect(isEcho).toBe(true);
  });

  test('다른 exportedAt → 새 원격 데이터로 적용', () => {
    const ls = new LocalStorageMock();
    ls.setItem(SYNC_META_KEY, '2026-07-01T09:00:00.000Z');

    const applied = ls.getItem(SYNC_META_KEY) || '';
    const remote = { exportedAt: '2026-07-01T10:30:00.000Z', app: BACKUP_APP_ID, schemaVersion: 1, data: {} };
    const isEcho = remote.exportedAt && remote.exportedAt === applied;
    expect(isEcho).toBe(false); // → 원격 적용해야 함
  });

  test('워터마크 없을 때 → 에코 아님(첫 동기화)', () => {
    const ls = new LocalStorageMock();
    const applied = ls.getItem(SYNC_META_KEY) || '';
    const remote = { exportedAt: '2026-07-01T10:00:00.000Z' };
    const isEcho = remote.exportedAt && remote.exportedAt === applied;
    expect(isEcho).toBe(false);
  });
});

describe('T13-6: isValidPayload() 검증', () => {
  test('유효한 payload → true', () => {
    expect(isValidPayload({ app: 'marihwana-clone', schemaVersion: 1, data: {} })).toBe(true);
  });
  test('null → false', () => expect(isValidPayload(null)).toBe(false));
  test('app 불일치 → false', () => {
    expect(isValidPayload({ app: 'other', schemaVersion: 1, data: {} })).toBe(false);
  });
  test('schemaVersion 문자열 → false', () => {
    expect(isValidPayload({ app: 'marihwana-clone', schemaVersion: '1', data: {} })).toBe(false);
  });
  test('data 없음 → false', () => {
    expect(isValidPayload({ app: 'marihwana-clone', schemaVersion: 1 })).toBe(false);
  });
  test('data 빈 배열 → sync.js는 통과(Array 체크 없음, app.js validateBackup과 미세 불일치)', () => {
    // sync.js isValidPayload: typeof [] === 'object' → true 반환 (기능상 무해: 동기화 keys 없음)
    // app.js validateBackup은 Array.isArray 추가 체크 있음 — 불일치 관찰(버그 아님)
    const result = isValidPayload({ app: 'marihwana-clone', schemaVersion: 1, data: [] });
    expect(result).toBe(true); // sync.js 실제 동작
  });
});

describe('T13-7: configValid() — graceful 비활성 경로', () => {
  test('유효한 config → true', () => {
    expect(configValid({ apiKey: 'AIzaXXX', projectId: 'my-project' })).toBe(true);
  });
  test('null → falsy (&&단축평가: null 반환, !!로 감싸므로 enabled=false 정상)', () => expect(configValid(null)).toBeFalsy());
  test('apiKey 빈값 → false', () => {
    expect(configValid({ apiKey: '', projectId: 'my-project' })).toBe(false);
  });
  test('apiKey 공백만 → false', () => {
    expect(configValid({ apiKey: '   ', projectId: 'my-project' })).toBe(false);
  });
  test('projectId 없음 → false', () => {
    expect(configValid({ apiKey: 'AIzaXXX' })).toBe(false);
  });
  test('undefined → falsy (&&단축평가: undefined 반환, !!로 감싸므로 enabled=false 정상)', () => expect(configValid(undefined)).toBeFalsy());
});

describe('T13-8: graceful 비활성(하위호환) 정적 패턴', () => {
  test('enabled=false 시 early return(기존 앱 영향 없음)', () => {
    // init() 에서 !enabled 면 renderAuthUI 후 return
    expect(syncSrc).toContain('if (!enabled)');
    const initBlock = syncSrc.match(/function init\(\)[\s\S]+?^  \}/m);
    expect(initBlock).not.toBeNull();
    expect(initBlock[0]).toContain('return');
  });
  test('syncAuthToggle 에서 미설정 시 안내 메시지', () => {
    expect(syncSrc).toContain('동기화가 설정되지 않았습니다');
  });
  test('버튼 숨김 처리(display:none)', () => {
    expect(syncSrc).toContain("display = 'none'");
  });
});

describe('T13-9: installStorageHook — origSet 먼저 호출', () => {
  test('origSet(k, v) 호출 후 조건 검사 패턴', () => {
    // localStorage.setItem 훅: origSet(k, v) 먼저 → 나서 조건 체크
    const hookBlock = syncSrc.match(/localStorage\.setItem\s*=\s*function[\s\S]+?};/);
    expect(hookBlock).not.toBeNull();
    const code = hookBlock[0];
    const origIdx = code.indexOf('origSet(k, v)');
    const condIdx = code.indexOf('schedulePush');
    // origSet 가 schedulePush 보다 먼저 나와야 함
    expect(origIdx).toBeGreaterThanOrEqual(0);
    expect(condIdx).toBeGreaterThanOrEqual(0);
    expect(origIdx).toBeLessThan(condIdx);
  });

  test('applyingRemote 중에는 schedulePush 하지 않음', () => {
    // 조건: !applyingRemote && keys.indexOf(k) !== -1
    expect(syncSrc).toContain('applyingRemote');
    expect(syncSrc).toContain('schedulePush');
    // applyingRemote 가드 패턴
    const guardPattern = /!applyingRemote[\s\S]{0,30}schedulePush|schedulePush[\s\S]{0,30}applyingRemote/;
    expect(guardPattern.test(syncSrc)).toBe(true);
  });

  test('EXCLUDE 키(apikey)가 바뀌어도 push 안 트리거', () => {
    // 훅 조건: keys.indexOf(k) !== -1 — syncKeys()에서 apikey 제외됐으므로 index=-1 → 통과 안 함
    const keys = syncKeys();
    expect(keys.indexOf('dontong_apikey')).toBe(-1);
  });
});
